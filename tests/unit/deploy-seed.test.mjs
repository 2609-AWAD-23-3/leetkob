import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDevSeedAllowed,
  DEMO_PASSWORD,
} from '../../dist/db/seeds/demo-accounts.js';
import {
  DEPLOY_CLASSES,
  deployMemberships,
  loadDeploySeedAccounts,
} from '../../dist/db/seeds/deploy-accounts.js';

function makeValidDeployEnv(overrides = {}) {
  return {
    DEPLOY_ADMIN_PASSWORD: 'admin-strong-deploy-pass-1',
    DEPLOY_TA1_PASSWORD: 'ta1-strong-deploy-pass-2',
    DEPLOY_TA2_PASSWORD: 'ta2-strong-deploy-pass-3',
    DEPLOY_STUDENT1_PASSWORD: 'student1-strong-deploy-pass-4',
    DEPLOY_STUDENT2_PASSWORD: 'student2-strong-deploy-pass-5',
    ...overrides,
  };
}

test('assertDevSeedAllowed blocks production environments and explicit opt-out', () => {
  assert.doesNotThrow(() => assertDevSeedAllowed({}));
  assert.doesNotThrow(() =>
    assertDevSeedAllowed({ NODE_ENV: 'development', ALLOW_DEV_SEED: '1' }),
  );
  assert.throws(() => assertDevSeedAllowed({ NODE_ENV: 'production' }), Error);
  assert.throws(
    () => assertDevSeedAllowed({ LEETKOB_ENV: 'production' }),
    Error,
  );
  assert.throws(() => assertDevSeedAllowed({ ALLOW_DEV_SEED: '0' }), Error);
  assert.throws(() => assertDevSeedAllowed({ ALLOW_DEV_SEED: 'false' }), Error);
});

test('loadDeploySeedAccounts builds exactly 5 isolated PA03 accounts without dev credentials', () => {
  const accounts = loadDeploySeedAccounts(makeValidDeployEnv());
  assert.equal(accounts.length, 5);
  assert.deepEqual(
    accounts.map((u) => [u.id, u.username, u.role]),
    [
      ['pa3-admin', 'pa3.admin', 'admin'],
      ['pa3-ta1', 'pa3.ta1', 'TA'],
      ['pa3-ta2', 'pa3.ta2', 'TA'],
      ['pa3-student1', 'pa3.student1', 'student'],
      ['pa3-student2', 'pa3.student2', 'student'],
    ],
  );
  assert.equal(DEPLOY_CLASSES.length, 2);
  assert.equal(deployMemberships().length, 4);
});

test('loadDeploySeedAccounts rejects missing, short or dev password123', () => {
  assert.throws(
    () =>
      loadDeploySeedAccounts(
        makeValidDeployEnv({ DEPLOY_ADMIN_PASSWORD: DEMO_PASSWORD }),
      ),
    Error,
  );
  assert.throws(
    () =>
      loadDeploySeedAccounts(
        makeValidDeployEnv({ DEPLOY_TA1_PASSWORD: 'too-short-pass' }),
      ),
    Error,
  );
  assert.throws(
    () =>
      loadDeploySeedAccounts(
        makeValidDeployEnv({ DEPLOY_STUDENT1_PASSWORD: '' }),
      ),
    Error,
  );
});
