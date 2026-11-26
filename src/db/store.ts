import type { AuthStore } from './auth-store.js';
import type { JobQueue } from './job-queue.js';
import type { LabStore } from './lab-store.js';
import type { PublicationStore } from './publication-store.js';
import type { ReviewStore } from './review-store.js';
import type { SubmissionStore } from './submission-store.js';
import type { VerdictStore } from './verdict-store.js';

// Everything API and worker need, implemented in memory (tests) and on
// Postgres (createPostgresStore).
export interface Store
  extends
    AuthStore,
    LabStore,
    SubmissionStore,
    JobQueue,
    VerdictStore,
    ReviewStore,
    PublicationStore {
  close(): Promise<void>;
}
