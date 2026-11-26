import pg from 'pg';
import { MIGRATIONS } from '../migrations/index.js';

export type Queryable = pg.Pool | pg.PoolClient;

export interface PostgresContext {
  pool: pg.Pool;
  ready: Promise<void>; // migrations (and seed) applied
  now(): string;
  nowMs(): number;
  newId(): string;
}

// Identifier for an optional per-fixture schema (tests); never user input.
const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

export function createPool(connectionString: string, schema?: string): pg.Pool {
  if (schema !== undefined && !SCHEMA_PATTERN.test(schema))
    throw new TypeError('schema must be a lowercase SQL identifier');
  const pool = new pg.Pool({
    connectionString,
    max: 4,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
    ...(schema === undefined ? {} : { options: `-c search_path=${schema}` }),
  });
  // pg removes failed idle clients itself. A listener prevents EventEmitter's
  // unhandled-error process exit; never print raw DB errors/connection details.
  pool.on('error', () => {
    console.error(
      'An idle PostgreSQL connection was lost; the pool will reconnect on demand.',
    );
  });
  return pool;
}

// Runs fn in one transaction on one connection; rolls back on any error.
export async function transaction<T>(
  pool: pg.Pool,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Applies every migration that has not run yet, in order.
export async function migrate(
  pool: pg.Pool,
  schema?: string,
): Promise<string[]> {
  if (schema !== undefined && !SCHEMA_PATTERN.test(schema))
    throw new TypeError('schema must be a lowercase SQL identifier');
  await transaction(pool, async (client) => {
    // A database-wide transaction lock also protects first-time schema and
    // metadata creation, before there is a table we can lock.
    await client.query('SELECT pg_advisory_xact_lock(1279608148, 3)');
    if (schema !== undefined)
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
  });
  const applied: string[] = [];
  for (const migration of MIGRATIONS) {
    await transaction(pool, async (client) => {
      // Serialise concurrent migrators on the same database.
      await client.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
      const done = await client.query(
        'SELECT 1 FROM schema_migrations WHERE id = $1',
        [migration.id],
      );
      if (done.rowCount) return;
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [
        migration.id,
      ]);
      applied.push(migration.id);
    });
  }
  return applied;
}

export function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function isoRequired(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
