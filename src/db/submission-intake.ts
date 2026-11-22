import { createHash } from 'node:crypto';
import { requireId, requireTimestamp } from './validation.js';
import { validateSubmissionCode } from '../shared/submission-input.js';
import type {
  SubmissionListQuery,
  SubmissionSummary,
} from './submission-store.js';
import type { Submission } from '../shared/domain/index.js';

export const SUBMISSION_TTL_MS = 86_400_000;
export const SUBMISSION_STATUSES = [
  'queued',
  'judging',
  'judged',
  'failed',
] as const;
export function validateIntake(input: {
  labId: string;
  studentId: string;
  code: string;
}): void {
  requireId(input.labId, 'labId');
  requireId(input.studentId, 'studentId');
  validateSubmissionCode(input.code);
}
export function codeFingerprint(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}
export function validateSubmissionQuery(query: SubmissionListQuery): void {
  requireId(query.labId, 'labId');
  if (query.studentId !== undefined) requireId(query.studentId, 'studentId');
  if (query.status !== undefined && !SUBMISSION_STATUSES.includes(query.status))
    throw new TypeError('Invalid status');
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)
    throw new TypeError('Invalid limit');
  if (query.after) {
    requireTimestamp(query.after.submittedAt, 'cursor timestamp');
    if (
      !/^(0|[1-9][0-9]{0,18})$/.test(query.after.seq) ||
      BigInt(query.after.seq) > 9223372036854775807n
    )
      throw new TypeError('Invalid cursor sequence');
  }
}
export function submissionSummary(s: Submission): SubmissionSummary {
  return {
    id: s.id,
    labId: s.labId,
    studentId: s.studentId,
    submittedAt: s.submittedAt,
    status: s.status,
    verdict: s.judgeResult?.verdict ?? null,
  };
}
