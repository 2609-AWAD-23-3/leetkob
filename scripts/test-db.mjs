import { spawnSync } from 'node:child_process';

// Runs the Postgres store tests. Needs a disposable database in
// TEST_DATABASE_URL (see docker/compose.postgres.yml); fails instead of
// silently skipping when it is missing.
if (!process.env.TEST_DATABASE_URL) {
  console.error(
    'TEST_DATABASE_URL is not set. Start docker/compose.postgres.yml and set it, for example\n' +
      'TEST_DATABASE_URL=postgres://leetkob:leetkob_local@127.0.0.1:5433/leetkob',
  );
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-reporter=tap',
    '--test-concurrency=1',
    'tests/integration/postgres-store.test.mjs',
    'tests/integration/worker-postgres.test.mjs',
  ],
  { stdio: 'inherit' },
);
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
