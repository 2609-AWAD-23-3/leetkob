import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { labsHarness, labBody, LAB_KEY, multipart } from '../support/labs.mjs';

test('labs: authorization precedes parsing and database failures remain sanitized', async (t) => {
  const h = await labsHarness(t);
  for (const [user, status] of [
    [undefined, 401],
    ['student-1', 403],
    ['ta-2', 404],
  ]) {
    const response = await h.app.inject({
      method: 'POST',
      url: '/classes/class-1/labs',
      headers: {
        ...(user ? h.headers[user] : {}),
        'content-type': 'application/json',
      },
      payload: Buffer.from([0xff]),
    });
    assert.equal(response.statusCode, status);
  }
  h.store.createLabIdempotently = async () => {
    throw Object.assign(new Error('private database diagnostic'), {
      code: 'ECONNREFUSED',
    });
  };
  const unavailable = await h.create();
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.includes('private database diagnostic'), false);
  h.store.createLabIdempotently = async () => {
    throw new TypeError('private Store invariant');
  };
  const internal = await h.create();
  assert.equal(internal.statusCode, 500);
  assert.equal(internal.body.includes('private Store invariant'), false);
});

test('labs: TA creates once, double-click replays, changed payload conflicts', async (t) => {
  const h = await labsHarness(t);
  const results = await Promise.all([h.create(), h.create()]);
  for (const result of results)
    assert.equal(result.statusCode, 201, result.body);
  assert.equal(results[0].json().lab.phase, 'open');
  assert.equal(results[0].json().lab.id, results[1].json().lab.id);
  assert.equal(
    results.filter((r) => r.headers['idempotent-replayed'] === 'true').length,
    1,
  );
  assert.equal(
    results[0].headers.location,
    '/labs/' + results[0].json().lab.id,
  );
  assert.equal(
    (await h.create(labBody({ title: 'Different' }))).statusCode,
    409,
  );
  const list = await h.app.inject({
    url: '/classes/class-1/labs',
    headers: h.headers['ta-1'],
  });
  assert.equal(list.json().labs.length, 1);
  assert.equal('tests' in list.json().labs[0], false);
  assert.equal('statement' in list.json().labs[0], false);
});

test('labs: class ownership, role gates, draft filtering and student DTO', async (t) => {
  const h = await labsHarness(t);
  assert.equal(
    (await h.app.inject({ url: '/classes/class-1/labs' })).statusCode,
    401,
  );
  assert.equal(
    (await h.create(labBody(), LAB_KEY, 'student-1')).statusCode,
    403,
  );
  assert.equal((await h.create(labBody(), LAB_KEY, 'admin-1')).statusCode, 403);
  assert.equal((await h.create(labBody(), LAB_KEY, 'ta-2')).statusCode, 404);
  const created = await h.create(
    labBody({
      opensAt: '2026-11-22T01:00:00.000Z',
      deadline: '2026-11-22T02:00:00.000Z',
    }),
  );
  assert.equal(created.statusCode, 201, created.body);
  const id = created.json().lab.id;
  assert.equal(
    (await h.app.inject({ url: `/labs/${id}`, headers: h.headers['ta-2'] }))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await h.app.inject({
        url: `/labs/${id}`,
        headers: h.headers['student-1'],
      })
    ).statusCode,
    404,
  );
  assert.deepEqual(
    (
      await h.app.inject({
        url: '/classes/class-1/labs',
        headers: h.headers['student-1'],
      })
    ).json(),
    { labs: [] },
  );
  h.setTime('2026-11-22T01:00:00.000Z');
  const student = await h.app.inject({
    url: `/labs/${id}`,
    headers: h.headers['student-1'],
  });
  assert.equal(student.statusCode, 200);
  assert.equal(student.json().lab.phase, 'open');
  assert.equal('tests' in student.json().lab, false);
  assert.equal('createdBy' in student.json().lab, false);
  assert.equal(
    (
      await h.app.inject({
        url: `/labs/${id}`,
        headers: h.headers['student-3'],
      })
    ).statusCode,
    404,
  );
  h.setTime('2026-11-22T02:00:00.000Z');
  assert.equal(
    (
      await h.create(
        labBody({
          opensAt: '2026-11-22T01:00:00.000Z',
          deadline: '2026-11-22T02:00:00.000Z',
        }),
      )
    ).statusCode,
    201,
  );
  assert.equal(
    (
      await h.app.inject({
        url: `/labs/${id}`,
        headers: h.headers['student-1'],
      })
    ).json().lab.phase,
    'closed',
  );
});

test('labs: JSON and multipart import share the same idempotency fingerprint', async (t) => {
  const h = await labsHarness(t);
  const first = await h.create();
  assert.equal(first.statusCode, 201, first.body);
  const { tests, constraints, ...lab } = labBody();
  const form = multipart([
    { name: 'testsFile', file: true, value: { tests } },
    { name: 'lab', value: lab },
    { name: 'constraintsFile', file: true, value: { constraints } },
  ]);
  const replay = await h.app.inject({
    method: 'POST',
    url: '/classes/class-1/labs',
    headers: {
      ...h.headers['ta-1'],
      'idempotency-key': LAB_KEY,
      'content-type': form.contentType,
    },
    payload: form.payload,
  });
  assert.equal(replay.statusCode, 201, replay.body);
  assert.equal(replay.headers['idempotent-replayed'], 'true');
  assert.equal(replay.json().lab.id, first.json().lab.id);
  const both = multipart([
    { name: 'lab', value: labBody() },
    { name: 'testsFile', file: true, value: { tests } },
  ]);
  const invalid = await h.app.inject({
    method: 'POST',
    url: '/classes/class-1/labs',
    headers: {
      ...h.headers['ta-1'],
      'idempotency-key': randomUUID(),
      'content-type': both.contentType,
    },
    payload: both.payload,
  });
  assert.equal(invalid.statusCode, 400);
});

test('labs: missing or malformed key, dates and text are rejected without creating labs', async (t) => {
  const h = await labsHarness(t);
  for (const key of [
    undefined,
    '',
    'not-a-uuid',
    '11111111-1111-1111-8111-111111111111',
  ]) {
    const headers = {
      ...h.headers['ta-1'],
      ...(key === undefined ? {} : { 'idempotency-key': key }),
    };
    assert.equal(
      (
        await h.app.inject({
          method: 'POST',
          url: '/classes/class-1/labs',
          headers,
          payload: labBody(),
        })
      ).statusCode,
      400,
    );
  }
  for (const extra of [
    { createdBy: 'ta-2' },
    { classId: 'class-2' },
    { id: 'chosen' },
    { role: 'admin' },
    { phase: 'open' },
    { deadline: '2026-11-21T00:00:00.000Z' },
    { deadline: 'tomorrow' },
    { opensAt: '2026-12-02T00:00:00.000Z' },
    { title: 'x'.repeat(201) },
    { statement: 'A\u0000B' },
    { constraints: [{ id: 'c1', text: '\ud800', deduction: 1 }] },
    { tests: [] },
    {
      tests: [
        { id: 't1', input: '', expectedOutput: '' },
        { id: 't1', input: '', expectedOutput: '' },
      ],
    },
    { limits: { cpuTimeMs: 1000 } },
  ]) {
    const result = await h.create(labBody(extra), randomUUID());
    assert.equal(result.statusCode, 400, result.body);
  }
  for (const extra of [
    { statement: 'x'.repeat(256 * 1024 + 1) },
    {
      tests: [
        { id: 't1', input: 'x'.repeat(1024 * 1024 + 1), expectedOutput: '' },
      ],
    },
    { constraints: [{ id: 'c1', text: 'x'.repeat(4097), deduction: 1 }] },
  ]) {
    assert.equal(
      (await h.create(labBody(extra), randomUUID())).statusCode,
      413,
    );
  }
  assert.deepEqual(
    (
      await h.app.inject({
        url: '/classes/class-1/labs',
        headers: h.headers['ta-1'],
      })
    ).json(),
    { labs: [] },
  );
});

test('labs: multipart handles each source, BOM, empty tests, duplicate parts and invalid files', async (t) => {
  const h = await labsHarness(t);
  const send = (parts) => {
    const form = multipart(parts);
    return h.app.inject({
      method: 'POST',
      url: '/classes/class-1/labs',
      headers: {
        ...h.headers['ta-1'],
        'idempotency-key': randomUUID(),
        'content-type': form.contentType,
      },
      payload: form.payload,
    });
  };
  const { tests, constraints, ...metadata } = labBody();
  for (const parts of [
    [
      { name: 'lab', value: { ...metadata, constraints } },
      {
        name: 'testsFile',
        file: true,
        value: '\uFEFF' + JSON.stringify({ tests }),
      },
    ],
    [
      { name: 'constraintsFile', file: true, value: { constraints } },
      { name: 'lab', value: { ...metadata, tests } },
    ],
  ]) {
    const result = await send(parts);
    assert.equal(result.statusCode, 201, result.body);
    assert.deepEqual(result.json().lab.tests, tests);
  }
  for (const parts of [
    [
      { name: 'lab', value: labBody() },
      { name: 'lab', value: labBody() },
    ],
    [{ name: 'unknown', value: '{}' }],
    [{ name: 'lab', value: metadata }],
    [{ name: 'testsFile', file: true, value: { tests } }],
    [
      { name: 'lab', value: { ...metadata, constraints } },
      { name: 'testsFile', file: true, value: [] },
    ],
    [
      { name: 'lab', value: { ...metadata, constraints } },
      { name: 'testsFile', file: true, value: { tests, extra: true } },
    ],
    [
      { name: 'lab', value: { ...metadata, constraints } },
      { name: 'testsFile', file: true, value: '{' },
    ],
    [
      { name: 'lab', value: { ...metadata, constraints } },
      { name: 'testsFile', file: true, value: Buffer.from([0xff, 0xfe]) },
    ],
    [
      { name: 'lab', value: labBody() },
      { name: 'unknown', file: true, value: '{}' },
    ],
  ])
    assert.equal((await send(parts)).statusCode, 400);
  const raw = Buffer.concat([
    Buffer.from('{"title":"'),
    Buffer.from([0xff]),
    Buffer.from('"}'),
  ]);
  const malformed = await h.app.inject({
    method: 'POST',
    url: '/classes/class-1/labs',
    headers: {
      ...h.headers['ta-1'],
      'idempotency-key': randomUUID(),
      'content-type': 'application/json',
    },
    payload: raw,
  });
  assert.equal(malformed.statusCode, 400);
});

test('labs: a two-class student sees both classes but unrelated students see no lab', async (t) => {
  const h = await labsHarness(t);
  const first = await h.create();
  const second = await h.create(labBody(), LAB_KEY, 'ta-2', 'class-2');
  assert.equal(second.statusCode, 201, second.body);
  for (const id of [first.json().lab.id, second.json().lab.id])
    assert.equal(
      (
        await h.app.inject({
          url: `/labs/${id}`,
          headers: h.headers['student-1'],
        })
      ).statusCode,
      200,
    );
  assert.equal(
    (
      await h.app.inject({
        url: '/classes/class-1/labs',
        headers: h.headers['student-3'],
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await h.app.inject({
        url: '/classes/class-1/labs',
        headers: h.headers['admin-1'],
      })
    ).statusCode,
    403,
  );
});

test('labs: replay canonicalizes defaults and rechecks revoked membership', async (t) => {
  const h = await labsHarness(t);
  assert.equal((await h.create()).statusCode, 201);
  const replay = await h.create(
    labBody({
      title: 'Sum two integers',
      limits: { memoryMb: 256, cpuTimeMs: 1000 },
    }),
  );
  assert.equal(replay.statusCode, 201, replay.body);
  assert.equal(replay.headers['idempotent-replayed'], 'true');
  h.store.getMembership = async () => undefined;
  assert.equal((await h.create()).statusCode, 404);
});

test('labs: Swagger describes the mounted routes, upload schema and student-safe DTO', async (t) => {
  const h = await labsHarness(t);
  const document = (await h.app.inject('/docs/json')).json();
  const create = document.paths['/classes/{classId}/labs'].post;
  assert.equal(
    create.parameters.find((parameter) => parameter.name === 'Idempotency-Key')
      .required,
    true,
  );
  assert.ok(
    create.requestBody.content['multipart/form-data'].schema.properties
      .testsFile,
  );
  // Explicit text/plain encoding makes Swagger wrap the lab string in a
  // Blob/file part. It must remain a regular multipart text field.
  assert.equal(
    create.requestBody.content['multipart/form-data'].encoding.lab,
    undefined,
  );
  assert.equal(
    document.components.schemas.StudentLab.additionalProperties,
    false,
  );
  assert.equal(
    'tests' in document.components.schemas.StudentLab.properties,
    false,
  );
  const example = create.requestBody.content['application/json'].example;
  assert.equal((await h.create(example)).statusCode, 201);
});
