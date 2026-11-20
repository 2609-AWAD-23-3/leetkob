import type { Lab, ReviewItem, TaDecision } from '../../shared/domain/index.js';
import type { ReviewStore } from '../review-store.js';
import {
  copyEvidence,
  sameEvidence,
  validateEvidenceList,
} from '../validation.js';
import {
  clone,
  key,
  requireId,
  type Context,
  type State,
  type StoredSubmission,
  type StoredVerdict,
} from './state.js';
import { countedSubmissions } from './submissions.js';

function isReviewable(submission: StoredSubmission): boolean {
  return (
    submission.status === 'judged' && submission.judgeResult?.verdict === 'AC'
  );
}

// Verdicts of the counted, Accepted submissions, in submission then constraint order.
function queueVerdicts(state: State, lab: Lab): StoredVerdict[] {
  const result: StoredVerdict[] = [];
  for (const submission of countedSubmissions(state, lab.id)) {
    if (!isReviewable(submission)) continue;
    for (const constraint of lab.constraints) {
      const id = state.verdictIdsByPair.get(key(submission.id, constraint.id));
      const verdict = id === undefined ? undefined : state.verdicts.get(id);
      if (verdict) result.push(verdict);
    }
  }
  return result;
}

function toReviewItem(
  state: State,
  lab: Lab,
  verdict: StoredVerdict,
): ReviewItem {
  const submission = state.submissions.get(verdict.submissionId);
  const constraint = lab.constraints.find((c) => c.id === verdict.constraintId);
  if (!submission || !constraint)
    throw new TypeError('Verdict refers to missing data');
  return {
    id: verdict.id,
    labId: lab.id,
    studentId: submission.studentId,
    submissionId: verdict.submissionId,
    constraintId: verdict.constraintId,
    constraintText: constraint.text,
    deduction: constraint.deduction,
    verdict: verdict.verdict,
    evidence: clone(verdict.evidence),
    unsureCause: verdict.unsureCause,
    reason: verdict.reason,
    source: verdict.source,
    createdAt: verdict.createdAt,
    taDecision: verdict.taDecision,
    taEvidence: clone(verdict.taEvidence),
    reviewedBy: verdict.reviewedBy,
    reviewedAt: verdict.reviewedAt,
  };
}

// Returns the lab and the stored verdict when the item is in the current queue.
function findQueueItem(
  state: State,
  itemId: string,
): { lab: Lab; verdict: StoredVerdict } | undefined {
  const verdict = state.verdicts.get(itemId);
  const submission = verdict
    ? state.submissions.get(verdict.submissionId)
    : undefined;
  const lab = submission ? state.labs.get(submission.labId) : undefined;
  if (!verdict || !lab) return undefined;
  const inQueue = queueVerdicts(state, lab).some((v) => v.id === verdict.id);
  return inQueue ? { lab, verdict } : undefined;
}

// Same rule as a foreign key to users: the reviewer must exist. Whether the
// user may review this lab (TA of the class) is checked by the API.
function requireReviewer(ctx: Context, taId: string): void {
  requireId(taId, 'taId');
  if (!ctx.state.users.has(taId)) throw new TypeError('Unknown reviewer');
}

function applyDecision(
  ctx: Context,
  verdict: StoredVerdict,
  decision: TaDecision,
  taId: string,
  evidence: StoredVerdict['taEvidence'],
): void {
  const changedAt = ctx.now();
  // Evidence is compared by line and text, so key order does not matter.
  const unchanged =
    verdict.taDecision === decision &&
    verdict.reviewedBy === taId &&
    sameEvidence(verdict.taEvidence, evidence);
  // Log every change of decision, evidence or reviewer (FAQ-10); an
  // identical repeat changes nothing and is not logged.
  if (unchanged) return;
  ctx.state.decisionLog.push({
    itemId: verdict.id,
    changedBy: taId,
    changedAt,
    previous: verdict.taDecision,
    next: decision,
    evidence: copyEvidence(evidence),
  });
  verdict.taDecision = decision;
  verdict.taEvidence = copyEvidence(evidence);
  verdict.reviewedBy = taId;
  verdict.reviewedAt = changedAt;
}

export function createReviewStore(ctx: Context): ReviewStore {
  return {
    async listReviewQueue(labId) {
      const lab = ctx.state.labs.get(labId);
      if (!lab) return [];
      return queueVerdicts(ctx.state, lab).map((v) =>
        toReviewItem(ctx.state, lab, v),
      );
    },

    async getReviewItem(itemId) {
      const found = findQueueItem(ctx.state, itemId);
      return found
        ? toReviewItem(ctx.state, found.lab, found.verdict)
        : undefined;
    },

    async getReviewState(labId) {
      const lab = ctx.state.labs.get(labId);
      if (!lab) return undefined;
      const items = queueVerdicts(ctx.state, lab);
      let unfinished = 0;
      for (const submission of countedSubmissions(ctx.state, labId)) {
        if (submission.status !== 'judged') {
          unfinished += 1; // queued, judging or failed
        } else if (isReviewable(submission)) {
          for (const constraint of lab.constraints) {
            if (
              !ctx.state.verdictIdsByPair.has(key(submission.id, constraint.id))
            )
              unfinished += 1; // a verdict the pipeline has not produced
          }
        }
      }
      const pass = items.filter((v) => v.taDecision === 'pass').length;
      const violation = items.filter(
        (v) => v.taDecision === 'violation',
      ).length;
      return {
        queueItemCount: items.length,
        passDecisionCount: pass,
        violationDecisionCount: violation,
        pendingCount: items.length - pass - violation + unfinished,
      };
    },

    async decide({ itemId, decision, taId, evidence }) {
      requireReviewer(ctx, taId);
      if (decision !== 'pass' && decision !== 'violation')
        throw new TypeError('decision must be pass or violation');
      if (evidence !== undefined) validateEvidenceList(evidence, 'evidence');
      const found = findQueueItem(ctx.state, itemId);
      if (!found) return undefined;
      applyDecision(ctx, found.verdict, decision, taId, evidence ?? []);
      return toReviewItem(ctx.state, found.lab, found.verdict);
    },

    async confirmPasses({ labId, taId }) {
      requireReviewer(ctx, taId);
      const lab = ctx.state.labs.get(labId);
      if (!lab) return 0;
      let count = 0;
      for (const verdict of queueVerdicts(ctx.state, lab)) {
        if (verdict.verdict !== 'pass' || verdict.taDecision !== null) continue;
        applyDecision(ctx, verdict, 'pass', taId, []);
        count += 1;
      }
      return count;
    },

    async listDecisionLog(itemId) {
      return ctx.state.decisionLog
        .filter((entry) => entry.itemId === itemId)
        .map(clone);
    },
  };
}
