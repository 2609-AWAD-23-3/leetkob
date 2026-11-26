import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../dist/api/app.js';
import { createInMemoryStore } from '../../dist/db/index.js';
import {
  createDemoAccounts,
  demoClasses,
  demoMemberships,
} from '../../dist/db/seeds/demo-accounts.js';
import { passwords } from '../../dist/shared/passwords.js';

test('API docs serve local Swagger UI, assets and the four active auth operations', async (t) => {
  const { store } = createInMemoryStore();
  const app = createApp({ auth: { store } });
  t.after(() => app.close());
  const page = await app.inject('/docs/');
  assert.equal(page.statusCode, 200, page.body);
  assert.match(page.headers['content-type'], /text\/html/);
  assert.match(page.body, /swagger-ui/);
  assert.ok(page.headers['content-security-policy']);
  for (const path of [
    '/docs/static/swagger-ui-bundle.js',
    '/docs/static/swagger-ui.css',
    '/docs/static/swagger-initializer.js',
  ]) {
    const asset = await app.inject(path);
    assert.equal(asset.statusCode, 200, path);
    if (path.endsWith('swagger-initializer.js')) {
      assert.match(asset.body, /persistAuthorization.*false/);
      assert.match(asset.body, /validatorUrl:\s*null/);
    }
  }
  const response = await app.inject('/docs/json');
  assert.equal(response.statusCode, 200);
  const spec = response.json();
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.servers[0].url, '/');
  assert.deepEqual(Object.keys(spec.paths).sort(), [
    '/auth/login',
    '/auth/logout',
    '/auth/me',
    '/auth/register',
  ]);
  for (const path of ['/auth/register', '/auth/login'])
    assert.deepEqual(spec.paths[path].post.security, []);
  assert.deepEqual(spec.paths['/auth/me'].get.security, [{ bearerAuth: [] }]);
  assert.deepEqual(spec.paths['/auth/logout'].post.security, [
    { bearerAuth: [] },
  ]);
  assert.deepEqual(spec.components.securitySchemes.bearerAuth.type, 'http');
  assert.deepEqual(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
  assert.equal(
    spec.components.schemas.RegisterInput.additionalProperties,
    false,
  );
  assert.equal(
    spec.components.schemas.RegisterInput.properties.password.minLength,
    15,
  );
  assert.equal(
    spec.components.schemas.LoginInput.properties.password.minLength,
    1,
  );
  assert.equal(
    spec.components.schemas.LoginInput.properties.password.example,
    undefined,
  );
  assert.equal(
    'passwordHash' in spec.components.schemas.User.properties,
    false,
  );
  assert.equal(
    spec.paths['/auth/register'].post.responses['409'].content[
      'application/problem+json'
    ].schema.$ref,
    '#/components/schemas/Problem',
  );
  assert.equal(
    spec.paths['/auth/logout'].post.responses['204'].content,
    undefined,
  );
  // The documented protected request reaches the real handler, not a docs mock.
  const unauthorized = await app.inject({ method: 'GET', url: '/auth/me' });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.headers['www-authenticate'], 'Bearer');
});

test('API docs do not advertise auth operations when no AuthStore is mounted', async (t) => {
  const app = createApp();
  t.after(() => app.close());
  assert.equal((await app.inject('/docs/')).statusCode, 404);
  assert.equal((await app.inject('/docs/json')).statusCode, 404);
});

test('Swagger request examples execute successfully and error examples match handlers', async (t) => {
  const hash = await passwords.hash('password123');
  const { store } = createInMemoryStore({
    seed: {
      users: createDemoAccounts().map(({ password: _password, ...user }) => ({
        ...user,
        passwordHash: hash,
      })),
      classes: demoClasses,
      memberships: demoMemberships(),
      labs: [],
    },
  });
  const app = createApp({ auth: { store } });
  t.after(() => app.close());
  const spec = (await app.inject('/docs/json')).json();
  const examples =
    spec.paths['/auth/login'].post.requestBody.content['application/json']
      .examples;
  for (const [name, expectedRole] of [
    ['student', 'student'],
    ['ta', 'TA'],
    ['admin', 'admin'],
  ]) {
    const result = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: examples[name].value,
    });
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().user.role, expectedRole);
    if (name === 'student') {
      const me = await app.inject({
        url: '/auth/me',
        headers: { authorization: 'Bearer ' + result.json().accessToken },
      });
      assert.deepEqual(
        me.json(),
        spec.paths['/auth/me'].get.responses['200'].content['application/json']
          .example,
      );
    }
  }
  const register = spec.paths['/auth/register'].post;
  const input =
    register.requestBody.content['application/json'].examples.student.value;
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: input,
  });
  assert.equal(response.statusCode, 201, response.body);
  const sample = register.responses['201'].content['application/json'].example;
  assert.deepEqual(
    { ...response.json().user, id: sample.user.id },
    sample.user,
  );
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: examples.registeredStudent.value,
  });
  assert.equal(login.statusCode, 200, login.body);
  const duplicate = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: input,
  });
  assert.deepEqual(
    duplicate.json(),
    register.responses['409'].content['application/problem+json'].example,
  );
  const invalid = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { username: 'student.demo' },
  });
  assert.deepEqual(
    invalid.json(),
    register.responses['400'].content['application/problem+json'].examples
      .validation.value,
  );
  const malformed = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: '{',
  });
  assert.deepEqual(
    malformed.json(),
    register.responses['400'].content['application/problem+json'].examples
      .invalidJson.value,
  );
});
// PR thử kiểm CODEOWNERS (PA04-T01), không merge.
