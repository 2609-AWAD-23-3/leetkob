import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { submissionHarness, codeForm } from '../support/submissions.mjs';

function post(address, path, headers, payload, beforeEnd = () => {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      address + path,
      { method: 'POST', headers, agent: false },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    request.on('error', reject);
    request.setTimeout(5000, () =>
      request.destroy(new Error('Upload did not settle')),
    );
    request.write(payload.subarray(0, 1024));
    beforeEnd();
    request.end(payload.subarray(1024));
  });
}
test('submissions upload: real chunked, aggregate body cap, truncated request and UTF-8', async (t) => {
  const h = await submissionHarness(t);
  const address = await h.app.listen({ host: '127.0.0.1', port: 0 });
  const send = (form) =>
    post(
      address,
      `/labs/${h.lab.id}/submissions`,
      {
        ...h.headers['student-1'],
        'idempotency-key': randomUUID(),
        'content-type': form.contentType,
      },
      form.payload,
    );
  const normal = await send(codeForm('int main(){}\r\n'));
  assert.equal(normal.status, 201, normal.body);
  const truncated = codeForm('x'.repeat(2000));
  truncated.payload = truncated.payload.subarray(
    0,
    truncated.payload.length - 40,
  );
  assert.equal((await send(truncated)).status, 400);
  assert.equal((await send(codeForm(Buffer.from([0xff])))).status, 400);
  const largeField = {
    contentType: 'multipart/form-data; boundary=huge',
    payload: Buffer.from(
      '--huge\r\nContent-Disposition: form-data; name="codeFile"; filename="main.cpp"\r\nX-Padding: ' +
        'a'.repeat(1024 * 1024) +
        '\r\n\r\nx\r\n--huge--\r\n',
    ),
  };
  // Framing/header bytes are bounded too; parser may reject the oversized header first.
  assert.ok([400, 413].includes((await send(largeField)).status));
  const hugeJson = Buffer.from(
    ' '.repeat(1024 * 1024) + JSON.stringify({ code: 'x' }),
  );
  const tooLarge = await post(
    address,
    `/labs/${h.lab.id}/submissions`,
    {
      ...h.headers['student-1'],
      'idempotency-key': randomUUID(),
      'content-type': 'application/json',
    },
    hugeJson,
  );
  assert.equal(tooLarge.status, 413, tooLarge.body);
  assert.equal(
    (await h.store.listSubmissions(h.lab.id, 'student-1')).length,
    1,
  );
});

test('submissions upload: finishing at deadline is rejected, client abort creates nothing', async (t) => {
  const h = await submissionHarness(t);
  let abortSeen;
  const observed = new Promise((resolve) => {
    abortSeen = resolve;
  });
  h.app.addHook('onRequest', async (request) => {
    request.raw.once('aborted', () => abortSeen());
  });
  const address = await h.app.listen({ host: '127.0.0.1', port: 0 });
  const form = codeForm('x'.repeat(4000));
  const result = await post(
    address,
    `/labs/${h.lab.id}/submissions`,
    {
      ...h.headers['student-1'],
      'idempotency-key': randomUUID(),
      'content-type': form.contentType,
    },
    form.payload,
    () => h.setTime(h.lab.deadline),
  );
  assert.equal(result.status, 409, result.body);
  h.setTime(h.lab.opensAt);
  await new Promise((resolve) => {
    const req = http.request(
      address + `/labs/${h.lab.id}/submissions`,
      {
        method: 'POST',
        headers: {
          ...h.headers['student-1'],
          'idempotency-key': randomUUID(),
          'content-type': form.contentType,
          'content-length': form.payload.length,
        },
      },
      () => resolve(),
    );
    req.on('error', () => resolve());
    req.flushHeaders();
    req.write(form.payload.subarray(0, 1024));
    setTimeout(() => req.destroy(), 20);
  });
  let timer;
  try {
    await Promise.race([
      observed,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Abort was not observed')),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  assert.equal(
    (await h.store.listSubmissions(h.lab.id, 'student-1')).length,
    0,
  );
});
