import { createHash } from 'node:crypto';
import { createApp } from '../../dist/api/app.js';
import { createSessionPublishIdentityResolver } from '../../dist/api/auth/index.js';
import {
  createInMemoryStore,
  createStoreSeed,
  FIXTURE_DEADLINE,
} from '../../dist/db/index.js';

export const LAB = 'lab-sort';
export const BEFORE_DEADLINE = '2026-11-09T10:00:00.000Z';
export const AFTER_DEADLINE = '2026-11-09T15:00:00.001Z';
export { FIXTURE_DEADLINE };

// Student 1 calls std::sort (c1) and the model timed out on c2.
export const CODE_SORT = [
  '#include <algorithm>',
  'int main() {',
  '  int a[3] = {3, 1, 2};',
  '  std::sort(a, a + 3);',
  '}',
].join('\n');

// Student 2 writes merge sort and passes both constraints.
export const CODE_MERGE = [
  'void merge_sort(int* a, int n);',
  'int main() {',
  '  int a[3] = {3, 1, 2};',
  '  merge_sort(a, 3);',
  '}',
].join('\n');

const AC = {
  verdict: 'AC',
  tests: [
    { testId: 't1', verdict: 'AC' },
    { testId: 't2', verdict: 'AC' },
  ],
};

const USERS = ['ta-1', 'ta-2', 'student-1', 'student-2', 'admin-1'];

// TA-1 owns class-1 and lab-sort; TA-2 only owns class-2 (FAQ-01).
// makeStore lets the same harness run on Postgres: ({ seed, clock }) ->
// { store, ready? }. The default is the in-memory Store.
export async function reviewHarness(
  t,
  { makeStore = (options) => createInMemoryStore(options) } = {},
) {
  let now = Date.parse(BEFORE_DEADLINE);
  const clock = () => new Date(now);
  const fixture = makeStore({ seed: createStoreSeed(), clock });
  await fixture.ready;
  const { store } = fixture;
  const headers = {};
  for (const [index, userId] of USERS.entries()) {
    const token = Buffer.alloc(32, index + 11).toString('base64url');
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
    submissions: { store, clock },
    reviewQueue: { store },
    publish: {
      store,
      identityResolver: createSessionPublishIdentityResolver(store),
    },
  });
  t.after(() => app.close());

  // Submits, claims and completes one Accepted submission through the Store,
  // the same path the worker uses.
  const judge = async (studentId, code, verdictsFor) => {
    const submission = await store.submit({ labId: LAB, studentId, code });
    const job = await store.claim({
      workerId: 'worker-test',
      leaseMs: 60_000,
      maxAttempts: 3,
    });
    const ok = await store.complete({
      jobId: job.id,
      leaseToken: job.leaseToken,
      judgeResult: AC,
      verdicts: verdictsFor(submission.id),
    });
    if (!ok) throw new Error('complete failed');
    return submission;
  };

  // Two counted Accepted submissions: 4 queue items, none reviewed.
  const seedQueue = async () => {
    const sort = await judge('student-1', CODE_SORT, (submissionId) => [
      {
        submissionId,
        constraintId: 'c1',
        verdict: 'violation',
        evidence: [{ line: 4, text: '  std::sort(a, a + 3);' }],
        unsureCause: null,
        reason: 'std::sort is called.',
        source: 'hard_rule',
      },
      {
        submissionId,
        constraintId: 'c2',
        verdict: 'unsure',
        evidence: [],
        unsureCause: 'timeout',
        reason: 'The model did not answer within 30000 ms.',
        source: 'model',
      },
    ]);
    const merge = await judge('student-2', CODE_MERGE, (submissionId) => [
      {
        submissionId,
        constraintId: 'c1',
        verdict: 'pass',
        evidence: [],
        unsureCause: null,
        reason: null,
        source: 'hard_rule',
      },
      {
        submissionId,
        constraintId: 'c2',
        verdict: 'pass',
        evidence: [],
        unsureCause: null,
        reason: 'merge_sort is implemented.',
        source: 'model',
      },
    ]);
    return { sort, merge };
  };

  const request = (method, url, userId, payload) =>
    app.inject({
      method,
      url,
      headers: userId ? headers[userId] : {},
      ...(payload === undefined ? {} : { payload }),
    });

  return {
    app,
    store,
    clock,
    headers,
    judge,
    seedQueue,
    request,
    setTime: (value) => {
      now = Date.parse(value);
    },
    queue: (userId = 'ta-1', labId = LAB) =>
      request('GET', `/labs/${labId}/review-queue`, userId),
    item: (itemId, userId = 'ta-1') =>
      request('GET', `/review-items/${itemId}`, userId),
    decide: (itemId, body, userId = 'ta-1') =>
      request('POST', `/review-items/${itemId}/decision`, userId, body),
    confirmPasses: (userId = 'ta-1', labId = LAB) =>
      request('POST', `/labs/${labId}/review-queue/confirm-passes`, userId),
    publish: (userId = 'ta-1', labId = LAB) =>
      request('POST', `/labs/${labId}/publish`, userId),
  };
}

// Finds the queue item of a submission and constraint in a queue response.
export function findItem(queueBody, submissionId, constraintId) {
  const item = queueBody.items.find(
    (entry) =>
      entry.submissionId === submissionId &&
      entry.constraintId === constraintId,
  );
  if (!item) throw new Error(`no item for ${submissionId}/${constraintId}`);
  return item;
}
