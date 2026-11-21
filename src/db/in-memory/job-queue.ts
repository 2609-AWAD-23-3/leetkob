import type { JobQueue } from '../job-queue.js';
import {
  copyJudgeResult,
  copyNewVerdict,
  requirePositiveInteger,
  validateJudgeResult,
  validateNewVerdict,
} from '../validation.js';
import {
  key,
  requireId,
  toJob,
  type Context,
  type StoredJob,
} from './state.js';

const EXHAUSTED_ERROR = 'max attempts reached without completion';

function heldJob(
  ctx: Context,
  jobId: string,
  leaseToken: string,
): StoredJob | undefined {
  const job = ctx.state.jobs.get(jobId);
  if (
    !job ||
    job.done ||
    job.leaseToken === null ||
    job.leaseToken !== leaseToken ||
    job.leaseExpiresAt === null ||
    Date.parse(job.leaseExpiresAt) <= ctx.nowMs()
  )
    return undefined;
  return job;
}

// Ends a job for good and marks its submission 'failed' (system error).
function exhaust(ctx: Context, job: StoredJob, error: string): void {
  job.done = true;
  job.leaseOwner = null;
  job.leaseToken = null;
  job.leaseExpiresAt = null;
  job.lastError = error;
  const submission = ctx.state.submissions.get(job.submissionId);
  if (submission) submission.status = 'failed';
}

export function createJobQueue(ctx: Context): JobQueue {
  return {
    async claim({ workerId, leaseMs, maxAttempts }) {
      requireId(workerId, 'workerId');
      requirePositiveInteger(leaseMs, 'leaseMs');
      requirePositiveInteger(maxAttempts, 'maxAttempts');
      const now = ctx.nowMs();
      for (const job of ctx.state.jobs.values()) {
        if (job.done) continue;
        if (job.leaseExpiresAt !== null && Date.parse(job.leaseExpiresAt) > now)
          continue;
        // A worker that crashed on every attempt never called fail; stop here
        // so the submission ends as 'failed' instead of blocking Publish.
        if (job.attempts >= maxAttempts) {
          exhaust(ctx, job, job.lastError ?? EXHAUSTED_ERROR);
          continue;
        }
        job.leaseOwner = workerId;
        job.leaseToken = ctx.newId();
        job.leaseExpiresAt = new Date(now + leaseMs).toISOString();
        job.attempts += 1;
        const submission = ctx.state.submissions.get(job.submissionId);
        if (submission) submission.status = 'judging';
        return toJob(job);
      }
      return undefined;
    },

    async extendLease({ jobId, leaseToken, leaseMs }) {
      requirePositiveInteger(leaseMs, 'leaseMs');
      const job = heldJob(ctx, jobId, leaseToken);
      if (!job) return false;
      job.leaseExpiresAt = new Date(ctx.nowMs() + leaseMs).toISOString();
      return true;
    },

    async complete({ jobId, leaseToken, judgeResult, verdicts }) {
      const job = heldJob(ctx, jobId, leaseToken);
      if (!job) return false;
      const submission = ctx.state.submissions.get(job.submissionId);
      const lab = submission ? ctx.state.labs.get(submission.labId) : undefined;
      if (!submission || !lab)
        throw new TypeError('Job refers to missing data');
      validateJudgeResult(judgeResult);
      if (!Array.isArray(verdicts))
        throw new TypeError('verdicts must be an array');
      const constraintIds = new Set(lab.constraints.map((c) => c.id));
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
        // Every constraint of an Accepted submission needs a verdict; the
        // pipeline records 'unsure' (for example cause 'timeout') on errors.
        if (seen.size !== constraintIds.size)
          throw new TypeError(
            'An AC submission needs one verdict per constraint',
          );
      } else if (verdicts.length > 0) {
        throw new TypeError('Only an AC submission is reviewed (FAQ-04)');
      }
      // All checks passed: write everything synchronously, like one transaction.
      const createdAt = ctx.now();
      for (const verdict of verdicts) {
        const pair = key(verdict.submissionId, verdict.constraintId);
        if (ctx.state.verdictIdsByPair.has(pair)) continue; // unique key
        const id = ctx.newId();
        ctx.state.verdictIdsByPair.set(pair, id);
        ctx.state.verdicts.set(id, {
          ...copyNewVerdict(verdict),
          id,
          createdAt,
          taDecision: null,
          taEvidence: [],
          reviewedBy: null,
          reviewedAt: null,
        });
      }
      submission.judgeResult = copyJudgeResult(judgeResult);
      submission.status = 'judged';
      job.done = true;
      job.leaseOwner = null;
      job.leaseToken = null;
      job.leaseExpiresAt = null;
      return true;
    },

    async fail({ jobId, leaseToken, error, maxAttempts }) {
      requirePositiveInteger(maxAttempts, 'maxAttempts');
      const job = heldJob(ctx, jobId, leaseToken);
      if (!job) return false;
      if (job.attempts >= maxAttempts) {
        exhaust(ctx, job, String(error));
        return true;
      }
      job.lastError = String(error);
      job.leaseOwner = null;
      job.leaseToken = null;
      job.leaseExpiresAt = null;
      const submission = ctx.state.submissions.get(job.submissionId);
      if (submission) submission.status = 'queued';
      return true;
    },
  };
}
