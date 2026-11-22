import type { Lab, LabSummary } from '../../shared/domain/index.js';
import {
  normalizeLabKey,
  normalizeNewLab,
  labFingerprint,
  LAB_CREATION_TTL_MS,
} from '../lab-creation.js';
import type { LabStore } from '../lab-store.js';
import {
  copyNewLab,
  requireOpensBeforeDeadline,
  validateNewLab,
} from '../validation.js';
import {
  isoRequired,
  transaction,
  type PostgresContext,
  type Queryable,
} from './client.js';

interface LabRow {
  id: string;
  class_id: string;
  title: string;
  statement: string;
  opens_at: Date;
  deadline: Date;
  cpu_time_ms: number;
  memory_mb: number;
  created_by: string;
  created_at: Date;
}

// Loads full labs (with tests and constraints in their original order).
export async function loadLabs(
  db: Queryable,
  where: string,
  params: unknown[],
): Promise<Lab[]> {
  const { rows } = await db.query<LabRow>(
    `SELECT * FROM labs WHERE ${where} ORDER BY seq`,
    params,
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const tests = await db.query(
    'SELECT * FROM lab_tests WHERE lab_id = ANY($1) ORDER BY position',
    [ids],
  );
  const constraints = await db.query(
    'SELECT * FROM lab_constraints WHERE lab_id = ANY($1) ORDER BY position',
    [ids],
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.class_id,
    title: row.title,
    statement: row.statement,
    opensAt: isoRequired(row.opens_at),
    deadline: isoRequired(row.deadline),
    limits: { cpuTimeMs: row.cpu_time_ms, memoryMb: row.memory_mb },
    tests: tests.rows
      .filter((t) => t.lab_id === row.id)
      .map((t) => ({
        id: t.id,
        input: t.input,
        expectedOutput: t.expected_output,
      })),
    constraints: constraints.rows
      .filter((c) => c.lab_id === row.id)
      .map((c) => ({ id: c.id, text: c.text, deduction: c.deduction })),
    createdBy: row.created_by,
    createdAt: isoRequired(row.created_at),
  }));
}

export async function getLab(
  db: Queryable,
  labId: string,
): Promise<Lab | undefined> {
  return (await loadLabs(db, 'id = $1', [labId]))[0];
}

export async function insertLab(db: Queryable, lab: Lab): Promise<void> {
  await db.query(
    `INSERT INTO labs (id, class_id, title, statement, opens_at, deadline,
       cpu_time_ms, memory_mb, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      lab.id,
      lab.classId,
      lab.title,
      lab.statement,
      lab.opensAt,
      lab.deadline,
      lab.limits.cpuTimeMs,
      lab.limits.memoryMb,
      lab.createdBy,
      lab.createdAt,
    ],
  );
  for (const [position, test] of lab.tests.entries()) {
    await db.query(
      `INSERT INTO lab_tests (lab_id, id, position, input, expected_output)
       VALUES ($1, $2, $3, $4, $5)`,
      [lab.id, test.id, position, test.input, test.expectedOutput],
    );
  }
  for (const [position, constraint] of lab.constraints.entries()) {
    await db.query(
      `INSERT INTO lab_constraints (lab_id, id, position, text, deduction)
       VALUES ($1, $2, $3, $4, $5)`,
      [lab.id, constraint.id, position, constraint.text, constraint.deduction],
    );
  }
}

export function createLabStore(ctx: PostgresContext): LabStore {
  return {
    async getLabSummary(labId) {
      await ctx.ready;
      const { rows } = await ctx.pool.query<
        Pick<
          LabRow,
          'id' | 'class_id' | 'title' | 'opens_at' | 'deadline' | 'created_at'
        >
      >(
        'SELECT id,class_id,title,opens_at,deadline,created_at FROM labs WHERE id=$1',
        [labId],
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            classId: row.class_id,
            title: row.title,
            opensAt: isoRequired(row.opens_at),
            deadline: isoRequired(row.deadline),
            createdAt: isoRequired(row.created_at),
          }
        : undefined;
    },
    async createLabIdempotently(value, key) {
      const input = normalizeNewLab(value);
      const normalizedKey = normalizeLabKey(key);
      const fingerprint = labFingerprint(input);
      await ctx.ready;
      return transaction(ctx.pool, async (client) => {
        const scope = JSON.stringify([
          't04-lab-create',
          input.createdBy,
          input.classId,
          normalizedKey,
        ]);
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [scope],
        );
        const now = ctx.nowMs();
        const args = [input.createdBy, input.classId, normalizedKey];
        const { rows } = await client.query<{
          fingerprint: string;
          lab_id: string;
          expires_at: Date;
        }>(
          'SELECT fingerprint, lab_id, expires_at FROM lab_creation_requests WHERE created_by=$1 AND class_id=$2 AND key=$3',
          args,
        );
        const existing = rows[0];
        if (existing && existing.expires_at.getTime() > now) {
          if (existing.fingerprint !== fingerprint) return { kind: 'conflict' };
          const lab = await getLab(client, existing.lab_id);
          if (!lab) throw new Error('Missing idempotent lab');
          return { kind: 'replayed', lab };
        }
        if (
          Date.parse(input.deadline) <= now ||
          Date.parse(input.opensAt ?? new Date(now).toISOString()) >=
            Date.parse(input.deadline)
        )
          return { kind: 'invalid-time' };
        const refs = await client.query(
          'SELECT (SELECT count(*) FROM classes WHERE id=$1)::int AS classes, (SELECT count(*) FROM users WHERE id=$2)::int AS users',
          [input.classId, input.createdBy],
        );
        if (!refs.rows[0].classes || !refs.rows[0].users)
          throw new TypeError('Unknown lab class or creator');
        const lab: Lab = {
          id: ctx.newId(),
          ...copyNewLab(input),
          opensAt: input.opensAt ?? new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        };
        if (existing)
          await client.query(
            'DELETE FROM lab_creation_requests WHERE created_by=$1 AND class_id=$2 AND key=$3',
            args,
          );
        await insertLab(client, lab);
        await client.query(
          'INSERT INTO lab_creation_requests (created_by,class_id,key,fingerprint,lab_id,created_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            ...args,
            fingerprint,
            lab.id,
            lab.createdAt,
            new Date(now + LAB_CREATION_TTL_MS).toISOString(),
          ],
        );
        return { kind: 'created', lab };
      });
    },
    async listLabSummariesForClass(classId) {
      await ctx.ready;
      const { rows } = await ctx.pool.query<
        Pick<
          LabRow,
          'id' | 'class_id' | 'title' | 'opens_at' | 'deadline' | 'created_at'
        >
      >(
        'SELECT id,class_id,title,opens_at,deadline,created_at FROM labs WHERE class_id=$1 ORDER BY created_at DESC,id COLLATE "C" ASC',
        [classId],
      );
      return rows.map((row): LabSummary => ({
        id: row.id,
        classId: row.class_id,
        title: row.title,
        opensAt: isoRequired(row.opens_at),
        deadline: isoRequired(row.deadline),
        createdAt: isoRequired(row.created_at),
      }));
    },
    async createLab(input) {
      await ctx.ready;
      validateNewLab(input);
      const createdAt = ctx.now();
      const opensAt = input.opensAt ?? createdAt;
      requireOpensBeforeDeadline(opensAt, input.deadline);
      const lab: Lab = {
        id: ctx.newId(),
        ...copyNewLab(input),
        opensAt,
        createdAt,
      };
      await transaction(ctx.pool, async (client) => {
        const refs = await client.query(
          `SELECT (SELECT count(*) FROM classes WHERE id = $1)::int AS classes,
                  (SELECT count(*) FROM users WHERE id = $2)::int AS users`,
          [lab.classId, lab.createdBy],
        );
        if (refs.rows[0].classes === 0)
          throw new TypeError('lab.classId is unknown');
        if (refs.rows[0].users === 0)
          throw new TypeError('lab.createdBy is unknown');
        await insertLab(client, lab);
      });
      return lab;
    },

    async getLab(labId) {
      await ctx.ready;
      return getLab(ctx.pool, labId);
    },

    async listLabsForUser(userId) {
      await ctx.ready;
      return loadLabs(
        ctx.pool,
        'class_id IN (SELECT class_id FROM class_memberships WHERE user_id = $1)',
        [userId],
      );
    },
  };
}
