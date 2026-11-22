import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../dist/api/app.js';
import { createInMemoryStore } from '../../dist/db/index.js';
import { hashSessionToken } from '../../dist/api/auth/session.js';
import { assertAuthFlow } from '../support/auth-flow.mjs';

test('auth contract: malformed Unicode passwords and invalid display text return 400', async (t) => {
  const { store } = createInMemoryStore();
  const app = createApp({ auth: { store } });
  t.after(() => app.close());
  const input = {
    username: 'unicode.test',
    password: 'test-only-password-value',
    displayName: 'Unicode Test',
  };
  for (const password of [
    'a'.repeat(14) + '\ud800',
    'a'.repeat(14) + '\ud801',
    'a'.repeat(14) + '\udfff',
  ]) {
    for (const [url, payload] of [
      ['/auth/register', { ...input, password }],
      ['/auth/login', { username: input.username, password }],
    ]) {
      const response = await app.inject({ method: 'POST', url, payload });
      assert.equal(response.statusCode, 400, response.body);
      assert.equal(
        response.json().type,
        'https://leetkob.example/problems/validation',
      );
    }
  }
  for (const displayName of ['A\u0000B', 'Name\ud800', '\udfff']) {
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { ...input, displayName },
        })
      ).statusCode,
      400,
    );
  }
  assert.equal(await store.findUserByUsername(input.username), undefined);
  const valid = {
    ...input,
    displayName: 'Nguyễn Văn 😀',
    password: 'Mật khẩu 😀 dành cho test',
  };
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: valid,
      })
    ).statusCode,
    201,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: valid.username, password: valid.password },
      })
    ).statusCode,
    200,
  );
});

test('auth contract: registration, real password login, me, independent sessions and revocation', async (t) => {
  let now = Date.parse('2026-11-21T00:00:00Z');
  const clock = () => new Date(now);
  const { store } = createInMemoryStore({ clock });
  const { token, app } = await assertAuthFlow(store, t, { clock });
  now += 12 * 60 * 60 * 1000;
  const expired = await app.inject({
    url: '/auth/me',
    headers: { authorization: 'Bearer ' + token },
  });
  assert.equal(expired.statusCode, 401);
  assert.equal(expired.headers['www-authenticate'], 'Bearer');
  assert.equal(await store.getSessionUser(hashSessionToken(token)), undefined);
});

test('auth contract: validation, parser, size, media type and safe errors', async (t) => {
  const { store } = createInMemoryStore();
  const app = createApp({ auth: { store } });
  t.after(() => app.close());
  const input = {
    username: 'student',
    password: 'test-only password value',
    displayName: 'Name',
  };
  for (const extra of [
    { role: 'admin' },
    { userId: 'someone' },
    { classId: 'class-1' },
  ]) {
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { ...input, ...extra },
        })
      ).statusCode,
      400,
    );
  }
  for (const [payload, contentType, expected] of [
    ['{', 'application/json', 400],
    ['', 'application/json', 400],
    ['hello', 'text/plain', 415],
    [
      JSON.stringify({ ...input, password: 'x'.repeat(9000) }),
      'application/json',
      413,
    ],
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { 'content-type': contentType },
      payload,
    });
    assert.equal(response.statusCode, expected, response.body);
    assert.match(
      response.headers['content-type'],
      /application\/problem\+json/,
    );
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: input,
      })
    ).statusCode,
    201,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { ...input, username: 'STUDENT' },
      })
    ).statusCode,
    409,
  );
  const login = async (username) =>
    app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username, password: 'wrong' },
    });
  assert.deepEqual(
    (await login('student')).json(),
    (await login('unknown')).json(),
  );
  assert.equal((await app.inject('/auth/me?token=anything')).statusCode, 401);
  assert.equal(
    (await app.inject({ method: 'POST', url: '/auth/logout' })).statusCode,
    401,
  );
});

test('auth contract: database failures and malformed stored hashes are sanitized', async (t) => {
  for (const [code, expected] of [
    ['ECONNREFUSED', 503],
    ['XX000', 500],
  ]) {
    const { store } = createInMemoryStore();
    store.findUserByUsername = async () => {
      throw Object.assign(new Error('private connection string'), { code });
    };
    const app = createApp({ auth: { store } });
    t.after(() => app.close());
    const result = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'student', password: 'test' },
    });
    assert.equal(result.statusCode, expected);
    assert.doesNotMatch(result.body, /private|connection string/);
  }
  const { store } = createInMemoryStore();
  await store.createStudent({
    username: 'student',
    displayName: 'Name',
    passwordHash: 'bad-hash',
  });
  const app = createApp({ auth: { store } });
  t.after(() => app.close());
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'student', password: 'test' },
      })
    ).statusCode,
    500,
  );
});

test('auth contract: concurrent login failures are limited before verification', async (t) => {
  const { store } = createInMemoryStore();
  let calls = 0;
  const service = {
    hash: async () => 'not-used',
    verify: async () => {
      calls++;
      return false;
    },
  };
  const app = createApp({ auth: { store, passwords: service } });
  t.after(() => app.close());
  const results = await Promise.all(
    Array.from({ length: 11 }, () =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'student', password: 'test' },
      }),
    ),
  );
  assert.equal(calls, 10);
  assert.equal(
    results.filter((response) => response.statusCode === 429).length,
    1,
  );
  assert.ok(
    results.find((response) => response.statusCode === 429).headers[
      'retry-after'
    ],
  );
});

test('auth contract: infrastructure errors release failed-login reservations', async (t) => {
  const { store } = createInMemoryStore();
  store.findUserByUsername = async () => {
    throw Object.assign(new Error('unavailable'), { code: 'ECONNREFUSED' });
  };
  const app = createApp({ auth: { store } });
  t.after(() => app.close());
  for (let index = 0; index < 11; index++) {
    const result = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'student', password: 'test' },
    });
    assert.equal(result.statusCode, 503);
  }
});
