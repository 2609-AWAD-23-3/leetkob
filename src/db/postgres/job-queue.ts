import type { Job } from '../../shared/domain/index.js';
import type { JobQueue } from '../job-queue.js';
import {
  copyJudgeResult,
  copyNewVerdict,
  requireId,
  requirePositiveInteger,
  validateJudgeResult,
  validateNewVerdict,
} from '../validation.js';
import { iso, transaction, type PostgresContext } from './client.js';

const EXHAUSTED_ERROR = 'max attempts reached without completion';

interface JobRow {
  id: string;
  submission_id: string;
  attempts: number;
  lease_owner: string | null;
  lease_token: string | null;
  lease_expires_at: Date | null;
  last_error: string | null;
  done: boolean;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    submissionId: row.submission_id,
    attempts: row.attempts,
    leaseOwner: row.lease_owner,
    leaseToken: row.lease_token,
    leaseExpiresAt: iso(row.lease_expires_at),
    lastError: row.last_error,
  };
}

// Lock first, then check the injected clock. A connection or row-lock wait
// must not let an expired lease use the time from before that wait.
const HELD_JOB_SQL = `
  SELECT * FROM jobs
  WHERE id = $1 AND NOT done AND lease_token = $2
  FOR UPDATE`;

function leaseIsLive(job: JobRow, nowMs: number): boolean {
  return (
    job.lease_expires_at !== null && job.lease_expires_at.getTime() > nowMs
  );
}

export function createJobQueue(ctx: PostgresContext): JobQueue {
  const { pool } = ctx;
  return {
    async claim({ workerId, leaseMs, maxAttempts }) {
      await ctx.ready;
      requireId(workerId, 'workerId');
      requirePositiveInteger(leaseMs, 'leaseMs');
      requirePositiveInteger(maxAttempts, 'maxAttempts');
      return transaction(pool, async (client) => {
        for (;;) {
          const now = ctx.now();
          // SKIP LOCKED lets concurrent workers take different jobs.
          const { rows } = await client.query<JobRow>(
            `SELECT * FROM jobs
             WHERE NOT done AND (lease_expires_at IS NULL OR lease_expires_at <= $1)
             ORDER BY seq LIMIT 1 FOR UPDATE SKIP LOCKED`,
            [now],
          );
          const job = rows[0];
          if (!job) return undefined;
          if (job.attempts >= maxAttempts) {
            // A worker that crashed on every attempt never called fail.
            await client.query(
              `UPDATE jobs SET done = true, lease_owner = NULL, lease_token = NULL,
                 lease_expires_at = NULL, last_error = $2 WHERE id = $1`,
              [job.id, job.last_error ?? EXHAUSTED_ERROR],
            );
            await client.query(
              `UPDATE submissions SET status = 'failed' WHERE id = $1`,
              [job.submission_id],
            );
            continue;
          }
          const claimed = await client.query<JobRow>(
            `UPDATE jobs SET lease_owner = $2, lease_token = $4, lease_expires_at = $3,
               attempts = attempts + 1 WHERE id = $1 RETURNING *`,
            [
              job.id,
              workerId,
              new Date(ctx.nowMs() + leaseMs).toISOString(),
              ctx.newId(),
            ],
          );
          await client.query(
            `UPDATE submissions SET status = 'judging' WHERE id = $1`,
            [job.submission_id],
          );
          return toJob(claimed.rows[0] as JobRow);
        }
      });
    },

    async extendLease({ jobId, leaseToken, leaseMs }) {
      await ctx.ready;
      requirePositiveInteger(leaseMs, 'leaseMs');
      return transaction(pool, async (client) => {
        const { rows } = await client.query<JobRow>(HELD_JOB_SQL, [
          jobId,
          leaseToken,
        ]);
        const job = rows[0];
        const nowMs = ctx.nowMs();
        if (!job || !leaseIsLive(job, nowMs)) return false;
        await client.query(
          'UPDATE jobs SET lease_expires_at = $2 WHERE id = $1',
          [job.id, new Date(nowMs + leaseMs).toISOString()],
        );
        return true;
      });
    },

    async complete({ jobId, leaseToken, judgeResult, verdicts }) {
      await ctx.ready;
      return transaction(pool, async (client) => {
        const held = await client.query<JobRow>(HELD_JOB_SQL, [
          jobId,
          leaseToken,
        ]);
        const job = held.rows[0];
        if (!job || !leaseIsLive(job, ctx.nowMs())) return false;
        const { rows } = await client.query<{ id: string; lab_id: string }>(
          'SELECT id, lab_id FROM submissions WHERE id = $1 FOR UPDATE',
          [job.submission_id],
        );
        const submission = rows[0];
        if (!submission) throw new TypeError('Job refers to missing data');
        const constraintRows = await client.query<{ id: string }>(
          'SELECT id FROM lab_constraints WHERE lab_id = $1',
          [submission.lab_id],
        );
        // Same checks as the in-memory store, all before any write.
        validateJudgeResult(judgeResult);
        if (!Array.isArray(verdicts))
          throw new TypeError('verdicts must be an array');
        const constraintIds = new Set(constraintRows.rows.map((r) => r.id));
        const seen = new Set<string>();
        for (const verdict of verdicts) {
          validateNewVerdict(verdict);
          if (verdict.submissionId !== submission.id)
            throw new TypeError('Verdict belongs to another submission');
          if (!constraintIds.has(verdict.constraintId))
            throw new TypeError('Verdict refers to an unknown constraint');
          if (seen.has(verdict.constraintId))
            throw new TypeError('Duplicate verdict for a constraint');
          seen.add(verdict.constraintId);
        }
        if (judgeResult.verdict === 'AC') {
          if (seen.size !== constraintIds.size)
            throw new TypeError(
              'An AC submission needs one verdict per constraint',
            );
        } else if (verdicts.length > 0) {
          throw new TypeError('Only an AC submission is reviewed (FAQ-04)');
        }
        // The submission lock may also have waited. Recheck before writes.
        const nowMs = ctx.nowMs();
        if (!leaseIsLive(job, nowMs)) return false;
        const now = new Date(nowMs).toISOString();
        for (const raw of verdicts) {
          const verdict = copyNewVerdict(raw);
          await client.query(
            `INSERT INTO verdicts (id, submission_id, constraint_id, verdict,
               evidence, unsure_cause, reason, source, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (submission_id, constraint_id) DO NOTHING`,
            [
              ctx.newId(),
              verdict.submissionId,
              verdict.constraintId,
              verdict.verdict,
              JSON.stringify(verdict.evidence),
              verdict.unsureCause,
              verdict.reason,
              verdict.source,
              now,
            ],
          );
        }
        await client.query(
          `UPDATE submissions SET judge_result = $2, status = 'judged' WHERE id = $1`,
          [submission.id, JSON.stringify(copyJudgeResult(judgeResult))],
        );
        await client.query(
          `UPDATE jobs SET done = true, lease_owner = NULL, lease_token = NULL,
             lease_expires_at = NULL WHERE id = $1`,
          [job.id],
        );
        return true;
      });
    },

    async fail({ jobId, leaseToken, error, maxAttempts }) {
      await ctx.ready;
      requirePositiveInteger(maxAttempts, 'maxAttempts');
      return transaction(pool, async (client) => {
        const held = await client.query<JobRow>(HELD_JOB_SQL, [
          jobId,
          leaseToken,
        ]);
        const job = held.rows[0];
        if (!job || !leaseIsLive(job, ctx.nowMs())) return false;
        const exhausted = job.attempts >= maxAttempts;
        await client.query(
          `UPDATE jobs SET done = $2, lease_owner = NULL, lease_token = NULL,
             lease_expires_at = NULL, last_error = $3 WHERE id = $1`,
          [job.id, exhausted, String(error)],
        );
        await client.query('UPDATE submissions SET status = $2 WHERE id = $1', [
          job.submission_id,
          exhausted ? 'failed' : 'queued',
        ]);
        return true;
      });
    },
  };
}
