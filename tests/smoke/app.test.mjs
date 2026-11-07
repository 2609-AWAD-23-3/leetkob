import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../dist/app.js';
import { loadConfig } from '../../dist/config.js';

// T01 acceptance checks only; the comprehensive runner/fixtures/commands belong to T04.
test('factory does not listen; health works through the real HTTP injection boundary', async (t) => {
  const app = createApp();
  t.after(() => app.close());
  assert.equal(app.server.listening, false);
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'].split(';')[0], 'application/json');
  assert.deepEqual(response.json(), { status: 'ok' });
  assert.equal(app.server.listening, false);
});

test('each module accepts its own real Fastify plugin in the same application', async (t) => {
  const seen = [];
  const module = (name) => async (scope) => {
    seen.push(name);
    scope.get('/smoke/' + name, async () => ({ module: name }));
  };
  const app = createApp({ modules: {
    submissions: module('submissions'),
    reviewQueue: module('review-queue'),
    publish: module('publish'),
  } });
  t.after(() => app.close());
  await app.ready();
  assert.deepEqual(seen, ['submissions', 'review-queue', 'publish']);
  for (const name of seen) {
    const response = await app.inject('/smoke/' + name);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { module: name });
  }
});

test('business routes are absent rather than fake successful implementations', async (t) => {
  const app = createApp();
  t.after(() => app.close());
  for (const [method, url] of [
    ['POST', '/labs/example/submissions'],
    ['GET', '/labs/example/review-queue'],
    ['POST', '/labs/example/publish'],
  ]) {
    assert.equal((await app.inject({ method, url })).statusCode, 404);
  }
});

test('application instances have isolated plugin state and lifecycle hooks', async () => {
  let closed = 0;
  const first = createApp({ modules: { publish: async (scope) => {
    scope.get('/instance-only', async () => ({ ok: true }));
    scope.addHook('onClose', async () => { closed += 1; });
  } } });
  const second = createApp();
  try {
    assert.equal((await first.inject('/instance-only')).statusCode, 200);
    assert.equal((await second.inject('/instance-only')).statusCode, 404);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
  assert.equal(closed, 1);
});

test('listener can start on loopback and close without hard-coded test ports', async () => {
  const app = createApp();
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(address + '/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await app.close();
  }
  assert.equal(app.server.listening, false);
});

test('configuration has local defaults and validates explicit environment input', () => {
  assert.deepEqual(loadConfig({}), { host: '127.0.0.1', port: 3000 });
  assert.deepEqual(loadConfig({ HOST: '127.0.0.1', PORT: '4321' }), { host: '127.0.0.1', port: 4321 });
  for (const port of ['', '0', '-1', '65536', '1.5', '3000oops', ' 3000']) {
    assert.throws(() => loadConfig({ PORT: port }), /PORT/);
  }
  assert.throws(() => loadConfig({ HOST: '  ' }), /HOST/);
});

test('executable rejects invalid configuration with a nonzero exit', () => {
  const child = spawnSync(process.execPath, ['dist/server.js'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: 'not-a-port' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(child.error);
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /PORT must be an integer/);
});
