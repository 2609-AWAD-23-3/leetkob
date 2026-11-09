import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFixedClock,
  createInMemoryPublishStore,
  createPublishSeed,
  FIXTURE_AFTER_DEADLINE,
  FIXTURE_DEADLINE,
} from '../../dist/data/index.js';

const expectedSummary = { queueItemCount: 3, passDecisionCount: 2, violationDecisionCount: 1 };
const publish = (store, publishedBy = 'ta-one') => store.publishLab({ labId: 'lab-1', publishedBy });
const make = (scenario = 'resolved', clock = createFixedClock()) => createInMemoryPublishStore({
  initialState: createPublishSeed(scenario), clock,
});

test('lab lookup and many-to-many membership supply the T03 ownership boundary', () => {
  const { store } = make();
  assert.deepEqual(store.getLab('lab-1'), {
    id: 'lab-1', classId: 'class-1', deadline: FIXTURE_DEADLINE,
  });
  assert.equal(store.isTaAssignedToClass('ta-one', 'class-1'), true);
  assert.equal(store.isTaAssignedToClass('ta-one', 'class-2'), false);
  assert.equal(store.isTaAssignedToClass('ta-other', 'class-1'), false);
  assert.equal(store.isTaAssignedToClass('ta-multi', 'class-1'), true);
  assert.equal(store.isTaAssignedToClass('ta-multi', 'class-2'), true);
  assert.equal(store.isTaAssignedToClass('TA-ONE', 'class-1'), false);
  assert.equal(store.getLab('missing'), undefined);
  assert.equal(store.getReviewState('missing'), undefined);
  assert.equal(store.getPublication('missing'), undefined);
  assert.deepEqual(store.publishLab({ labId: 'missing', publishedBy: 'ta-one' }), {
    kind: 'lab_not_found',
  });
  assert.equal(store.getPublication('lab-1'), undefined);
});

for (const [label, offset, kind] of [
  ['one millisecond before deadline', -1, 'before_deadline'],
  ['exactly at deadline', 0, 'published'],
  ['one millisecond after deadline', 1, 'published'],
]) {
  test(label, () => {
    const timestamp = new Date(Date.parse(FIXTURE_DEADLINE) + offset).toISOString();
    let clockCalls = 0;
    const { store } = make('resolved', () => { clockCalls += 1; return new Date(timestamp); });
    const before = store.getReviewState('lab-1');
    const result = publish(store);
    assert.equal(result.kind, kind);
    assert.equal(clockCalls, 1);
    assert.deepEqual(store.getReviewState('lab-1'), before);
    if (kind === 'before_deadline') {
      assert.deepEqual(result, { kind, deadline: FIXTURE_DEADLINE });
      assert.equal(store.getPublication('lab-1'), undefined);
    } else {
      assert.equal(result.publication.publishedAt, timestamp);
    }
  });
}

for (const verdict of ['pass', 'violation', 'unsure']) {
  test(`a queued ${verdict} without a TA decision blocks publication`, () => {
    const seed = createPublishSeed('pending');
    seed.queueItems[0].verdict = verdict;
    const { store } = createInMemoryPublishStore({ initialState: seed, clock: createFixedClock() });
    const before = store.getReviewState('lab-1');
    assert.deepEqual(publish(store), { kind: 'pending_reviews', pendingCount: 1 });
    assert.equal(store.getPublication('lab-1'), undefined);
    assert.deepEqual(store.getReviewState('lab-1'), before);
  });
}

test('deadline refusal precedes pending refusal', () => {
  const { store } = make('pending', createFixedClock('2026-11-09T14:59:59.999Z'));
  assert.deepEqual(publish(store), { kind: 'before_deadline', deadline: FIXTURE_DEADLINE });
  assert.equal(store.getPublication('lab-1'), undefined);
});

test('summary counts TA decisions, including overrides and resolved unsure', () => {
  const { store } = make();
  assert.deepEqual(store.getReviewState('lab-1'), { ...expectedSummary, pendingCount: 0 });
  const result = publish(store);
  assert.deepEqual(result, { kind: 'published', publication: {
    labId: 'lab-1', publishedAt: FIXTURE_AFTER_DEADLINE,
    publishedBy: 'ta-one', summary: expectedSummary,
  } });
  assert.deepEqual(store.getPublication('lab-1'), result.publication);
});

test('pending in another lab is excluded and an empty queue can publish', () => {
  const { store } = make('pending');
  assert.equal(store.getReviewState('lab-1').pendingCount, 1);
  const result = store.publishLab({ labId: 'lab-2', publishedBy: 'ta-other' });
  assert.equal(result.kind, 'published');
  assert.deepEqual(result.publication.summary, {
    queueItemCount: 0, passDecisionCount: 0, violationDecisionCount: 0,
  });
  assert.equal(store.getPublication('lab-1'), undefined);
  assert.equal(publish(make('empty').store).kind, 'published');
});

test('repeat preserves original publisher, timestamp and summary without consulting the clock', () => {
  let calls = 0;
  const { store } = make('resolved', () => {
    calls += 1;
    if (calls > 1) throw new Error('repeat must not consult clock');
    return new Date(FIXTURE_AFTER_DEADLINE);
  });
  const first = publish(store);
  const repeated = publish(store, 'ta-multi');
  assert.equal(repeated.kind, 'already_published');
  assert.deepEqual(repeated.publication, first.publication);
  assert.equal(calls, 1);
});

test('a seeded publication remains unchanged even when the clock is before deadline', () => {
  const seed = createPublishSeed('published');
  const { store } = createInMemoryPublishStore({
    initialState: seed, clock: createFixedClock('2026-11-08T00:00:00.000Z'),
  });
  const result = publish(store, 'ta-multi');
  assert.equal(result.kind, 'already_published');
  assert.deepEqual(result.publication, seed.publications[0]);
});

test('two scheduled calls create one publication in the same store', async () => {
  const { store } = make();
  const results = await Promise.all([
    Promise.resolve().then(() => publish(store)),
    Promise.resolve().then(() => publish(store, 'ta-multi')),
  ]);
  assert.deepEqual(results.map((result) => result.kind), ['published', 'already_published']);
  assert.deepEqual(results[0].publication, results[1].publication);
  assert.equal(store.getPublication('lab-1').publishedBy, 'ta-one');
});

test('factories, seed/reset and fixed clocks do not share mutable state', () => {
  const first = make();
  const second = make();
  publish(first.store);
  assert.equal(second.store.getPublication('lab-1'), undefined);
  first.reset(createPublishSeed('pending'));
  assert.equal(first.store.getPublication('lab-1'), undefined);
  assert.equal(first.store.getReviewState('lab-1').pendingCount, 1);
  assert.equal(second.store.getReviewState('lab-1').pendingCount, 0);
  first.reset();
  assert.equal(first.store.getLab('lab-1'), undefined);
  assert.equal(first.store.isTaAssignedToClass('ta-one', 'class-1'), false);
  assert.ok(second.store.getLab('lab-1'));
  const clock = createFixedClock();
  clock().setUTCFullYear(2000);
  assert.equal(clock().toISOString(), FIXTURE_AFTER_DEADLINE);
  assert.equal(createInMemoryPublishStore().store.getLab('lab-1'), undefined);
});

test('seed, lookup, reset and publication results are defensive copies', () => {
  const seed = createPublishSeed('resolved');
  const { store, reset } = createInMemoryPublishStore({ initialState: seed, clock: createFixedClock() });
  seed.labs[0].classId = 'mutated';
  seed.memberships[0].classId = 'mutated';
  seed.queueItems[0].taDecision = null;
  store.getLab('lab-1').classId = 'mutated-again';
  store.getReviewState('lab-1').pendingCount = 99;
  assert.equal(store.getLab('lab-1').classId, 'class-1');
  assert.equal(store.isTaAssignedToClass('ta-one', 'class-1'), true);
  assert.equal(store.getReviewState('lab-1').pendingCount, 0);
  const first = publish(store);
  first.publication.summary.queueItemCount = 999;
  first.publication.publishedBy = 'mutated';
  store.getPublication('lab-1').summary.passDecisionCount = 999;
  publish(store).publication.summary.violationDecisionCount = 999;
  assert.deepEqual(store.getPublication('lab-1').summary, expectedSummary);
  assert.equal(store.getPublication('lab-1').publishedBy, 'ta-one');
  const publishedSeed = createPublishSeed('published');
  reset(publishedSeed);
  publishedSeed.publications[0].summary.queueItemCount = 999;
  publishedSeed.labs[0].classId = 'mutated';
  assert.deepEqual(store.getPublication('lab-1').summary, expectedSummary);
  assert.equal(store.getLab('lab-1').classId, 'class-1');
});

const invalidSeeds = [
  ['duplicate lab', (s) => s.labs.push({ ...s.labs[0] }), /Duplicate lab/],
  ['duplicate membership', (s) => s.memberships.push({ ...s.memberships[0] }), /Duplicate membership/],
  ['duplicate queue ID', (s) => { s.queueItems[1].id = s.queueItems[0].id; }, /Duplicate queueItem/],
  ['duplicate review pair', (s) => { s.queueItems[1].constraintId = s.queueItems[0].constraintId; }, /Duplicate review pair/],
  ['unknown review lab', (s) => { s.queueItems[0].labId = 'missing'; }, /unknown lab/],
  ['invalid verdict', (s) => { s.queueItems[0].verdict = 'unknown'; }, /verdict/],
  ['invalid TA decision', (s) => { s.queueItems[0].taDecision = 'unsure'; }, /taDecision/],
  ['missing TA decision', (s) => { delete s.queueItems[0].taDecision; }, /taDecision/],
  ['empty ID', (s) => { s.labs[0].id = ''; }, /nonempty ID/],
  ['whitespace ID', (s) => { s.memberships[0].taId = ' ta-one'; }, /whitespace/],
  ['invalid deadline', (s) => { s.labs[0].deadline = 'bad-date'; }, /timestamp/],
  ['noncanonical deadline', (s) => { s.labs[0].deadline = '2026-11-09T22:00:00+07:00'; }, /timestamp/],
  ['unknown publication lab', (s) => { s.publications[0].labId = 'missing'; }, /unknown lab/],
  ['duplicate publication', (s) => s.publications.push({ ...s.publications[0] }), /Duplicate publication/],
  ['publication before deadline', (s) => { s.publications[0].publishedAt = '2026-11-09T14:00:00.000Z'; }, /precede/],
  ['publication with pending', (s) => { s.queueItems[0].taDecision = null; }, /pending reviews/],
  ['wrong publication summary', (s) => { s.publications[0].summary.queueItemCount = 99; }, /summary/],
  ['invalid publication time', (s) => { s.publications[0].publishedAt = 'invalid'; }, /timestamp/],
  ['invalid publication author', (s) => { s.publications[0].publishedBy = ''; }, /nonempty ID/],
  ['missing seed array', (s) => { delete s.memberships; }, /must be an array/],
];

for (const [label, mutate, error] of invalidSeeds) {
  test(`invalid seed: ${label}; failed reset preserves previous publication and lookup`, () => {
    const { store, reset } = make('published');
    const before = store.getPublication('lab-1');
    const invalid = createPublishSeed('published');
    mutate(invalid);
    assert.throws(() => createInMemoryPublishStore({ initialState: invalid }), error);
    assert.throws(() => reset(invalid), error);
    assert.deepEqual(store.getPublication('lab-1'), before);
    assert.equal(store.getLab('lab-1').classId, 'class-1');
    assert.equal(store.isTaAssignedToClass('ta-one', 'class-1'), true);
    assert.equal(publish(store).kind, 'already_published');
  });
}

test('tuple keys distinguish IDs that contain separators', () => {
  const seed = createPublishSeed('empty');
  seed.memberships.push({ taId: 'ta:a', classId: 'b' }, { taId: 'ta', classId: 'a:b' });
  const { store } = createInMemoryPublishStore({ initialState: seed });
  assert.equal(store.isTaAssignedToClass('ta:a', 'b'), true);
  assert.equal(store.isTaAssignedToClass('ta', 'a:b'), true);
});

for (const [label, clock] of [
  ['invalid date', () => new Date(NaN)],
  ['non-Date value', () => FIXTURE_AFTER_DEADLINE],
  ['throwing clock', () => { throw new Error('clock failed'); }],
]) {
  test(`${label} cannot create a publication`, () => {
    const { store } = make('resolved', clock);
    const before = store.getReviewState('lab-1');
    assert.throws(() => publish(store), /clock/);
    assert.equal(store.getPublication('lab-1'), undefined);
    assert.deepEqual(store.getReviewState('lab-1'), before);
  });
}

test('invalid publisher is a programming error and cannot create a publication', () => {
  const { store } = make();
  assert.throws(() => publish(store, ' '), /publishedBy/);
  assert.equal(store.getPublication('lab-1'), undefined);
});
