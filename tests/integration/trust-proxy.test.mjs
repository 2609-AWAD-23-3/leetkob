import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../dist/api/app.js';
import { createInMemoryStore, createStoreSeed } from '../../dist/db/index.js';
import { loadTrustProxy } from '../../dist/shared/config.js';
import { passwords } from '../../dist/shared/passwords.js';

const TEST_PASSWORD = 'proxy-test-password-123';

test('loadTrustProxy defaults to false, rejects unsafe values and parses valid IP/CIDR lists', () => {
  assert.equal(loadTrustProxy({}), false);
  assert.equal(loadTrustProxy({ TRUST_PROXY: '' }), false);
  assert.equal(loadTrustProxy({ TRUST_PROXY: 'false' }), false);

  for (const unsafe of [
    'true',
    '*',
    '0.0.0.0/0',
    '::/0',
    'not-an-ip',
    '127.0.0.1/33',
    '2001:db8::/129',
    '172.16.0.1,',
  ]) {
    assert.throws(() => loadTrustProxy({ TRUST_PROXY: unsafe }), Error);
  }

  assert.deepEqual(
    loadTrustProxy({ TRUST_PROXY: '127.0.0.1, 172.28.0.0/24' }),
    ['127.0.0.1', '172.28.0.0/24'],
  );
  assert.deepEqual(loadTrustProxy({ TRUST_PROXY: '::1, fc00::/7' }), [
    '::1',
    'fc00::/7',
  ]);
});

async function startAuthServer(t, trustProxy) {
  const seed = createStoreSeed();
  const hash = await passwords.hash(TEST_PASSWORD);
  for (const user of seed.users) {
    user.passwordHash = hash;
  }
  const { store } = createInMemoryStore({ seed });
  const app = createApp({
    auth: { store },
    trustProxy,
  });
  t.after(() => app.close());
  return await app.listen({ host: '127.0.0.1', port: 0 });
}

async function postFailedLogin(baseUrl, forwardedFor) {
  return fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
    },
    body: JSON.stringify({
      username: 'student1',
      password: 'wrong-password-for-rate-limit-check',
    }),
  });
}

test('trusted reverse proxy isolates rate-limit IP buckets across X-Forwarded-For clients', async (t) => {
  const baseUrl = await startAuthServer(t, ['127.0.0.1']);

  for (let i = 0; i < 10; i++) {
    const res = await postFailedLogin(baseUrl, '203.0.113.10');
    assert.equal(res.status, 401);
  }
  const blockedFirst = await postFailedLogin(baseUrl, '203.0.113.10');
  assert.equal(blockedFirst.status, 429);

  // Second client behind the trusted proxy keeps its own bucket.
  const secondClient = await postFailedLogin(baseUrl, '203.0.113.20');
  assert.equal(secondClient.status, 401);
});

test('untrusted direct client cannot spoof X-Forwarded-For to bypass IP bucket', async (t) => {
  // Only 10.99.0.1 is trusted; requests coming directly from 127.0.0.1 must ignore X-Forwarded-For.
  const baseUrl = await startAuthServer(t, ['10.99.0.1']);

  for (let i = 0; i < 10; i++) {
    const res = await postFailedLogin(baseUrl, `203.0.113.${i + 1}`);
    assert.equal(res.status, 401);
  }
  const spoofedAttempt = await postFailedLogin(baseUrl, '203.0.113.250');
  assert.equal(spoofedAttempt.status, 429);
});
