import pg from 'pg';
import { migrate } from '../dist/db/postgres/index.js';

// Applies pending migrations to DATABASE_URL (local, CI or the deployment).
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const applied = await migrate(pool);
  console.log(
    applied.length > 0
      ? `Applied migrations: ${applied.join(', ')}`
      : 'Database is up to date.',
  );
} finally {
  await pool.end();
}
