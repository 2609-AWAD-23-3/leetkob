import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AuthStore } from '../../../db/auth-store.js';
import type { LabStore } from '../../../db/lab-store.js';
import type { PublicationStore } from '../../../db/publication-store.js';
import type { ReviewStore } from '../../../db/review-store.js';
import type { SubmissionStore } from '../../../db/submission-store.js';
import type { ReviewState } from '../../../db/types.js';
import { requireId } from '../../../db/validation.js';
import { splitLines } from '../../../pipeline/model/sanitize.js';
import type {
  Evidence,
  Lab,
  ReviewItem,
  TaDecision,
  User,
} from '../../../shared/domain/index.js';
import { registerApiErrorHandling } from '../../auth/http-errors.js';
import { ProblemError } from '../../auth/problem-details.js';
import {
  createSessionIdentityResolver,
  hasClassRole,
} from '../../auth/session.js';
import type { ProblemDetails, ProblemSlug } from '../../auth/types.js';

// PA03-T09: the TA review queue (docs/contract/review-queue.md). Verdicts only
// reach the TA of the lab's class here; students never receive them before
// Publish (FAQ-08), and every queue item needs a TA decision (FAQ-09, FAQ-12).

export interface ReviewQueueOptions {
  store: AuthStore &
    LabStore &
    SubmissionStore &
    ReviewStore &
    PublicationStore;
}

/** Upper bound on evidence lines a TA can point at in one decision. */
export const MAX_TA_EVIDENCE_LINES = 50;

const DECISIONS: readonly TaDecision[] = ['pass', 'violation'];
const DECISION_FIELDS = new Set(['decision', 'evidenceLines']);

function fail(
  status: ProblemDetails['status'],
  slug: ProblemSlug,
  detail: string,
): never {
  throw new ProblemError({
    type: `https://leetkob.example/problems/${slug}`,
    title: detail,
    status,
    detail,
  });
}

const notFound = (): never =>
  fail(404, 'not-found', 'Lab or review item not found.');
const locked = (): never =>
  fail(
    409,
    'conflict',
    'The lab is already published; review decisions are locked.',
  );

function itemDto(item: ReviewItem) {
  return {
    id: item.id,
    labId: item.labId,
    submissionId: item.submissionId,
    studentId: item.studentId,
    constraintId: item.constraintId,
    constraintText: item.constraintText,
    deduction: item.deduction,
    verdict: item.verdict,
    source: item.source,
    evidence: item.evidence.map(({ line, text }) => ({ line, text })),
    unsureCause: item.unsureCause,
    reason: item.reason,
    createdAt: item.createdAt,
    taDecision: item.taDecision,
    taEvidence: item.taEvidence.map(({ line, text }) => ({ line, text })),
    reviewedBy: item.reviewedBy,
    reviewedAt: item.reviewedAt,
  };
}

function stateDto(state: ReviewState) {
  return {
    queueItemCount: state.queueItemCount,
    passDecisionCount: state.passDecisionCount,
    violationDecisionCount: state.violationDecisionCount,
    pendingCount: state.pendingCount,
  };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads `{ decision, evidenceLines? }`. A violation needs at least one line
 * of the submitted code (FAQ-09); a pass takes none. The text of each line is
 * read from the stored code, never from the request.
 */
function readDecision(
  body: unknown,
  code: string,
): { decision: TaDecision; evidence: Evidence[] } {
  if (!isPlainObject(body))
    fail(400, 'validation', 'The request body must be a JSON object.');
  for (const key of Object.keys(body))
    if (!DECISION_FIELDS.has(key))
      fail(400, 'validation', `Unknown field: ${key}.`);
  const { decision, evidenceLines } = body;
  if (!DECISIONS.includes(decision as TaDecision))
    fail(400, 'validation', 'decision must be pass or violation.');
  const lines = splitLines(code);
  const numbers = evidenceLines ?? [];
  if (!Array.isArray(numbers))
    fail(400, 'validation', 'evidenceLines must be an array of line numbers.');
  if (numbers.length > MAX_TA_EVIDENCE_LINES)
    fail(
      400,
      'validation',
      `evidenceLines may list at most ${MAX_TA_EVIDENCE_LINES} lines.`,
    );
  const seen = new Set<number>();
  for (const line of numbers as unknown[]) {
    if (
      typeof line !== 'number' ||
      !Number.isInteger(line) ||
      line < 1 ||
      line > lines.length
    )
      fail(
        400,
        'validation',
        `evidenceLines must be integers between 1 and ${lines.length}.`,
      );
    if (seen.has(line))
      fail(400, 'validation', 'evidenceLines must not repeat a line.');
    seen.add(line);
  }
  if (decision === 'violation' && seen.size === 0)
    fail(
      400,
      'validation',
      'A violation needs at least one evidence line of the submitted code.',
    );
  if (decision === 'pass' && seen.size > 0)
    fail(400, 'validation', 'A pass decision takes no evidence lines.');
  const evidence = [...seen]
    .sort((a, b) => a - b)
    .map((line) => ({ line, text: lines[line - 1] ?? '' }));
  return { decision: decision as TaDecision, evidence };
}

export function createReviewQueueModule(
  options: ReviewQueueOptions,
): FastifyPluginAsync {
  const { store } = options;
  return async (scope) => {
    registerApiErrorHandling(scope);
    const identity = createSessionIdentityResolver(store);
    const principals = new WeakMap<FastifyRequest, User>();

    // Authentication, path IDs and role are checked before any body is read.
    scope.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const user = await identity.resolve(request.headers);
      if (!user)
        fail(
          401,
          'unauthenticated',
          'Authentication credentials are invalid or missing.',
        );
      const params = request.params as { labId?: string; itemId?: string };
      try {
        requireId(params.labId ?? params.itemId, 'path ID');
      } catch (error) {
        fail(
          400,
          'validation',
          error instanceof TypeError ? error.message : 'Invalid path ID.',
        );
      }
      if (user.role !== 'TA')
        fail(403, 'forbidden', 'Only a TA of the class may review this lab.');
      principals.set(request, user);
    });

    // A TA of another class gets the same 404 as a missing lab (FAQ-01).
    const labForTa = async (user: User, labId: string): Promise<Lab> => {
      const lab = await store.getLab(labId);
      if (!lab || !(await hasClassRole(store, user, lab.classId, 'TA')))
        return notFound();
      return lab;
    };
    const itemForTa = async (user: User, itemId: string) => {
      const item = await store.getReviewItem(itemId);
      if (!item) return notFound();
      const lab = await labForTa(user, item.labId);
      return { item, lab };
    };

    scope.get<{ Params: { labId: string } }>(
      '/labs/:labId/review-queue',
      async (request) => {
        const lab = await labForTa(
          principals.get(request)!,
          request.params.labId,
        );
        const [state, items, publication] = await Promise.all([
          store.getReviewState(lab.id),
          store.listReviewQueue(lab.id),
          store.getPublication(lab.id),
        ]);
        if (!state) return notFound();
        return {
          labId: lab.id,
          classId: lab.classId,
          published: publication !== undefined,
          publishedAt: publication?.publishedAt ?? null,
          state: stateDto(state),
          items: items.map(itemDto),
        };
      },
    );

    scope.get<{ Params: { itemId: string } }>(
      '/review-items/:itemId',
      async (request) => {
        const { item } = await itemForTa(
          principals.get(request)!,
          request.params.itemId,
        );
        const submission = await store.getSubmission(item.submissionId);
        if (!submission) return notFound();
        return { item: itemDto(item), code: submission.code };
      },
    );

    scope.post<{ Params: { itemId: string } }>(
      '/review-items/:itemId/decision',
      async (request) => {
        const user = principals.get(request)!;
        const { item, lab } = await itemForTa(user, request.params.itemId);
        if (await store.getPublication(lab.id)) return locked();
        const submission = await store.getSubmission(item.submissionId);
        if (!submission) return notFound();
        const { decision, evidence } = readDecision(
          request.body,
          submission.code,
        );
        const updated = await store.decide({
          itemId: item.id,
          decision,
          taId: user.id,
          evidence,
        });
        if (updated) return { item: itemDto(updated) };
        // The lab was published, or the item left the queue, meanwhile.
        if (await store.getPublication(lab.id)) return locked();
        return notFound();
      },
    );

    scope.post<{ Params: { labId: string } }>(
      '/labs/:labId/review-queue/confirm-passes',
      async (request) => {
        const user = principals.get(request)!;
        const lab = await labForTa(user, request.params.labId);
        if (await store.getPublication(lab.id)) return locked();
        const confirmedCount = await store.confirmPasses({
          labId: lab.id,
          taId: user.id,
        });
        // A Publish that committed while this call waited for the lab lock
        // makes the Store confirm nothing; report the lock, not success.
        if (confirmedCount === 0 && (await store.getPublication(lab.id)))
          return locked();
        const state = await store.getReviewState(lab.id);
        if (!state) return notFound();
        return { confirmedCount, state: stateDto(state) };
      },
    );
  };
}

// Without a Store the routes stay absent, as in the PA02 skeleton.
export const reviewQueueModule: FastifyPluginAsync = async () => {};
