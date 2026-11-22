import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryStore } from '../../dist/db/index.js';
import { SubmissionLimiter } from '../../dist/api/modules/submissions/limiter.js';
import { defineSubmissionConformance } from '../support/submission-conformance.mjs';
defineSubmissionConformance('fake submissions', createInMemoryStore);
test('submission limiter: capacity cleanup and exact minute boundary', () => {
  let now = 0;
  const limiter = new SubmissionLimiter(() => now, 1);
  limiter.request('a');
  assert.throws(
    () => limiter.request('b'),
    (error) => error.status === 503 && error.retryAfter === 1,
  );
  for (let i = 0; i < 9; i++) limiter.request('a');
  assert.throws(
    () => limiter.request('a'),
    (error) => error.status === 429 && error.retryAfter === 60,
  );
  now = 60_000;
  limiter.request('b');
  assert.throws(
    () => limiter.request('a'),
    (error) => error.status === 503,
  );
});
