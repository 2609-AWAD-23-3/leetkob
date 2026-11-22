import type { Submission } from '../../shared/domain/index.js';
import type { SubmissionStore } from '../submission-store.js';
import { normalizeLabKey } from '../lab-creation.js';
import {
  codeFingerprint,
  validateIntake,
  validateSubmissionQuery,
  SUBMISSION_TTL_MS,
} from '../submission-intake.js';
import { requireId } from '../validation.js';
import {
  isoRequired,
  transaction,
  type PostgresContext,
  type Queryable,
} from './client.js';

export interface SubmissionRow {
  id: string;
  lab_id: string;
  student_id: string;
  code: string;
  submitted_at: Date;
  status: Submission['status'];
  judge_result: Submission['judgeResult'];
  seq: string;
}

export function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    labId: row.lab_id,
    studentId: row.student_id,
    code: row.code,
    submittedAt: isoRequired(row.submitted_at),
    status: row.status,
    judgeResult: row.judge_result,
  };
}

// The last submission received in [opens_at, deadline) of each student
// (FAQ-02), ordered by arrival. Ties on time go to the later insert.
export const COUNTED_SUBMISSIONS_SQL = `
  SELECT counted.* FROM (
    SELECT DISTINCT ON (s.student_id) s.*
    FROM submissions s JOIN labs l ON l.id = s.lab_id
    WHERE s.lab_id = $1
      AND s.submitted_at >= l.opens_at
      AND s.submitted_at < l.deadline
    ORDER BY s.student_id, s.submitted_at DESC, s.seq DESC
  ) counted
  ORDER BY counted.seq`;

export async function enqueueJob(
  db: Queryable,
  ctx: PostgresContext,
  submissionId: string,
): Promise<void> {
  await db.query('INSERT INTO jobs (id, submission_id) VALUES ($1, $2)', [
    ctx.newId(),
    submissionId,
  ]);
}

export function createSubmissionStore(ctx: PostgresContext): SubmissionStore {
  const { pool } = ctx;
  return {
    async submitIdempotently(value, requestKey) {
      const submittedAt = ctx.now();
      const input = {
        labId: value.labId,
        studentId: value.studentId,
        code: value.code,
      };
      validateIntake(input);
      const key = normalizeLabKey(requestKey);
      const fingerprint = codeFingerprint(input.code);
      await ctx.ready;
      return transaction(pool, async (client) => {
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [
            JSON.stringify([
              't04-submission',
              input.studentId,
              input.labId,
              key,
            ]),
          ],
        );
        const lab = (
          await client.query<{ opens_at: Date; deadline: Date }>(
            `SELECT l.opens_at,l.deadline FROM labs l
          JOIN class_memberships m ON m.class_id=l.class_id AND m.user_id=$2 AND m.role='student'
          JOIN users u ON u.id=m.user_id AND u.role='student' WHERE l.id=$1`,
            [input.labId, input.studentId],
          )
        ).rows[0];
        if (!lab) return { kind: 'not-found' };
        const now = ctx.nowMs();
        const args = [input.studentId, input.labId, key];
        const existing = (
          await client.query<{
            fingerprint: string;
            submission_id: string;
            expires_at: Date;
          }>(
            'SELECT fingerprint,submission_id,expires_at FROM submission_intake_requests WHERE student_id=$1 AND lab_id=$2 AND key=$3',
            args,
          )
        ).rows[0];
        if (existing && existing.expires_at.getTime() > now) {
          if (existing.fingerprint !== fingerprint) return { kind: 'conflict' };
          const row = (
            await client.query<SubmissionRow>(
              'SELECT * FROM submissions WHERE id=$1',
              [existing.submission_id],
            )
          ).rows[0];
          if (!row) throw new Error('Missing idempotent submission');
          return { kind: 'replayed', submission: toSubmission(row) };
        }
        const received = Date.parse(submittedAt);
        if (
          received < lab.opens_at.getTime() ||
          received >= lab.deadline.getTime()
        )
          return { kind: 'not-open' };
        if (existing)
          await client.query(
            'DELETE FROM submission_intake_requests WHERE student_id=$1 AND lab_id=$2 AND key=$3',
            args,
          );
        const row = (
          await client.query<SubmissionRow>(
            `INSERT INTO submissions (id,lab_id,student_id,code,submitted_at,status)
          VALUES ($1,$2,$3,$4,$5,'queued') RETURNING *`,
            [
              ctx.newId(),
              input.labId,
              input.studentId,
              input.code,
              submittedAt,
            ],
          )
        ).rows[0]!;
        await enqueueJob(client, ctx, row.id);
        const keyCreatedAt = ctx.nowMs();
        await client.query(
          `INSERT INTO submission_intake_requests (student_id,lab_id,key,fingerprint,submission_id,created_at,expires_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            ...args,
            fingerprint,
            row.id,
            new Date(keyCreatedAt).toISOString(),
            new Date(keyCreatedAt + SUBMISSION_TTL_MS).toISOString(),
          ],
        );
        return { kind: 'created', submission: toSubmission(row) };
      });
    },
    async listSubmissionSummaries(query) {
      validateSubmissionQuery(query);
      await ctx.ready;
      const args: unknown[] = [query.labId];
      const where = ['lab_id=$1'];
      if (query.studentId !== undefined) {
        args.push(query.studentId);
        where.push(`student_id=$${args.length}`);
      }
      if (query.status !== undefined) {
        args.push(query.status);
        where.push(`status=$${args.length}`);
      }
      if (query.after) {
        args.push(query.after.submittedAt, query.after.seq);
        where.push(
          `(submitted_at,seq)<($${args.length - 1}::timestamptz,$${args.length}::bigint)`,
        );
      }
      args.push(query.limit + 1);
      const rows = (
        await pool.query<
          Pick<
            SubmissionRow,
            'id' | 'lab_id' | 'student_id' | 'submitted_at' | 'status' | 'seq'
          > & {
            verdict: NonNullable<Submission['judgeResult']>['verdict'] | null;
          }
        >(
          `SELECT id,lab_id,student_id,submitted_at,status,seq,judge_result->>'verdict' AS verdict FROM submissions WHERE ${where.join(' AND ')} ORDER BY submitted_at DESC,seq DESC LIMIT $${args.length}`,
          args,
        )
      ).rows;
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        submissions: page.map((row) => ({
          id: row.id,
          labId: row.lab_id,
          studentId: row.student_id,
          submittedAt: isoRequired(row.submitted_at),
          status: row.status,
          verdict: row.verdict,
        })),
        next:
          rows.length > query.limit && last
            ? { submittedAt: isoRequired(last.submitted_at), seq: last.seq }
            : null,
      };
    },
    async submit({ labId, studentId, code }) {
      // Preserve server receive time, even if readiness or database I/O
      // waits until after the deadline. Never take this value from input.
      const submittedAt = ctx.now();
      await ctx.ready;
      requireId(labId, 'labId');
      requireId(studentId, 'studentId');
      if (typeof code !== 'string')
        throw new TypeError('code must be a string');
      return transaction(pool, async (client) => {
        const refs = await client.query(
          `SELECT (SELECT count(*) FROM labs WHERE id = $1)::int AS labs,
                  (SELECT count(*) FROM users WHERE id = $2)::int AS users`,
          [labId, studentId],
        );
        if (refs.rows[0].labs === 0) throw new TypeError('Unknown lab');
        if (refs.rows[0].users === 0) throw new TypeError('Unknown student');
        // Submission and job are written in the same transaction.
        const { rows } = await client.query<SubmissionRow>(
          `INSERT INTO submissions (id, lab_id, student_id, code, submitted_at, status)
           VALUES ($1, $2, $3, $4, $5, 'queued') RETURNING *`,
          [ctx.newId(), labId, studentId, code, submittedAt],
        );
        const row = rows[0] as SubmissionRow;
        await enqueueJob(client, ctx, row.id);
        return toSubmission(row);
      });
    },

    async getSubmission(submissionId) {
      await ctx.ready;
      const { rows } = await pool.query<SubmissionRow>(
        'SELECT * FROM submissions WHERE id = $1',
        [submissionId],
      );
      return rows[0] ? toSubmission(rows[0]) : undefined;
    },

    async listSubmissions(labId, studentId) {
      await ctx.ready;
      const { rows } = await pool.query<SubmissionRow>(
        `SELECT * FROM submissions WHERE lab_id = $1 AND student_id = $2
         ORDER BY seq DESC`,
        [labId, studentId],
      );
      return rows.map(toSubmission);
    },

    async listCountedSubmissions(labId) {
      await ctx.ready;
      const { rows } = await pool.query<SubmissionRow>(
        COUNTED_SUBMISSIONS_SQL,
        [labId],
      );
      return rows.map(toSubmission);
    },

    async requeue(submissionId) {
      await ctx.ready;
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE submissions SET status = 'queued'
           WHERE id = $1 AND status = 'failed' RETURNING id`,
          [submissionId],
        );
        if (!updated.rowCount) return false;
        await enqueueJob(client, ctx, submissionId);
        return true;
      });
    },
  };
}
