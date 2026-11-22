import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { labsHarness, labBody, multipart } from '../support/labs.mjs';

function postChunked(address, headers, payload) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      address + '/classes/class-1/labs',
      { method: 'POST', headers, agent: false },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString(),
          }),
        );
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.setTimeout(10_000, () =>
      request.destroy(new Error('Upload did not settle')),
    );
    request.write(payload.subarray(0, 1024));
    request.end(payload.subarray(1024));
  });
}

test('labs upload: invalid UTF-8 in multipart text field is rejected before replacement', async (t) => {
  const h = await labsHarness(t);
  const address = await h.app.listen({ host: '127.0.0.1', port: 0 });
  const form = multipart([
    { name: 'lab', value: labBody({ title: 'PLACEHOLDER' }) },
  ]);
  const offset = form.payload.indexOf('PLACEHOLDER');
  const malformed = Buffer.concat([
    form.payload.subarray(0, offset),
    Buffer.from([0xc3, 0x28]),
    form.payload.subarray(offset + 11),
  ]);
  const result = await postChunked(
    address,
    {
      ...h.headers['ta-1'],
      'idempotency-key': randomUUID(),
      'content-type': form.contentType,
    },
    malformed,
  );
  assert.equal(result.status, 400, result.body);
  assert.deepEqual(await h.store.listLabSummariesForClass('class-1'), []);
});

test('labs upload: real chunked multipart and aggregate cap, without partial writes', async (t) => {
  const h = await labsHarness(t);
  const address = await h.app.listen({ host: '127.0.0.1', port: 0 });
  const { tests, ...metadata } = labBody();
  let created = 0;
  const original = h.store.createLabIdempotently.bind(h.store);
  h.store.createLabIdempotently = (...args) => {
    created++;
    return original(...args);
  };
  const send = (form) =>
    postChunked(
      address,
      {
        ...h.headers['ta-1'],
        'idempotency-key': randomUUID(),
        'content-type': form.contentType,
      },
      form.payload,
    );
  const normal = await send(
    multipart([
      { name: 'lab', value: metadata },
      { name: 'testsFile', file: true, value: { tests } },
    ]),
  );
  assert.equal(normal.status, 201, normal.body);
  assert.equal(created, 1);
  // Each test is 256 KiB decoded. Escaped controls make the file 19.5 MiB
  // and the lab field 1.5 MiB: both parts fit individually, the request does not.
  const largeTests = Array.from({ length: 13 }, (_, i) => ({
    id: `t${i}`,
    input: '\u0001'.repeat(256 * 1024),
    expectedOutput: '',
  }));
  const huge = multipart([
    { name: 'testsFile', file: true, value: { tests: largeTests } },
    {
      name: 'lab',
      value: { ...metadata, statement: '\u0001'.repeat(256 * 1024) },
    },
  ]);
  assert.ok(huge.payload.length > 20 * 1024 * 1024);
  const rejected = await send(huge);
  assert.equal(rejected.status, 413, rejected.body);
  assert.equal(created, 1);
  const list = await h.app.inject({
    url: '/classes/class-1/labs',
    headers: h.headers['ta-1'],
  });
  assert.equal(list.json().labs.length, 1);
});

test('labs upload: truncated multipart settles with 400 and no lab', async (t) => {
  const h = await labsHarness(t);
  const address = await h.app.listen({ host: '127.0.0.1', port: 0 });
  const { tests, ...metadata } = labBody();
  const form = multipart([
    { name: 'lab', value: metadata },
    { name: 'testsFile', file: true, value: { tests } },
  ]);
  const result = await postChunked(
    address,
    {
      ...h.headers['ta-1'],
      'idempotency-key': randomUUID(),
      'content-type': form.contentType,
    },
    form.payload.subarray(0, form.payload.length - 40),
  );
  assert.equal(result.status, 400, result.body);
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

test('labs upload: a real chunked JSON body also enforces the total cap', async (t) => {
  const h = await labsHarness(t);
  const address = await h.app.listen({ host: '127.0.0.1', port: 0 });
  const result = await postChunked(
    address,
    {
      ...h.headers['ta-1'],
      'idempotency-key': randomUUID(),
      'content-type': 'application/json',
    },
    Buffer.from(
      JSON.stringify(labBody({ statement: 'x'.repeat(20 * 1024 * 1024) })),
    ),
  );
  assert.equal(result.status, 413, result.body);
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

test('labs upload: client abort reaches error handling without creating a lab', async (t) => {
  const h = await labsHarness(t);
  let signalRequest;
  let signalError;
  const started = new Promise((resolve) => {
    signalRequest = resolve;
  });
  const handled = new Promise((resolve) => {
    signalError = resolve;
  });
  h.app.addHook('onRequest', async (request) => {
    if (request.method === 'POST') signalRequest();
  });
  h.app.addHook('onError', async (_request, _reply, error) => {
    signalError(error);
  });
  const address = await h.app.listen({ host: '127.0.0.1', port: 0 });
  const form = multipart([
    { name: 'lab', value: labBody() },
    { name: 'testsFile', file: true, value: '{"tests":[' },
  ]);
  const request = http.request(address + '/classes/class-1/labs', {
    method: 'POST',
    headers: {
      ...h.headers['ta-1'],
      'idempotency-key': randomUUID(),
      'content-type': form.contentType,
    },
    agent: false,
  });
  request.on('error', () => {});
  request.write(form.payload.subarray(0, form.payload.length - 30));
  await started;
  await new Promise((resolve) => setImmediate(resolve));
  request.destroy();
  let timer;
  try {
    const error = await Promise.race([
      handled,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Aborted upload hung')),
          5000,
        );
      }),
    ]);
    assert.ok(error);
  } finally {
    clearTimeout(timer);
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
