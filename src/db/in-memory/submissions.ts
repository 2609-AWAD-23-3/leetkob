import type { SubmissionStore } from '../submission-store.js';
import { normalizeLabKey } from '../lab-creation.js';
import {
  codeFingerprint,
  validateIntake,
  validateSubmissionQuery,
  submissionSummary,
  SUBMISSION_TTL_MS,
} from '../submission-intake.js';
import {
  requireId,
  toSubmission,
  type Context,
  type State,
  type StoredSubmission,
} from './state.js';

// The last submission received before the deadline of each student (FAQ-02).
export function countedSubmissions(
  state: State,
  labId: string,
): StoredSubmission[] {
  const lab = state.labs.get(labId);
  if (!lab) return [];
  const opensAt = Date.parse(lab.opensAt);
  const deadline = Date.parse(lab.deadline);
  const latest = new Map<string, StoredSubmission>();
  for (const submission of state.submissions.values()) {
    if (submission.labId !== labId) continue;
    const receivedAt = Date.parse(submission.submittedAt);
    // Only submissions received while the lab is open count (FAQ-02, FAQ-03).
    if (receivedAt < opensAt || receivedAt >= deadline) continue;
    const current = latest.get(submission.studentId);
    if (
      !current ||
      submission.submittedAt > current.submittedAt ||
      (submission.submittedAt === current.submittedAt &&
        submission.seq > current.seq)
    )
      latest.set(submission.studentId, submission);
  }
  return [...latest.values()].sort((a, b) => a.seq - b.seq);
}

export function enqueueJob(ctx: Context, submissionId: string): void {
  const id = ctx.newId();
  ctx.state.jobs.set(id, {
    id,
    submissionId,
    attempts: 0,
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
    lastError: null,
    done: false,
  });
}

export function createSubmissionStore(ctx: Context): SubmissionStore {
  return {
    async submitIdempotently(input, requestKey) {
      const submittedAt = ctx.now();
      validateIntake(input);
      const scope = JSON.stringify([
        input.studentId,
        input.labId,
        normalizeLabKey(requestKey),
      ]);
      const fingerprint = codeFingerprint(input.code);
      const lab = ctx.state.labs.get(input.labId);
      if (
        !lab ||
        ctx.state.users.get(input.studentId)?.role !== 'student' ||
        ctx.state.memberships.get(
          JSON.stringify([input.studentId, lab.classId]),
        )?.role !== 'student'
      )
        return { kind: 'not-found' };
      const now = ctx.nowMs();
      const existing = ctx.state.submissionRequests.get(scope);
      if (existing && existing.expiresAt > now) {
        if (existing.fingerprint !== fingerprint) return { kind: 'conflict' };
        const submission = ctx.state.submissions.get(existing.submissionId);
        if (!submission) throw new Error('Missing idempotent submission');
        return { kind: 'replayed', submission: toSubmission(submission) };
      }
      if (
        Date.parse(submittedAt) < Date.parse(lab.opensAt) ||
        Date.parse(submittedAt) >= Date.parse(lab.deadline)
      )
        return { kind: 'not-open' };
      // Generate/check both IDs before mutating any state, including sequence.
      const id = ctx.newId();
      const jobId = ctx.newId();
      if (ctx.state.submissions.has(id) || ctx.state.jobs.has(jobId))
        throw new Error('Duplicate generated ID');
      const submission: StoredSubmission = {
        ...input,
        id,
        submittedAt,
        status: 'queued',
        judgeResult: null,
        seq: ctx.state.nextSeq++,
      };
      ctx.state.submissions.set(id, submission);
      ctx.state.jobs.set(jobId, {
        id: jobId,
        submissionId: id,
        attempts: 0,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: null,
        done: false,
      });
      ctx.state.submissionRequests.set(scope, {
        fingerprint,
        submissionId: id,
        expiresAt: now + SUBMISSION_TTL_MS,
      });
      return { kind: 'created', submission: toSubmission(submission) };
    },
    async listSubmissionSummaries(query) {
      validateSubmissionQuery(query);
      const rows = [...ctx.state.submissions.values()]
        .filter(
          (s) =>
            s.labId === query.labId &&
            (query.studentId === undefined ||
              s.studentId === query.studentId) &&
            (query.status === undefined || s.status === query.status) &&
            (!query.after ||
              Date.parse(s.submittedAt) < Date.parse(query.after.submittedAt) ||
              (s.submittedAt === query.after.submittedAt &&
                BigInt(s.seq) < BigInt(query.after.seq))),
        )
        .sort(
          (a, b) =>
            Date.parse(b.submittedAt) - Date.parse(a.submittedAt) ||
            b.seq - a.seq,
        )
        .slice(0, query.limit + 1);
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        submissions: page.map(submissionSummary),
        next:
          rows.length > query.limit && last
            ? { submittedAt: last.submittedAt, seq: String(last.seq) }
            : null,
      };
    },
    async submit({ labId, studentId, code }) {
      const submittedAt = ctx.now();
      requireId(labId, 'labId');
      requireId(studentId, 'studentId');
      if (typeof code !== 'string')
        throw new TypeError('code must be a string');
      if (!ctx.state.labs.has(labId)) throw new TypeError('Unknown lab');
      if (!ctx.state.users.has(studentId))
        throw new TypeError('Unknown student');
      const submission: StoredSubmission = {
        id: ctx.newId(),
        labId,
        studentId,
        code,
        submittedAt,
        status: 'queued',
        judgeResult: null,
        seq: ctx.state.nextSeq++,
      };
      // Both writes happen synchronously, like one transaction.
      ctx.state.submissions.set(submission.id, submission);
      enqueueJob(ctx, submission.id);
      return toSubmission(submission);
    },

    async getSubmission(submissionId) {
      const submission = ctx.state.submissions.get(submissionId);
      return submission ? toSubmission(submission) : undefined;
    },

    async listSubmissions(labId, studentId) {
      return [...ctx.state.submissions.values()]
        .filter((s) => s.labId === labId && s.studentId === studentId)
        .sort((a, b) => b.seq - a.seq)
        .map(toSubmission);
    },

    async listCountedSubmissions(labId) {
      return countedSubmissions(ctx.state, labId).map(toSubmission);
    },

    async requeue(submissionId) {
      const submission = ctx.state.submissions.get(submissionId);
      if (!submission || submission.status !== 'failed') return false;
      submission.status = 'queued';
      enqueueJob(ctx, submissionId);
      return true;
    },
  };
}
