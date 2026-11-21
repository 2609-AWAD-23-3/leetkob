import type { Publication, PublishResult } from './types.js';

// Publish operations of the async Store, with the same semantics and result
// kinds as the PA02 PublishStore (docs/architecture/data-model.md):
// lab_not_found -> already_published (no clock read) -> before_deadline
// (now < deadline) -> pending_reviews -> published. The PA02 synchronous
// PublishStore and the HTTP route stay as they are until PA03-T09 points the
// route at this store; contract v1 is unchanged.
export interface PublicationStore {
  isTaAssignedToClass(taId: string, classId: string): Promise<boolean>;
  getPublication(labId: string): Promise<Publication | undefined>;
  // pendingCount comes from ReviewStore.getReviewState, so every unreviewed
  // verdict (pass included) and every unfinished counted submission blocks
  // publication. publishedBy must be an existing user, otherwise TypeError.
  // After publication, decide returns undefined and confirmPasses returns 0.
  publishLab(input: {
    labId: string;
    publishedBy: string;
  }): Promise<PublishResult>;
}
