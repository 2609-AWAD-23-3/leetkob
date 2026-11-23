import {
  loadDeploySeedAccounts,
  seedDeployAccounts,
} from '../dist/db/seeds/deploy-accounts.js';
import { createPool, migrate } from '../dist/db/postgres/client.js';
import { loadDatabaseUrl } from '../dist/shared/config.js';

const confirmed =
  process.argv.includes('--confirm-deploy-seed') ||
  process.env.CONFIRM_DEPLOY_SEED === '1';

try {
  if (!confirmed) {
    throw new Error(
      'Pass --confirm-deploy-seed or set CONFIRM_DEPLOY_SEED=1 to seed the 5 deployment accounts.',
    );
  }
  const accounts = loadDeploySeedAccounts(process.env);
  const pool = createPool(loadDatabaseUrl());
  try {
    await migrate(pool);
    const result = await seedDeployAccounts(pool, accounts, {
      resetPasswords: true,
    });
    console.log(
      `Deploy accounts: ${result.added} added, ${result.updated} passwords updated, ${result.skipped} unchanged.`,
    );
  } finally {
    await pool.end();
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'Deployment seed failed. Database changes were rolled back.',
  );
  process.exitCode = 1;
}
