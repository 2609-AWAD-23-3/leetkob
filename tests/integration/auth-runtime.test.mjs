import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createRuntimeApp } from '../../dist/api/runtime.js';
import { loadDatabaseUrl } from '../../dist/shared/config.js';
import { createInMemoryStore } from '../../dist/db/index.js';

test('runtime requires a database URL and closes failed initialization without exposing details', async () => {
  assert.throws(() => loadDatabaseUrl({}), /DATABASE_URL is required/);
  assert.throws(
    () => loadDatabaseUrl({ DATABASE_URL: 'secret-invalid-value' }),
    /PostgreSQL connection URL/,
  );
  let called = false;
  await assert.rejects(
    createRuntimeApp({}, () => {
      called = true;
    }),
    /DATABASE_URL/,
  );
  assert.equal(called, false);
  let closed = 0;
  const { store } = createInMemoryStore();
  store.close = async () => {
    closed++;
  };
  await assert.rejects(
    createRuntimeApp({ DATABASE_URL: 'postgres://localhost/demo' }, () => ({
      store,
      ready: Promise.reject(new Error('private database password')),
      reset: async () => {},
    })),
    (error) => {
      assert.doesNotMatch(error.message, /private|password/);
      return true;
    },
  );
  assert.equal(closed, 1);
});

test('runtime waits for readiness, mounts auth and releases its Store on close', async () => {
  let closed = 0;
  let ready;
  const { store } = createInMemoryStore();
  store.close = async () => {
    closed++;
  };
  const starting = createRuntimeApp(
    { DATABASE_URL: 'postgres://localhost/demo' },
    () => ({
      store,
      ready: new Promise((resolve) => {
        ready = resolve;
      }),
      reset: async () => {},
    }),
  );
  let finished = false;
  starting.then(() => {
    finished = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  ready();
  const app = await starting;
  assert.equal(app.server.listening, false);
  try {
    assert.equal((await app.inject('/auth/me')).statusCode, 401);
  } finally {
    await app.close();
  }
  assert.equal(closed, 1);
});

test('application logger redacts authorization and request bodies', () => {
  const source = `
    import { createApp } from './dist/api/app.js';
    const app = createApp({ logger: true });
    app.log.info({ req: { method: 'POST', url: '/auth/login', headers: { authorization: 'SENTINEL-TOKEN' }, body: { password: 'SENTINEL-PASSWORD' } } });
    await app.close();
  `;
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', source],
    {
      cwd: new URL('../../', import.meta.url),
      encoding: 'utf8',
      timeout: 5000,
    },
  );
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.ok(child.stdout.length > 0);
  assert.doesNotMatch(
    child.stdout + child.stderr,
    /SENTINEL-TOKEN|SENTINEL-PASSWORD/,
  );
});
