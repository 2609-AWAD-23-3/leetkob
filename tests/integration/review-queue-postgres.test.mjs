import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../../dist/api/app.js';
import { createSessionPublishIdentityResolver } from '../../dist/api/auth/index.js';
import { createPostgresStore } from '../../dist/db/postgres/index.js';
import {
  AFTER_DEADLINE,
  findItem,
  LAB,
  reviewHarness,
} from '../support/review-queue.mjs';

// The review queue and Publish API on the Postgres Store (PA03-T09). Runs
// only with TEST_DATABASE_URL (npm run test:db, CI job postgres-store); every
// harness gets its own schema, dropped at the end.
const url = process.env.TEST_DATABASE_URL;

if (!url) {
  test(
    'postgres review queue tests',
    { skip: 'TEST_DATABASE_URL is not set' },
    () => {},
  );
} else {
  const run = `t09_${process.pid}_${Date.now().toString(36)}`;
  const schemas = [];
  const fixtures = [];
  let counter = 0;
  const makeStore = (schema) => (options) => {
    if (!schemas.includes(schema)) schemas.push(schema);
    const fixture = createPostgresStore({
      connectionString: url,
      schema,
      ...options,
    });
    fixtures.push(fixture);
    return fixture;
  };
  const harness = (t, schema = `${run}_${++counter}`) =>
    reviewHarness(t, { makeStore: makeStore(schema) });

  after(async () => {
    await Promise.allSettled(fixtures.map((fixture) => fixture.store.close()));
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    for (const schema of schemas)
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  test('postgres review queue: TA sees the queue; others are refused', async (t) => {
    const h = await harness(t);
    const { sort } = await h.seedQueue();
    const queue = await h.queue();
    assert.equal(queue.statusCode, 200, queue.body);
    assert.equal(queue.json().items.length, 4);
    assert.deepEqual(queue.json().state, {
      queueItemCount: 4,
      passDecisionCount: 0,
      violationDecisionCount: 0,
      pendingCount: 4,
    });
    const violation = findItem(queue.json(), sort.id, 'c1');
    assert.deepEqual(violation.evidence, [
      { line: 4, text: '  std::sort(a, a + 3);' },
    ]);
    assert.equal(violation.deduction, 3);
    assert.equal(findItem(queue.json(), sort.id, 'c2').unsureCause, 'timeout');
    const detail = await h.item(violation.id);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.match(detail.json().code, /std::sort/);

    assert.equal((await h.queue(null)).statusCode, 401);
    assert.equal((await h.queue('student-1')).statusCode, 403);
    assert.equal((await h.item(violation.id, 'student-1')).statusCode, 403);
    assert.equal((await h.queue('ta-2')).statusCode, 404);
    assert.equal((await h.item(violation.id, 'ta-2')).statusCode, 404);
    assert.equal(
      (
        await h.decide(
          violation.id,
          { decision: 'violation', evidenceLines: [4] },
          'ta-2',
        )
      ).statusCode,
      404,
    );
  });

  test('postgres review queue: evidence rule, pending pass blocks Publish, then publish once and lock', async (t) => {
    const h = await harness(t);
    const { sort, merge } = await h.seedQueue();
    const queue = (await h.queue()).json();
    const unsure = findItem(queue, sort.id, 'c2').id;

    assert.equal(
      (await h.decide(unsure, { decision: 'violation' })).statusCode,
      400,
    );
    assert.equal(
      (await h.decide(unsure, { decision: 'violation', evidenceLines: [9] }))
        .statusCode,
      400,
    );
    const decided = await h.decide(unsure, {
      decision: 'violation',
      evidenceLines: [3],
    });
    assert.equal(decided.statusCode, 200, decided.body);
    assert.deepEqual(decided.json().item.taEvidence, [
      { line: 3, text: '  int a[3] = {3, 1, 2};' },
    ]);
    assert.equal(decided.json().item.reviewedBy, 'ta-1');

    h.setTime(AFTER_DEADLINE);
    await h.decide(findItem(queue, sort.id, 'c1').id, {
      decision: 'violation',
      evidenceLines: [4],
    });
    await h.decide(findItem(queue, merge.id, 'c1').id, { decision: 'pass' });
    const blocked = await h.publish();
    assert.equal(blocked.statusCode, 409);
    assert.equal(
      blocked.json().type,
      'https://leetkob.example/problems/pending-reviews',
    );
    assert.equal(blocked.json().pendingCount, 1);

    const confirmed = await h.confirmPasses();
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    assert.equal(confirmed.json().confirmedCount, 1);
    assert.equal(confirmed.json().state.pendingCount, 0);

    const published = await h.publish();
    assert.equal(published.statusCode, 200, published.body);
    assert.deepEqual(published.json().summary, {
      queueItemCount: 4,
      passDecisionCount: 2,
      violationDecisionCount: 2,
    });
    assert.equal(published.json().publishedBy, 'ta-1');
    const again = await h.publish();
    assert.equal(again.headers['idempotent-replayed'], 'true');
    assert.deepEqual(again.json(), published.json());

    assert.equal(
      (await h.decide(unsure, { decision: 'pass' })).statusCode,
      409,
    );
    assert.equal((await h.confirmPasses()).statusCode, 409);
  });

  test('postgres review queue: publication and decisions survive a restart', async (t) => {
    const schema = `${run}_restart`;
    const h = await harness(t, schema);
    const { sort } = await h.seedQueue();
    const queue = (await h.queue()).json();
    h.setTime(AFTER_DEADLINE);
    await h.decide(findItem(queue, sort.id, 'c1').id, {
      decision: 'violation',
      evidenceLines: [4],
    });
    await h.decide(findItem(queue, sort.id, 'c2').id, { decision: 'pass' });
    await h.confirmPasses();
    const published = await h.publish();
    assert.equal(published.statusCode, 200, published.body);
    await h.app.close();
    await h.store.close();

    // A new process: same schema, no seed; sessions and data come from the database.
    const second = makeStore(schema)({ clock: h.clock });
    await second.ready;
    const app = createApp({
      reviewQueue: { store: second.store },
      publish: {
        store: second.store,
        identityResolver: createSessionPublishIdentityResolver(second.store),
      },
    });
    t.after(() => app.close());
    const reopened = await app.inject({
      url: `/labs/${LAB}/review-queue`,
      headers: h.headers['ta-1'],
    });
    assert.equal(reopened.statusCode, 200, reopened.body);
    assert.equal(reopened.json().published, true);
    assert.equal(reopened.json().state.pendingCount, 0);
    const violation = findItem(reopened.json(), sort.id, 'c1');
    assert.equal(violation.taDecision, 'violation');
    assert.deepEqual(violation.taEvidence, [
      { line: 4, text: '  std::sort(a, a + 3);' },
    ]);
    const replay = await app.inject({
      method: 'POST',
      url: `/labs/${LAB}/publish`,
      headers: h.headers['ta-1'],
    });
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.headers['idempotent-replayed'], 'true');
    assert.deepEqual(replay.json(), published.json());
    const locked = await app.inject({
      method: 'POST',
      url: `/review-items/${violation.id}/decision`,
      headers: h.headers['ta-1'],
      payload: { decision: 'pass' },
    });
    assert.equal(locked.statusCode, 409);
  });

  // Review of T09: hold the lab row lock the way publishLab does, start
  // confirm-passes (it waits on the lock), then commit a publication.
  test('postgres review queue: confirm-passes waiting behind a Publish returns 409', async (t) => {
    const schema = `${run}_lock`;
    const h = await harness(t, schema);
    const { sort, merge } = await h.seedQueue();
    const queue = (await h.queue()).json();
    h.setTime(AFTER_DEADLINE);
    await h.decide(findItem(queue, sort.id, 'c1').id, {
      decision: 'violation',
      evidenceLines: [4],
    });
    await h.decide(findItem(queue, sort.id, 'c2').id, { decision: 'pass' });
    await h.decide(findItem(queue, merge.id, 'c1').id, { decision: 'pass' });

    const publisher = new pg.Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await publisher.connect();
    t.after(() => publisher.end());
    await publisher.query('BEGIN');
    await publisher.query('SELECT 1 FROM labs WHERE id = $1 FOR UPDATE', [LAB]);
    const pending = h.confirmPasses();
    // Wait until the confirm-passes transaction is blocked on the lab lock.
    let waiting = 0;
    for (let i = 0; i < 200 && waiting === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const { rows } = await publisher.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock'
           AND pid <> pg_backend_pid()`,
      );
      waiting = rows[0].n;
    }
    assert.equal(waiting, 1, 'confirm-passes never waited on the lab lock');
    await publisher.query(
      `INSERT INTO publications (lab_id, published_at, published_by,
         queue_item_count, pass_decision_count, violation_decision_count)
       VALUES ($1, $2, 'ta-1', 4, 2, 1)`,
      [LAB, AFTER_DEADLINE],
    );
    await publisher.query('COMMIT');
    const response = await pending;
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(
      response.json().type,
      'https://leetkob.example/problems/conflict',
    );
    // The unreviewed pass was not confirmed after publication.
    const after = (await h.queue()).json();
    assert.equal(after.published, true);
    assert.equal(findItem(after, merge.id, 'c2').taDecision, null);
  });
}
