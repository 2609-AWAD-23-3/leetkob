import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoreSeed } from '../../dist/db/index.js';
import { newLab, LAB_KEY, LAB_NOW } from './labs.mjs';
import { randomUUID } from 'node:crypto';

export function defineLabConformance(label, makeFixture) {
  test(`${label}: idempotent lab creation is atomic, scoped and expires at 24 hours`, async () => {
    let now = Date.parse(LAB_NOW);
    const fixture = makeFixture({
      seed: createStoreSeed(),
      clock: () => new Date(now),
    });
    const store = fixture.store;
    const input = newLab();
    const results = await Promise.all([
      store.createLabIdempotently(input, LAB_KEY),
      store.createLabIdempotently(input, LAB_KEY),
    ]);
    assert.deepEqual(results.map((r) => r.kind).sort(), [
      'created',
      'replayed',
    ]);
    assert.equal(results[0].lab.id, results[1].lab.id);
    assert.equal(
      (
        await store.createLabIdempotently(
          { ...input, title: 'Changed' },
          LAB_KEY,
        )
      ).kind,
      'conflict',
    );
    assert.equal(
      (
        await store.createLabIdempotently(
          { ...input, createdBy: 'ta-2' },
          LAB_KEY,
        )
      ).kind,
      'created',
    );
    assert.equal(
      (
        await store.createLabIdempotently(
          { ...input, classId: 'class-2' },
          LAB_KEY,
        )
      ).kind,
      'created',
    );
    await assert.rejects(
      store.createLabIdempotently(
        { ...input, classId: 'missing-class' },
        randomUUID(),
      ),
      TypeError,
    );
    await assert.rejects(
      store.createLabIdempotently(
        { ...input, createdBy: 'missing-user' },
        randomUUID(),
      ),
      TypeError,
    );
    assert.equal(
      (
        await store.createLabIdempotently(
          { ...input, deadline: LAB_NOW },
          randomUUID(),
        )
      ).kind,
      'invalid-time',
    );
    now += 86_400_000 - 1;
    assert.equal(
      (await store.createLabIdempotently(input, LAB_KEY)).kind,
      'replayed',
    );
    now += 1;
    const renewed = await store.createLabIdempotently(input, LAB_KEY);
    assert.equal(renewed.kind, 'created');
    assert.notEqual(renewed.lab.id, results[0].lab.id);
    assert.ok(await store.getLab(results[0].lab.id));
    const summaries = await store.listLabSummariesForClass('class-1');
    assert.equal(summaries[0].id, renewed.lab.id);
    assert.equal('tests' in summaries[0], false);
    assert.equal('constraints' in summaries[0], false);
    const tied = summaries
      .filter((lab) => lab.createdAt === LAB_NOW)
      .map((lab) => lab.id);
    assert.deepEqual(tied, [...tied].sort());
  });
  test(`${label}: replay survives deadline while valid and reset clears keys`, async () => {
    let now = Date.parse(LAB_NOW);
    const fixture = makeFixture({
      seed: createStoreSeed(),
      clock: () => new Date(now),
    });
    const input = newLab({ deadline: '2026-11-22T01:00:00.000Z' });
    assert.equal(
      (await fixture.store.createLabIdempotently(input, LAB_KEY)).kind,
      'created',
    );
    now += 3_600_000;
    assert.equal(
      (await fixture.store.createLabIdempotently(input, LAB_KEY)).kind,
      'replayed',
    );
    await fixture.reset(createStoreSeed());
    assert.equal(
      (await fixture.store.createLabIdempotently(input, LAB_KEY)).kind,
      'invalid-time',
    );
    const created = await fixture.store.createLabIdempotently(
      newLab(),
      LAB_KEY,
    );
    assert.equal(created.kind, 'created');
  });
}
