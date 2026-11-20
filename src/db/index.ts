export type {
  InMemoryPublishStoreOptions,
  Lab,
  Publication,
  PublicationSummary,
  PublishResult,
  PublishStore,
  PublishStoreFixture,
  ReviewQueueItem,
  ReviewState,
  SeedState,
  TaClassMembership,
  TaDecision,
  Verdict,
} from './types.js';
export { createInMemoryPublishStore } from './in-memory-publish-store.js';
// PA03-T03: async Store interfaces and the in-memory fake.
// Domain types live in src/shared/domain/.
export type { AuthStore, UserCredentials } from './auth-store.js';
export type { JobQueue } from './job-queue.js';
export type { LabStore } from './lab-store.js';
export type { PublicationStore } from './publication-store.js';
// The Postgres implementation lives in ./postgres/index.js (createPostgresStore,
// migrate) so code that only needs the in-memory fake does not load `pg`.
export type { ReviewStore } from './review-store.js';
export type { Store } from './store.js';
export type { SubmissionStore } from './submission-store.js';
export type { VerdictStore } from './verdict-store.js';
export {
  createInMemoryStore,
  type InMemoryStoreFixture,
  type InMemoryStoreOptions,
  type SeedUser,
  type StoreSeed,
} from './in-memory/index.js';
export {
  createStoreSeed,
  STORE_FIXTURE_CREATED_AT,
  STORE_FIXTURE_OPENS_AT,
} from './in-memory/seed.js';
export {
  createFixedClock,
  createPublishSeed,
  FIXTURE_AFTER_DEADLINE,
  FIXTURE_DEADLINE,
} from './fixtures.js';
