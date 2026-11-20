import type { Submission } from '../../shared/domain/index.js';
import type { SubmissionStore } from '../submission-store.js';
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
