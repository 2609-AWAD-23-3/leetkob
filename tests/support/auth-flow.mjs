import assert from 'node:assert/strict';
import { createApp } from '../../dist/api/app.js';

export async function assertAuthFlow(store, t, extra = {}) {
  const app = createApp({ auth: { store, ...extra } });
  t.after(() => app.close());
  const password = '  test-only registration password  ';
  const register = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { username: ' New.Student ', password, displayName: ' Student ' },
  });
  assert.equal(register.statusCode, 201, register.body);
  assert.equal(register.json().user.role, 'student');
  assert.equal(register.json().user.username, 'new.student');
  const userId = register.json().user.id;
  const login = async () =>
    app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'NEW.STUDENT', password },
    });
  const first = await login();
  assert.equal(first.statusCode, 200, first.body);
  const second = await login();
  assert.equal(second.statusCode, 200);
  assert.notEqual(first.json().accessToken, second.json().accessToken);
  const headers = { authorization: 'Bearer ' + first.json().accessToken };
  const me = await app.inject({ url: '/auth/me', headers });
  assert.equal(me.statusCode, 200);
  assert.deepEqual(me.json(), { user: register.json().user, memberships: [] });
  assert.equal(me.headers['cache-control'], 'no-store');
  assert.equal(
    (await app.inject({ method: 'POST', url: '/auth/logout', headers }))
      .statusCode,
    204,
  );
  assert.equal(
    (await app.inject({ method: 'POST', url: '/auth/logout', headers }))
      .statusCode,
    204,
  );
  assert.equal(
    (await app.inject({ url: '/auth/me', headers })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: '/auth/me',
        headers: { authorization: 'Bearer ' + second.json().accessToken },
      })
    ).statusCode,
    200,
  );
  assert.equal('passwordHash' in register.json().user, false);
  return { userId, token: second.json().accessToken, app };
}
