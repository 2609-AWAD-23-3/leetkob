import type {
  Evidence,
  ReviewDecisionLog,
  ReviewItem,
  TaDecision,
} from '../shared/domain/index.js';
import type { ReviewState } from './types.js';

// Used by PA03-T09. The review queue holds every verdict of the counted,
// Accepted submissions of a lab (PA03 has no 10% pass sampling yet).
export interface ReviewStore {
  listReviewQueue(labId: string): Promise<ReviewItem[]>;
  getReviewItem(itemId: string): Promise<ReviewItem | undefined>;
  // undefined when the lab is unknown. pendingCount also counts counted
  // submissions that are not judged yet ('queued', 'judging', 'failed') and
  // missing verdicts, so Publish waits for the whole pipeline.
  getReviewState(labId: string): Promise<ReviewState | undefined>;
  // Sets or changes the TA decision and logs every change of decision,
  // evidence or reviewer (FAQ-10). The reviewer must be an existing user and
  // evidence must be valid { line >= 1, text } items, otherwise TypeError.
  // undefined when the item is not in the current review queue.
  decide(input: {
    itemId: string;
    decision: TaDecision;
    taId: string;
    evidence?: Evidence[];
  }): Promise<ReviewItem | undefined>;
  // Confirms every unreviewed 'pass' verdict of the lab; returns the count.
  confirmPasses(input: { labId: string; taId: string }): Promise<number>;
  listDecisionLog(itemId: string): Promise<ReviewDecisionLog[]>;
}
