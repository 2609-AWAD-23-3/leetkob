import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestApp } from './app.mjs';

test('support bootstrap owns cleanup and isolates plugin state between apps', async (t) => {
  let closes = 0;
  await t.test(
    'first app registers an instance-only route and closes',
    async (child) => {
      const app = await createTestApp(child, {
        modules: {
          publish: async (scope) => {
            scope.get('/support-only', async () => ({ ok: true }));
            scope.addHook('onClose', async () => {
              closes += 1;
            });
          },
        },
      });
      assert.equal((await app.inject('/support-only')).statusCode, 200);
      assert.equal(app.server.listening, false);
    },
  );
  assert.equal(closes, 1);
  const fresh = await createTestApp(t);
  assert.equal((await fresh.inject('/support-only')).statusCode, 404);
});
