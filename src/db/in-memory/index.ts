import { randomUUID } from 'node:crypto';
import type { Store } from '../store.js';
import { createAuthStore } from './auth.js';
import { createJobQueue } from './job-queue.js';
import { createLabStore } from './labs.js';
import { createReviewStore } from './reviews.js';
import {
  buildState,
  emptyState,
  type Context,
  type StoreSeed,
} from './state.js';
import { createSubmissionStore } from './submissions.js';
import { createVerdictStore } from './verdicts.js';

export type { SeedUser, StoreSeed } from './state.js';

export interface InMemoryStoreOptions {
  seed?: StoreSeed;
  clock?: () => Date;
  idGenerator?: () => string;
}

export interface InMemoryStoreFixture {
  store: Store;
  // Setup/test control only. Never expose through the runtime HTTP interface.
  reset(nextSeed?: StoreSeed): void;
}

// Fake Store for unit tests and for tasks that run before Postgres exists.
// Each call owns its own state; nothing is shared between instances.
export function createInMemoryStore(
  options: InMemoryStoreOptions = {},
): InMemoryStoreFixture {
  const clock = options.clock ?? (() => new Date());
  const newId = options.idGenerator ?? (() => randomUUID());
  const readClock = (): number => {
    const ms = clock().getTime();
    if (!Number.isFinite(ms))
      throw new TypeError('Clock returned an invalid date');
    return ms;
  };
  const ctx: Context = {
    state: options.seed ? buildState(options.seed) : emptyState(),
    nowMs: readClock,
    now: () => new Date(readClock()).toISOString(),
    newId,
  };
  const store: Store = {
    ...createAuthStore(ctx),
    ...createLabStore(ctx),
    ...createSubmissionStore(ctx),
    ...createJobQueue(ctx),
    ...createVerdictStore(ctx),
    ...createReviewStore(ctx),
    async close() {},
  };
  return {
    store,
    reset(nextSeed) {
      // buildState throws before anything is replaced, so a bad seed keeps the old state.
      ctx.state = nextSeed ? buildState(nextSeed) : emptyState();
    },
  };
}
