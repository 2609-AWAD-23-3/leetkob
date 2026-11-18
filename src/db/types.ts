export type Verdict = 'pass' | 'violation' | 'unsure';
export type TaDecision = 'pass' | 'violation';

export interface Lab {
  id: string;
  classId: string;
  deadline: string;
}

export interface TaClassMembership {
  taId: string;
  classId: string;
}

// Only the current queue for counted submissions, not all model verdicts.
export interface ReviewQueueItem {
  id: string;
  labId: string;
  submissionId: string;
  constraintId: string;
  verdict: Verdict;
  taDecision: TaDecision | null;
}

export interface PublicationSummary {
  queueItemCount: number;
  passDecisionCount: number;
  violationDecisionCount: number;
}

export interface ReviewState extends PublicationSummary {
  pendingCount: number;
}

export interface Publication {
  labId: string;
  publishedAt: string;
  publishedBy: string;
  summary: PublicationSummary;
}

export interface SeedState {
  labs: readonly Lab[];
  memberships: readonly TaClassMembership[];
  queueItems: readonly ReviewQueueItem[];
  publications: readonly Publication[];
}

export type PublishResult =
  | { kind: 'lab_not_found' }
  | { kind: 'already_published'; publication: Publication }
  | { kind: 'before_deadline'; deadline: string }
  | { kind: 'pending_reviews'; pendingCount: number }
  | { kind: 'published'; publication: Publication };

// Authorization is the caller's responsibility; publishedBy is a trusted principal ID.
export interface PublishStore {
  getLab(labId: string): Lab | undefined;
  isTaAssignedToClass(taId: string, classId: string): boolean;
  getReviewState(labId: string): ReviewState | undefined;
  getPublication(labId: string): Publication | undefined;
  publishLab(input: { labId: string; publishedBy: string }): PublishResult;
}

export interface InMemoryPublishStoreOptions {
  initialState?: SeedState;
  clock?: () => Date;
}

export interface PublishStoreFixture {
  store: PublishStore;
  // Setup/test control only. Never expose through the runtime HTTP interface.
  reset(nextState?: SeedState): void;
}
