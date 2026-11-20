import type { AuthStore } from './auth-store.js';
import type { JobQueue } from './job-queue.js';
import type { LabStore } from './lab-store.js';
import type { ReviewStore } from './review-store.js';
import type { SubmissionStore } from './submission-store.js';
import type { VerdictStore } from './verdict-store.js';

// Everything API and worker need. Publish joins in phase 2 when PublishStore
// becomes async and moves onto this store.
export interface Store
  extends
    AuthStore,
    LabStore,
    SubmissionStore,
    JobQueue,
    VerdictStore,
    ReviewStore {
  close(): Promise<void>;
}
