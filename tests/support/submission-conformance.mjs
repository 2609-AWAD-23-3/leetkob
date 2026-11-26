import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createStoreSeed } from '../../dist/db/index.js';
import { LAB_NOW, LAB_KEY, newLab } from './labs.mjs';

export function defineSubmissionConformance(label, makeFixture) {
  test(`${label}: atomic intake, scope, TTL, persistence-safe reset`, async (t) => {
    let now = Date.parse(LAB_NOW);
    const f = makeFixture({
      seed: createStoreSeed(),
      clock: () => new Date(now),
    });
    t.after(() => f.store.close());
    const lab = await f.store.createLab(newLab());
    const input = {
      labId: lab.id,
      studentId: 'student-1',
      code: 'int main(){}\n',
    };
    const results = await Promise.all([
      f.store.submitIdempotently(input, LAB_KEY),
      f.store.submitIdempotently(input, LAB_KEY),
    ]);
    assert.deepEqual(results.map((r) => r.kind).sort(), [
      'created',
      'replayed',
    ]);
    assert.equal(results[0].submission.id, results[1].submission.id);
    assert.equal(
      (
        await f.store.submitIdempotently(
          { ...input, code: 'different' },
          LAB_KEY,
        )
      ).kind,
      'conflict',
    );
    assert.equal(
      (
        await f.store.submitIdempotently(
          { ...input, studentId: 'student-2' },
          LAB_KEY,
        )
      ).kind,
      'created',
    );
    assert.equal(
      (
        await f.store.submitIdempotently(
          { ...input, studentId: 'ta-1' },
          randomUUID(),
        )
      ).kind,
      'not-found',
    );
    now += 86_400_000 - 1;
    assert.equal(
      (await f.store.submitIdempotently(input, LAB_KEY)).kind,
      'replayed',
    );
    now++;
    const renewed = await f.store.submitIdempotently(input, LAB_KEY);
    assert.equal(renewed.kind, 'created');
    assert.notEqual(renewed.submission.id, results[0].submission.id);
    assert.ok(await f.store.getSubmission(results[0].submission.id));
    const page = await f.store.listSubmissionSummaries({
      labId: lab.id,
      limit: 1,
    });
    assert.equal(page.submissions[0].id, renewed.submission.id);
    assert.ok(page.next);
    assert.equal('code' in page.submissions[0], false);
    assert.equal('judgeResult' in page.submissions[0], false);
    const rest = await f.store.listSubmissionSummaries({
      labId: lab.id,
      limit: 100,
      after: page.next,
    });
    assert.equal(rest.submissions.length, 2);
    await assert.rejects(
      f.store.submitIdempotently({ ...input, code: '\u0000' }, randomUUID()),
      TypeError,
    );
    await assert.rejects(
      f.store.listSubmissionSummaries({ labId: lab.id, limit: 101 }),
      TypeError,
    );
    await f.reset(createStoreSeed());
    assert.equal(
      (await f.store.submitIdempotently(input, LAB_KEY)).kind,
      'not-found',
    );
  });
  test(`${label}: receipt time boundaries, post-deadline replay and last attempt counted`, async (t) => {
    let now = Date.parse(LAB_NOW);
    const f = makeFixture({
      seed: createStoreSeed(),
      clock: () => new Date(now),
    });
    t.after(() => f.store.close());
    const lab = await f.store.createLab(
      newLab({
        opensAt: '2026-11-22T00:01:00.000Z',
        deadline: '2026-11-22T00:02:00.000Z',
      }),
    );
    const input = { labId: lab.id, studentId: 'student-1', code: 'first' };
    assert.equal(
      (await f.store.submitIdempotently(input, LAB_KEY)).kind,
      'not-open',
    );
    now += 60_000;
    const first = await f.store.submitIdempotently(input, LAB_KEY);
    assert.equal(first.kind, 'created');
    const last = await f.store.submitIdempotently(
      { ...input, code: 'last syntax error' },
      randomUUID(),
    );
    assert.equal(last.kind, 'created');
    now += 60_000;
    assert.equal(
      (await f.store.submitIdempotently(input, LAB_KEY)).kind,
      'replayed',
    );
    assert.equal(
      (await f.store.submitIdempotently(input, randomUUID())).kind,
      'not-open',
    );
    assert.deepEqual(
      (await f.store.listCountedSubmissions(lab.id)).map((s) => s.id),
      [last.submission.id],
    );
  });
}
