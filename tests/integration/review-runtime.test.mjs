import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntimeApp } from '../../dist/api/runtime.js';
import { createInMemoryStore, createStoreSeed } from '../../dist/db/index.js';

// The deployed app must mount the review queue and Publish on the real Store,
// not leave them absent (404) as the PA02 skeleton did.
test('runtime mounts the review queue and Publish on the Store with session auth', async () => {
  const { store } = createInMemoryStore({ seed: createStoreSeed() });
  const app = await createRuntimeApp(
    { DATABASE_URL: 'postgres://localhost/demo' },
    () => ({ store, ready: Promise.resolve(), reset: async () => {} }),
  );
  try {
    for (const [method, url] of [
      ['GET', '/labs/lab-sort/review-queue'],
      ['GET', '/review-items/item-1'],
      ['POST', '/review-items/item-1/decision'],
      ['POST', '/labs/lab-sort/review-queue/confirm-passes'],
      ['POST', '/labs/lab-sort/publish'],
    ]) {
      const response = await app.inject({ method, url });
      assert.equal(response.statusCode, 401, `${method} ${url}`);
      assert.equal(response.headers['www-authenticate'], 'Bearer');
    }
  } finally {
    await app.close();
  }
});
