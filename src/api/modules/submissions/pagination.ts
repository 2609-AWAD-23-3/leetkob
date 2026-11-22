import {
  SUBMISSION_STATUSES,
  validateSubmissionQuery,
} from '../../../db/submission-intake.js';
import type { SubmissionListQuery } from '../../../db/submission-store.js';
import { requireExactKeys } from '../../../db/validation.js';

export function submissionQuery(
  raw: unknown,
  labId: string,
  mine?: string,
): SubmissionListQuery {
  const query = raw as Record<string, unknown>;
  const allowed = mine
    ? ['limit', 'cursor']
    : ['limit', 'cursor', 'studentId', 'status'];
  if (
    Object.entries(query).some(
      ([key, value]) => !allowed.includes(key) || typeof value !== 'string',
    )
  )
    throw new TypeError('Invalid or duplicate query parameter');
  const limit =
    query.limit === undefined
      ? 20
      : typeof query.limit === 'string' && /^[1-9][0-9]{0,2}$/.test(query.limit)
        ? Number(query.limit)
        : NaN;
  const result: SubmissionListQuery = {
    labId,
    limit,
    ...(mine
      ? { studentId: mine }
      : query.studentId === undefined
        ? {}
        : { studentId: query.studentId as string }),
    ...(query.status === undefined
      ? {}
      : { status: query.status as (typeof SUBMISSION_STATUSES)[number] }),
  };
  if (query.cursor !== undefined) {
    const cursor = query.cursor as string;
    if (
      cursor.length > 2048 ||
      !/^[A-Za-z0-9_-]+$/.test(cursor) ||
      Buffer.from(cursor, 'base64url').toString('base64url') !== cursor
    )
      throw new TypeError('Invalid cursor');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Buffer.from(cursor, 'base64url'),
        ),
      ) as Record<string, unknown>;
    } catch {
      throw new TypeError('Invalid cursor');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new TypeError('Invalid cursor');
    requireExactKeys(
      parsed,
      ['v', 'labId', 'studentId', 'status', 'submittedAt', 'seq'],
      'cursor',
    );
    if (
      parsed.v !== 1 ||
      parsed.labId !== labId ||
      parsed.studentId !== (result.studentId ?? null) ||
      parsed.status !== (result.status ?? null) ||
      typeof parsed.submittedAt !== 'string' ||
      typeof parsed.seq !== 'string'
    )
      throw new TypeError('Cursor does not match request scope');
    result.after = { submittedAt: parsed.submittedAt, seq: parsed.seq };
  }
  validateSubmissionQuery(result);
  return result;
}
export function encodeSubmissionCursor(
  query: SubmissionListQuery,
  next: SubmissionListQuery['after'],
): string | null {
  return next
    ? Buffer.from(
        JSON.stringify({
          v: 1,
          labId: query.labId,
          studentId: query.studentId ?? null,
          status: query.status ?? null,
          ...next,
        }),
      ).toString('base64url')
    : null;
}
