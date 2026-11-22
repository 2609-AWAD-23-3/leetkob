import { randomUUID } from 'node:crypto';
import { buildState, type StoreSeed } from '../in-memory/state.js';
import type { Store } from '../store.js';
import { createAuthStore } from './auth.js';
import {
  createPool,
  migrate,
  transaction,
  type PostgresContext,
  type Queryable,
} from './client.js';
import { createJobQueue } from './job-queue.js';
import { createLabStore, insertLab } from './labs.js';
import { createReviewStore } from './reviews.js';
import { createSubmissionStore } from './submissions.js';
import { createVerdictStore } from './verdicts.js';

export { migrate } from './client.js';

export interface PostgresStoreOptions {
  connectionString: string;
  // Optional schema for an isolated test database; created if missing.
  schema?: string;
  seed?: StoreSeed;
  clock?: () => Date;
  idGenerator?: () => string;
}

export interface PostgresStoreFixture {
  store: Store;
  // Resolves once migrations (and the seed) are applied. Every store call
  // also waits for it, so callers may start using the store right away.
  ready: Promise<void>;
  // Setup/test control only: empties every table, then loads nextSeed.
  // Never expose through the runtime HTTP interface.
  reset(nextSeed?: StoreSeed): Promise<void>;
}

const TABLES = [
  'submission_intake_requests',
  'lab_creation_requests',
  'review_decisions',
  'model_calls',
  'verdicts',
  'jobs',
  'submissions',
  'publications',
  'lab_constraints',
  'lab_tests',
  'labs',
  'sessions',
  'class_memberships',
  'classes',
  'users',
];

async function loadSeed(db: Queryable, seed: StoreSeed): Promise<void> {
  // buildState applies the same seed validation as the in-memory store.
  const state = buildState(seed);
  for (const user of state.users.values()) {
    await db.query(
      `INSERT INTO users (id, username, display_name, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.username, user.displayName, user.role, user.passwordHash],
    );
  }
  for (const classRoom of state.classes.values()) {
    await db.query('INSERT INTO classes (id, name) VALUES ($1, $2)', [
      classRoom.id,
      classRoom.name,
    ]);
  }
  for (const membership of state.memberships.values()) {
    await db.query(
      'INSERT INTO class_memberships (user_id, class_id, role) VALUES ($1, $2, $3)',
      [membership.userId, membership.classId, membership.role],
    );
  }
  for (const lab of state.labs.values()) await insertLab(db, lab);
}

// Store on Postgres. Run migrations first (npm run db:migrate) or let the
// store apply them on start, as it does here.
export function createPostgresStore(
  options: PostgresStoreOptions,
): PostgresStoreFixture {
  const pool = createPool(options.connectionString, options.schema);
  const clock = options.clock ?? (() => new Date());
  const readClock = (): number => {
    const ms = clock().getTime();
    if (!Number.isFinite(ms))
      throw new TypeError('Clock returned an invalid date');
    return ms;
  };
  // Validate the seed before touching the database.
  if (options.seed) buildState(options.seed);

  const setup = async (): Promise<void> => {
    await migrate(pool, options.schema);
    if (options.seed) {
      const seed = options.seed;
      await transaction(pool, (client) => loadSeed(client, seed));
    }
  };
  const ready = setup();
  ready.catch(() => {}); // surfaced by the first store call instead

  let closed = false;
  const ctx: PostgresContext = {
    pool,
    ready,
    nowMs: readClock,
    now: () => new Date(readClock()).toISOString(),
    newId: options.idGenerator ?? (() => randomUUID()),
  };
  const store: Store = {
    ...createAuthStore(ctx),
    ...createLabStore(ctx),
    ...createSubmissionStore(ctx),
    ...createJobQueue(ctx),
    ...createVerdictStore(ctx),
    ...createReviewStore(ctx),
    // Safe to call more than once.
    async close() {
      if (closed) return;
      closed = true;
      await ready.catch(() => {});
      await pool.end();
    },
  };
  return {
    store,
    ready,
    async reset(nextSeed) {
      await ready;
      if (nextSeed) buildState(nextSeed); // validate before deleting anything
      await transaction(pool, async (client) => {
        await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY`);
        if (nextSeed) await loadSeed(client, nextSeed);
      });
    },
  };
}
