import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  submissionHarness as harness,
  codeForm,
} from '../support/submissions.mjs';

test('submissions: multipart duplicates/missing parts and JSON transport boundaries', async (t) => {
  const h = await harness(t);
  const first = codeForm('x');
  const closing = Buffer.from('--submission-test-boundary--\r\n');
  const duplicate = {
    ...first,
    payload: Buffer.concat([
      first.payload.subarray(0, first.payload.length - closing.length),
      first.payload,
    ]),
  };
  assert.equal((await h.upload(duplicate, randomUUID())).statusCode, 400);
  assert.equal(
    (await h.upload({ ...first, payload: closing }, randomUUID())).statusCode,
    400,
  );
  assert.equal(
    (await h.upload(codeForm('valid', 'MAIN.CPP'), randomUUID())).statusCode,
    201,
  );
  const suffix = JSON.stringify({ code: 'x' });
  const payload = ' '.repeat(1024 * 1024 - Buffer.byteLength(suffix)) + suffix;
  const request = {
    method: 'POST',
    url: `/labs/${h.lab.id}/submissions`,
    headers: {
      ...h.headers['student-1'],
      'idempotency-key': randomUUID(),
      'content-type': 'application/json',
    },
    payload,
  };
  assert.equal((await h.app.inject(request)).statusCode, 201);
  const overflow = await h.app.inject({
    ...request,
    headers: { ...request.headers, 'idempotency-key': randomUUID() },
    payload: ' ' + payload,
  });
  assert.equal(overflow.statusCode, 413);
  assert.equal((await h.send('x', 'not-a-key')).statusCode, 400);
});

test('submissions: database failures are sanitized and never treated as client validation', async (t) => {
  const h = await harness(t);
  h.store.submitIdempotently = async () => {
    throw Object.assign(new Error('private SQL diagnostic'), {
      code: 'ECONNREFUSED',
    });
  };
  const unavailable = await h.send();
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.includes('private SQL'), false);
  h.store.submitIdempotently = async () => {
    throw new TypeError('private internal invariant');
  };
  const internal = await h.send();
  assert.equal(internal.statusCode, 500);
  assert.equal(internal.body.includes('private internal'), false);
});

test('submissions: double-click records one submission/job and enforces ownership', async (t) => {
  const h = await harness(t);
  const [first, replay] = await Promise.all([h.send(), h.send()]);
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(replay.statusCode, 201, replay.body);
  const submission = first.json().submission;
  assert.equal(submission.id, replay.json().submission.id);
  assert.equal(submission.status, 'queued');
  assert.equal(submission.judgeResult, null);
  assert.equal(first.headers.location, `/submissions/${submission.id}`);
  assert.equal(
    [first, replay].filter((r) => r.headers['idempotent-replayed'] === 'true')
      .length,
    1,
  );
  assert.equal((await h.send('different code')).statusCode, 409);
  for (const [user, status] of [
    ['student-1', 200],
    ['ta-1', 200],
    ['student-3', 404],
    ['ta-2', 404],
    ['admin-1', 403],
  ]) {
    const detail = await h.app.inject({
      url: `/submissions/${submission.id}`,
      headers: h.headers[user],
    });
    assert.equal(detail.statusCode, status, detail.body);
  }
  const mine = await h.app.inject({
    url: `/labs/${h.lab.id}/submissions/mine`,
    headers: h.headers['student-1'],
  });
  assert.equal(mine.json().submissions.length, 1);
  assert.equal('code' in mine.json().submissions[0], false);
  assert.equal(mine.json().nextCursor, null);
  const job = await h.store.claim({
    workerId: 'phase3-test',
    leaseMs: 1000,
    maxAttempts: 3,
  });
  assert.ok(job);
  assert.equal(
    await h.store.claim({
      workerId: 'other-worker',
      leaseMs: 1000,
      maxAttempts: 3,
    }),
    undefined,
  );
  const current = await h.send();
  assert.equal(current.json().submission.status, 'judging');
  assert.equal('leaseToken' in current.json().submission, false);
});

test('submissions: deadline rejects new intake but replay and reads survive', async (t) => {
  const h = await harness(t);
  assert.equal((await h.send()).statusCode, 201);
  h.setTime(h.lab.deadline);
  assert.equal((await h.send()).statusCode, 201);
  assert.equal((await h.send('new', randomUUID())).statusCode, 409);
});

test('submissions: UTF-8 file and JSON preserve code and share idempotency', async (t) => {
  const h = await harness(t);
  const code = '// tiếng Việt 😀\r\n int main() { return 0; } \n';
  const first = await h.upload(
    codeForm(
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(code)]),
    ),
  );
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(first.json().submission.code, code);
  const replay = await h.send(code);
  assert.equal(replay.statusCode, 201, replay.body);
  assert.equal(replay.json().submission.id, first.json().submission.id);
  assert.equal(replay.headers['idempotent-replayed'], 'true');
  assert.equal(
    (await h.send('this is invalid C++', randomUUID())).statusCode,
    201,
  );
  for (const form of [
    codeForm('x', 'main.zip'),
    codeForm('x', '../main.cpp'),
    codeForm('x', 'C:\\main.cpp'),
    codeForm('x', 'main.cpp', 'other'),
    codeForm(Buffer.from([0xc3, 0x28])),
  ]) {
    assert.equal((await h.upload(form, randomUUID())).statusCode, 400);
  }
});

test('submissions: exact code/body limits and rejected input never reserve a key', async (t) => {
  const h = await harness(t);
  const code = 'é'.repeat(32768);
  assert.equal((await h.send(code)).statusCode, 201);
  const invalid = [
    ['', 400],
    [' \n', 400],
    ['\ud800', 400],
    ['x\u0000', 400],
    [code + 'x', 413],
  ];
  for (const [value, status] of invalid) {
    const result = await h.send(value, randomUUID());
    assert.equal(result.statusCode, status, result.body);
  }
  const bad = await h.app.inject({
    method: 'POST',
    url: `/labs/${h.lab.id}/submissions`,
    headers: { ...h.headers['student-1'], 'idempotency-key': randomUUID() },
    payload: { code: 'x', studentId: 'student-3' },
  });
  assert.equal(bad.statusCode, 400);
  assert.equal(
    (await h.upload(codeForm('x'.repeat(65537)), randomUUID())).statusCode,
    413,
  );
  const retry = await h.send('valid', randomUUID());
  assert.equal(retry.statusCode, 201);
});

test('submissions: role gates precede parsing and draft lab is hidden', async (t) => {
  const h = await harness(t);
  for (const [user, status] of [
    [undefined, 401],
    ['ta-1', 403],
    ['admin-1', 403],
    ['student-3', 404],
  ]) {
    const result = await h.app.inject({
      method: 'POST',
      url: `/labs/${h.lab.id}/submissions`,
      headers: {
        ...(user ? h.headers[user] : {}),
        'content-type': 'application/json',
      },
      payload: Buffer.from([0xff]),
    });
    assert.equal(result.statusCode, status, result.body);
  }
  h.setTime('2026-11-21T23:59:59.999Z');
  assert.equal((await h.send()).statusCode, 404);
  h.setTime(h.lab.opensAt);
  assert.equal((await h.send()).statusCode, 201);
  h.store.getMembership = async () => undefined;
  assert.equal((await h.send()).statusCode, 404);
});

test('submissions: pagination/filter/cursor scope and student summary isolation', async (t) => {
  const h = await harness(t);
  const ids = [];
  for (let i = 0; i < 4; i++)
    ids.push((await h.send(`code${i}`, randomUUID())).json().submission.id);
  const list = (suffix, user = 'ta-1') =>
    h.app.inject({
      url: `/labs/${h.lab.id}/submissions${suffix}`,
      headers: h.headers[user],
    });
  const first = (
    await list('?limit=2&studentId=student-1&status=queued')
  ).json();
  assert.deepEqual(
    first.submissions.map((s) => s.id),
    ids.slice(2).reverse(),
  );
  assert.ok(first.nextCursor);
  const next = (
    await list(
      `?limit=2&studentId=student-1&status=queued&cursor=${first.nextCursor}`,
    )
  ).json();
  assert.deepEqual(
    next.submissions.map((s) => s.id),
    ids.slice(0, 2).reverse(),
  );
  assert.equal(next.nextCursor, null);
  for (const suffix of [
    '?limit=0',
    '?limit=101',
    '?limit=2&limit=3',
    '?status=unknown',
    '?unknown=x',
    '?cursor=bad',
    `?cursor=${first.nextCursor}`,
  ])
    assert.equal((await list(suffix)).statusCode, 400, suffix);
  assert.equal((await list('', 'student-1')).statusCode, 403);
  assert.equal(
    (await list('/mine?studentId=student-3', 'student-1')).statusCode,
    400,
  );
  assert.equal((await list('/mine', 'ta-1')).statusCode, 403);
  assert.deepEqual((await list('?studentId=student-3')).json().submissions, []);
});

test('submissions: limiter includes replay, is per-app and uses Retry-After', async (t) => {
  const h = await harness(t);
  for (let i = 0; i < 10; i++) assert.equal((await h.send()).statusCode, 201);
  const limited = await h.send();
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['retry-after'], '60');
  h.setTime('2026-11-22T00:01:00.000Z');
  assert.equal((await h.send()).statusCode, 201);
  const other = await harness(t);
  assert.equal((await other.send()).statusCode, 201);
});

test('submissions: Swagger describes real routes, file input and safe summaries', async (t) => {
  const h = await harness(t);
  const spec = (await h.app.inject('/docs/json')).json();
  const post = spec.paths['/labs/{labId}/submissions'].post;
  assert.equal(
    post.parameters.find((p) => p.name === 'Idempotency-Key').required,
    true,
  );
  assert.ok(
    post.requestBody.content['multipart/form-data'].schema.properties.codeFile,
  );
  assert.equal(
    'code' in spec.components.schemas.SubmissionSummary.properties,
    false,
  );
  assert.ok(spec.paths['/labs/{labId}/submissions/mine']);
  assert.equal(
    (await h.send(post.requestBody.content['application/json'].example.code))
      .statusCode,
    201,
  );
});
