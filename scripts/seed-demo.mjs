import {
  assertDevSeedAllowed,
  createDemoAccounts,
  seedDemoAccounts,
} from '../dist/db/seeds/demo-accounts.js';
import { createPool, migrate } from '../dist/db/postgres/client.js';
import { loadDatabaseUrl } from '../dist/shared/config.js';

// Explicit development seed: fictional accounts use the public demo password
// declared beside the account template. No private JSON file is required.
try {
  if (process.argv.length > 2) throw new Error('Usage: npm run db:seed');
  assertDevSeedAllowed(process.env);
  const pool = createPool(loadDatabaseUrl());
  try {
    await migrate(pool);
    const result = await seedDemoAccounts(pool, createDemoAccounts(), {
      resetPasswords: true,
    });
    console.log(
      `Demo accounts: ${result.added} added, ${result.updated} passwords updated, ${result.skipped} unchanged.`,
    );
  } finally {
    await pool.end();
  }
} catch {
  console.error(
    'Development seed failed. Check database availability, pending migrations and demo ID/username/role conflicts. Database changes were rolled back.',
  );
  process.exitCode = 1;
}
