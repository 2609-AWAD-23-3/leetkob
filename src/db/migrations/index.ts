// Ordered schema migrations. Each runs once, in a transaction, and is
// recorded in schema_migrations. Never edit a migration that has been
// merged; add a new one instead.
//
// Timestamps are written from the store clock (ISO strings), not now(), so
// tests stay deterministic. CHECK constraints mirror src/db/validation.ts so
// both Store implementations reject the same values.

import type { Migration } from './types.js';
import { migration0001 } from './0001_init.js';
import { migration0002 } from './0002_model_call_metrics.js';
import { migration0003 } from './0003_normalized_username.js';

export type { Migration } from './types.js';
export const MIGRATIONS: readonly Migration[] = [
  migration0001,
  migration0002,
  migration0003,
];
