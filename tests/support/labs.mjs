import { createHash } from 'node:crypto';
import { createApp } from '../../dist/api/app.js';
import { createInMemoryStore, createStoreSeed } from '../../dist/db/index.js';

export const LAB_NOW = '2026-11-22T00:00:00.000Z';
export const LAB_KEY = '11111111-1111-4111-8111-111111111111';
export function labBody(extra = {}) {
  return {
    title: '  Sum two integers  ',
    statement: 'Read two integers and print their sum.\n',
    deadline: '2026-12-01T00:00:00.000Z',
    tests: [{ id: 't1', input: '2 3\n', expectedOutput: '5\n' }],
    constraints: [],
    ...extra,
  };
}
export function newLab(extra = {}) {
  return {
    ...labBody(),
    title: 'Sum two integers',
    limits: { cpuTimeMs: 1000, memoryMb: 256 },
    classId: 'class-1',
    createdBy: 'ta-1',
    ...extra,
  };
}
export async function labsHarness(t, withSubmissions = false) {
  let now = Date.parse(LAB_NOW);
  const clock = () => new Date(now);
  const seed = createStoreSeed();
  seed.labs = [];
  seed.memberships.push({
    userId: 'student-1',
    classId: 'class-2',
    role: 'student',
  });
  seed.users.push({
    id: 'student-3',
    username: 'student3',
    displayName: 'Other Student',
    role: 'student',
    passwordHash: 'test-only-hash',
  });
  seed.memberships.push({
    userId: 'student-3',
    classId: 'class-2',
    role: 'student',
  });
  const { store } = createInMemoryStore({ seed, clock });
  const headers = {};
  for (const [index, userId] of [
    'ta-1',
    'ta-2',
    'student-1',
    'student-3',
    'admin-1',
  ].entries()) {
    const token = Buffer.alloc(32, index + 1).toString('base64url');
    await store.createSession({
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId,
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    headers[userId] = { authorization: 'Bearer ' + token };
  }
  const app = createApp({
    auth: { store, clock },
    labs: { store, clock },
    ...(withSubmissions ? { submissions: { store, clock } } : {}),
  });
  t.after(() => app.close());
  return {
    app,
    store,
    headers,
    setTime: (value) => {
      now = Date.parse(value);
    },
    create: (
      body = labBody(),
      key = LAB_KEY,
      userId = 'ta-1',
      classId = 'class-1',
    ) =>
      app.inject({
        method: 'POST',
        url: `/classes/${classId}/labs`,
        headers: { ...headers[userId], 'idempotency-key': key },
        payload: body,
      }),
  };
}

export function multipart(parts, boundary = 't04-test-boundary') {
  const buffers = [];
  for (const part of parts) {
    buffers.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${part.file ? `; filename="${part.name}.json"` : ''}\r\nContent-Type: ${part.file ? 'application/json' : 'text/plain'}\r\n\r\n`,
      ),
    );
    buffers.push(
      Buffer.isBuffer(part.value)
        ? part.value
        : Buffer.from(
            typeof part.value === 'string'
              ? part.value
              : JSON.stringify(part.value),
          ),
    );
    buffers.push(Buffer.from('\r\n'));
  }
  buffers.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(buffers),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
