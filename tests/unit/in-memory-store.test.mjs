import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryStore, createStoreSeed } from '../../dist/db/index.js';
import { defineStoreConformance } from '../support/store-conformance.mjs';

defineStoreConformance('in-memory store', (options) =>
  createInMemoryStore(options),
);

const beforeDeadline = () => new Date('2026-11-09T10:00:00.000Z');

test('in-memory store: instances do not share state', async () => {
  const a = createInMemoryStore({
    seed: createStoreSeed(),
    clock: beforeDeadline,
  });
  const b = createInMemoryStore({
    seed: createStoreSeed(),
    clock: beforeDeadline,
  });
  await a.store.submit({ labId: 'lab-sort', studentId: 'student-1', code: '' });
  assert.equal((await a.store.listCountedSubmissions('lab-sort')).length, 1);
  assert.equal((await b.store.listCountedSubmissions('lab-sort')).length, 0);
});

test('in-memory store: a bad seed is rejected and reset keeps the old state', async () => {
  const fixture = createInMemoryStore({ seed: createStoreSeed() });
  const bad = createStoreSeed();
  bad.memberships.push({ userId: 'ta-1', classId: 'class-1', role: 'TA' });
  assert.throws(() => fixture.reset(bad), TypeError);
  const extraField = createStoreSeed();
  extraField.labs[0].constraints[0].hidden = true;
  assert.throws(() => fixture.reset(extraField), TypeError);
  assert.notEqual(await fixture.store.getLab('lab-sort'), undefined);
  fixture.reset();
  assert.equal(await fixture.store.getLab('lab-sort'), undefined);
});
