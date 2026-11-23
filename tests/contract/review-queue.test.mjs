import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AFTER_DEADLINE,
  CODE_SORT,
  findItem,
  LAB,
  reviewHarness,
} from '../support/review-queue.mjs';

const PROBLEM = 'application/problem+json; charset=utf-8';
const ITEM_KEYS = [
  'constraintId',
  'constraintText',
  'createdAt',
  'deduction',
  'evidence',
  'id',
  'labId',
  'reason',
  'reviewedAt',
  'reviewedBy',
  'source',
  'studentId',
  'submissionId',
  'taDecision',
  'taEvidence',
  'unsureCause',
  'verdict',
];

test('review queue: the class TA sees every submission x constraint with verdict, evidence, deduction and unsure cause', async (t) => {
  const h = await reviewHarness(t);
  const { sort, merge } = await h.seedQueue();
  const response = await h.queue();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers['cache-control'], 'no-store');
  const body = response.json();
  assert.equal(body.labId, LAB);
  assert.equal(body.classId, 'class-1');
  assert.equal(body.published, false);
  assert.equal(body.publishedAt, null);
  assert.deepEqual(body.state, {
    queueItemCount: 4,
    passDecisionCount: 0,
    violationDecisionCount: 0,
    pendingCount: 4,
  });
  assert.equal(body.items.length, 4);
  for (const item of body.items) {
    assert.deepEqual(Object.keys(item).sort(), ITEM_KEYS);
    assert.equal('code' in item, false); // whole code only on item detail
  }
  const violation = findItem(body, sort.id, 'c1');
  assert.equal(violation.studentId, 'student-1');
  assert.equal(violation.verdict, 'violation');
  assert.equal(violation.source, 'hard_rule');
  assert.deepEqual(violation.evidence, [
    { line: 4, text: '  std::sort(a, a + 3);' },
  ]);
  assert.equal(violation.constraintText, 'Do not use `std::sort`.');
  assert.equal(violation.deduction, 3);
  assert.equal(violation.taDecision, null);
  const unsure = findItem(body, sort.id, 'c2');
  assert.equal(unsure.verdict, 'unsure');
  assert.equal(unsure.unsureCause, 'timeout');
  assert.equal(unsure.deduction, 4);
  assert.equal(findItem(body, merge.id, 'c2').verdict, 'pass');
});

test('review item: detail adds the whole submission code for the TA (FAQ-09)', async (t) => {
  const h = await reviewHarness(t);
  const { sort } = await h.seedQueue();
  const itemId = findItem((await h.queue()).json(), sort.id, 'c2').id;
  const response = await h.item(itemId);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers['cache-control'], 'no-store');
  const body = response.json();
  assert.deepEqual(Object.keys(body).sort(), ['code', 'item']);
  assert.equal(body.code, CODE_SORT);
  assert.deepEqual(Object.keys(body.item).sort(), ITEM_KEYS);
  assert.equal(body.item.unsureCause, 'timeout');
});

test('review queue: unauthenticated callers get 401, students and admins 403, a TA of another class 404', async (t) => {
  const h = await reviewHarness(t);
  const { sort } = await h.seedQueue();
  const itemId = findItem((await h.queue()).json(), sort.id, 'c1').id;
  const calls = {
    queue: (user) => h.queue(user),
    item: (user) => h.item(itemId, user),
    decide: (user) =>
      h.decide(itemId, { decision: 'violation', evidenceLines: [4] }, user),
    confirm: (user) => h.confirmPasses(user),
  };
  for (const [name, call] of Object.entries(calls)) {
    const anonymous = await call(null); // null: no default user, no header
    assert.equal(anonymous.statusCode, 401, name);
    assert.equal(anonymous.headers['www-authenticate'], 'Bearer', name);
    assert.equal(anonymous.headers['content-type'], PROBLEM, name);
    for (const user of ['student-1', 'student-2', 'admin-1']) {
      const forbidden = await call(user);
      assert.equal(forbidden.statusCode, 403, `${name} ${user}`);
      assert.equal(
        forbidden.json().type,
        'https://leetkob.example/problems/forbidden',
      );
    }
    const otherClass = await call('ta-2');
    assert.equal(otherClass.statusCode, 404, `${name} ta-2`);
    assert.equal(
      otherClass.json().type,
      'https://leetkob.example/problems/not-found',
    );
  }
  // Nothing changed through the refused calls.
  assert.equal((await h.queue()).json().state.pendingCount, 4);
});

test('review queue: unknown or malformed IDs return 404 or 400', async (t) => {
  const h = await reviewHarness(t);
  await h.seedQueue();
  assert.equal((await h.queue('ta-1', 'lab-missing')).statusCode, 404);
  assert.equal((await h.item('item-missing')).statusCode, 404);
  assert.equal(
    (await h.decide('item-missing', { decision: 'pass' })).statusCode,
    404,
  );
  assert.equal((await h.confirmPasses('ta-1', 'lab-missing')).statusCode, 404);
  const bad = await h.queue('ta-1', 'bad.id');
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.json().type, 'https://leetkob.example/problems/validation');
  assert.equal((await h.item('bad.id')).statusCode, 400);
});

test('decision: violation needs evidence lines inside the code; the text comes from the code (FAQ-09)', async (t) => {
  const h = await reviewHarness(t);
  const { sort } = await h.seedQueue();
  const itemId = findItem((await h.queue()).json(), sort.id, 'c2').id;
  const invalid = [
    { decision: 'violation' },
    { decision: 'violation', evidenceLines: [] },
    { decision: 'violation', evidenceLines: [0] },
    { decision: 'violation', evidenceLines: [6] }, // the code has 5 lines
    { decision: 'violation', evidenceLines: [1.5] },
    { decision: 'violation', evidenceLines: ['3'] },
    { decision: 'violation', evidenceLines: [3, 3] },
    { decision: 'pass', evidenceLines: [3] },
    // Review of PR #79: only an absent field or [] means "no lines".
    { decision: 'pass', evidenceLines: null },
    { decision: 'violation', evidenceLines: null },
    { decision: 'unsure' },
    { decision: 'violation', evidenceLines: [3], taId: 'ta-2' },
    {},
    [],
  ];
  for (const body of invalid) {
    const response = await h.decide(itemId, body);
    assert.equal(response.statusCode, 400, JSON.stringify(body));
    assert.equal(
      response.json().type,
      'https://leetkob.example/problems/validation',
    );
  }
  const textBody = await h.request(
    'POST',
    `/review-items/${itemId}/decision`,
    'ta-1',
    'decision=violation',
  );
  assert.equal(textBody.statusCode, 415);
  // None of the refused requests recorded a decision.
  assert.equal((await h.item(itemId)).json().item.taDecision, null);

  const ok = await h.decide(itemId, {
    decision: 'violation',
    evidenceLines: [4, 3],
  });
  assert.equal(ok.statusCode, 200, ok.body);
  const item = ok.json().item;
  assert.equal(item.taDecision, 'violation');
  assert.equal(item.reviewedBy, 'ta-1'); // from the session, never the body
  assert.deepEqual(item.taEvidence, [
    { line: 3, text: '  int a[3] = {3, 1, 2};' },
    { line: 4, text: '  std::sort(a, a + 3);' },
  ]);
  const changed = await h.decide(itemId, { decision: 'pass' });
  assert.equal(changed.statusCode, 200, changed.body);
  assert.equal(changed.json().item.taDecision, 'pass');
  assert.deepEqual(changed.json().item.taEvidence, []);
});

test('decision: evidence text is read from the stored code for CRLF files too', async (t) => {
  const h = await reviewHarness(t);
  const crlf = await h.judge(
    'student-1',
    'int main() {\r\n  return 0;\r\n}\r\n',
    (submissionId) => [
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
        verdict: 'unsure',
        evidence: [],
        unsureCause: 'model_unsure',
        reason: null,
        source: 'model',
      },
    ],
  );
  const itemId = findItem((await h.queue()).json(), crlf.id, 'c2').id;
  const response = await h.decide(itemId, {
    decision: 'violation',
    evidenceLines: [2],
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().item.taEvidence, [
    { line: 2, text: '  return 0;' },
  ]);
  assert.equal(
    (await h.decide(itemId, { decision: 'violation', evidenceLines: [4] }))
      .statusCode,
    400,
  );
});

test('confirm passes: bulk-confirms only the unreviewed pass verdicts', async (t) => {
  const h = await reviewHarness(t);
  const { sort } = await h.seedQueue();
  const first = await h.confirmPasses();
  assert.equal(first.statusCode, 200, first.body);
  assert.deepEqual(first.json(), {
    confirmedCount: 2,
    state: {
      queueItemCount: 4,
      passDecisionCount: 2,
      violationDecisionCount: 0,
      pendingCount: 2,
    },
  });
  const queue = (await h.queue()).json();
  assert.equal(findItem(queue, sort.id, 'c1').taDecision, null);
  assert.equal(findItem(queue, sort.id, 'c2').taDecision, null);
  assert.equal((await h.confirmPasses()).json().confirmedCount, 0);
});

test('publish: refused while any verdict, a pass included, is unreviewed; then publishes once', async (t) => {
  const h = await reviewHarness(t);
  const { sort, merge } = await h.seedQueue();
  const queue = (await h.queue()).json();

  const early = await h.publish();
  assert.equal(early.statusCode, 409);
  assert.equal(
    early.json().type,
    'https://leetkob.example/problems/before-deadline',
  );

  h.setTime(AFTER_DEADLINE);
  assert.equal(
    (
      await h.decide(findItem(queue, sort.id, 'c1').id, {
        decision: 'violation',
        evidenceLines: [4],
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await h.decide(findItem(queue, sort.id, 'c2').id, { decision: 'pass' }))
      .statusCode,
    200,
  );
  assert.equal(
    (await h.decide(findItem(queue, merge.id, 'c1').id, { decision: 'pass' }))
      .statusCode,
    200,
  );
  // One pass verdict left unreviewed still blocks Publish.
  const blocked = await h.publish();
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.headers['content-type'], PROBLEM);
  assert.equal(
    blocked.json().type,
    'https://leetkob.example/problems/pending-reviews',
  );
  assert.equal(blocked.json().pendingCount, 1);

  assert.equal((await h.confirmPasses()).json().confirmedCount, 1);
  const published = await h.publish();
  assert.equal(published.statusCode, 200, published.body);
  assert.equal(published.headers['idempotent-replayed'], undefined);
  const publication = published.json();
  assert.equal(publication.labId, LAB);
  assert.equal(publication.classId, 'class-1');
  assert.equal(publication.status, 'published');
  assert.equal(publication.publishedBy, 'ta-1');
  assert.equal(publication.publishedAt, AFTER_DEADLINE);
  assert.deepEqual(publication.summary, {
    queueItemCount: 4,
    passDecisionCount: 3,
    violationDecisionCount: 1,
  });
  const again = await h.publish();
  assert.equal(again.statusCode, 200);
  assert.equal(again.headers['idempotent-replayed'], 'true');
  assert.deepEqual(again.json(), publication);

  const after = (await h.queue()).json();
  assert.equal(after.published, true);
  assert.equal(after.publishedAt, AFTER_DEADLINE);
});

test('publish: contract v1 statuses hold with session tokens', async (t) => {
  const h = await reviewHarness(t);
  await h.seedQueue();
  h.setTime(AFTER_DEADLINE);
  const anonymous = await h.publish(null); // null: no default user, no header
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.headers['www-authenticate'], 'Bearer');
  const malformed = await h.app.inject({
    method: 'POST',
    url: `/labs/${LAB}/publish`,
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
  });
  assert.equal(malformed.statusCode, 401);
  const unknownToken = await h.app.inject({
    method: 'POST',
    url: `/labs/${LAB}/publish`,
    headers: {
      authorization: 'Bearer ' + Buffer.alloc(32, 99).toString('base64url'),
    },
  });
  assert.equal(unknownToken.statusCode, 401);
  for (const user of ['student-1', 'admin-1', 'ta-2']) {
    const forbidden = await h.publish(user);
    assert.equal(forbidden.statusCode, 403, user);
    assert.equal(
      forbidden.json().type,
      'https://leetkob.example/problems/forbidden',
    );
  }
  assert.equal((await h.publish('ta-1', 'lab-missing')).statusCode, 404);
  assert.equal((await h.publish()).statusCode, 409);
});

// Decision after the T09 review (option B): Publish keeps contract v1, so a TA
// of another class gets 403 forbidden (the review queue answers 404). The
// problem body must not reveal the lab's class or any lab data.
test('publish: a TA of another class keeps the contract v1 403 without lab details', async (t) => {
  const h = await reviewHarness(t);
  await h.seedQueue();
  h.setTime(AFTER_DEADLINE);
  const response = await h.publish('ta-2', LAB);
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers['content-type'], PROBLEM);
  assert.deepEqual(response.json(), {
    type: 'https://leetkob.example/problems/forbidden',
    title: 'Forbidden',
    status: 403,
    detail:
      'The authenticated TA is not assigned to the class that owns this lab.',
  });
  for (const secret of ['class-1', LAB, 'deadline', 'pendingCount'])
    assert.equal(response.body.includes(secret), false, secret);
  assert.equal((await h.publish('ta-2', 'lab-missing')).statusCode, 404);
  assert.equal((await h.queue()).json().published, false);
});

test('review queue: a TA of another class gets the same 404 for a real and a missing lab or item', async (t) => {
  const h = await reviewHarness(t);
  const { sort } = await h.seedQueue();
  const itemId = findItem((await h.queue()).json(), sort.id, 'c1').id;
  const pairs = [
    [() => h.queue('ta-2', LAB), () => h.queue('ta-2', 'lab-missing')],
    [() => h.item(itemId, 'ta-2'), () => h.item('item-missing', 'ta-2')],
    [
      () => h.decide(itemId, { decision: 'pass' }, 'ta-2'),
      () => h.decide('item-missing', { decision: 'pass' }, 'ta-2'),
    ],
    [
      () => h.confirmPasses('ta-2', LAB),
      () => h.confirmPasses('ta-2', 'lab-missing'),
    ],
  ];
  for (const [onReal, onMissing] of pairs) {
    const real = await onReal();
    const missing = await onMissing();
    assert.equal(real.statusCode, 404);
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(real.json(), missing.json());
  }
});

// Review of T09: Publish may commit while confirm-passes is running (on
// Postgres it waits for the lab lock). The response must then be 409, not 200.
test('confirm passes: a Publish that commits during the call returns 409', async (t) => {
  const h = await reviewHarness(t);
  const { sort, merge } = await h.seedQueue();
  const queue = (await h.queue()).json();
  h.setTime(AFTER_DEADLINE);
  await h.decide(findItem(queue, sort.id, 'c1').id, {
    decision: 'violation',
    evidenceLines: [4],
  });
  for (const [submission, constraint] of [
    [sort, 'c2'],
    [merge, 'c1'],
    [merge, 'c2'],
  ])
    await h.decide(findItem(queue, submission.id, constraint).id, {
      decision: 'pass',
    });
  // Publish slips in after the route checked the publication, before the
  // Store confirms anything.
  const confirmPasses = h.store.confirmPasses.bind(h.store);
  h.store.confirmPasses = async (input) => {
    const published = await h.store.publishLab({
      labId: LAB,
      publishedBy: 'ta-1',
    });
    assert.equal(published.kind, 'published');
    return confirmPasses(input);
  };
  const response = await h.confirmPasses();
  assert.equal(response.statusCode, 409, response.body);
  assert.equal(
    response.json().type,
    'https://leetkob.example/problems/conflict',
  );
});

test('after publish: review decisions are locked', async (t) => {
  const h = await reviewHarness(t);
  const { sort } = await h.seedQueue();
  const queue = (await h.queue()).json();
  h.setTime(AFTER_DEADLINE);
  await h.decide(findItem(queue, sort.id, 'c1').id, {
    decision: 'violation',
    evidenceLines: [4],
  });
  await h.decide(findItem(queue, sort.id, 'c2').id, { decision: 'pass' });
  await h.confirmPasses();
  assert.equal((await h.publish()).statusCode, 200);

  const locked = await h.decide(findItem(queue, sort.id, 'c2').id, {
    decision: 'violation',
    evidenceLines: [4],
  });
  assert.equal(locked.statusCode, 409);
  assert.equal(locked.json().type, 'https://leetkob.example/problems/conflict');
  const confirm = await h.confirmPasses();
  assert.equal(confirm.statusCode, 409);
  assert.equal(
    (await h.item(findItem(queue, sort.id, 'c2').id)).json().item.taDecision,
    'pass',
  );
});

test('students never receive verdicts before publish (FAQ-08)', async (t) => {
  const h = await reviewHarness(t);
  const { sort } = await h.seedQueue();
  const detail = await h.request('GET', `/submissions/${sort.id}`, 'student-1');
  assert.equal(detail.statusCode, 200, detail.body);
  const submission = detail.json().submission;
  assert.deepEqual(Object.keys(submission).sort(), [
    'code',
    'id',
    'judgeResult',
    'labId',
    'status',
    'studentId',
    'submittedAt',
  ]);
  assert.deepEqual(Object.keys(submission.judgeResult).sort(), [
    'tests',
    'verdict',
  ]);
  const mine = await h.request(
    'GET',
    `/labs/${LAB}/submissions/mine`,
    'student-1',
  );
  assert.equal(mine.statusCode, 200, mine.body);
  const serialized = mine.body + detail.body;
  for (const word of ['violation', 'unsure', 'evidence', 'taDecision'])
    assert.equal(serialized.includes(word), false, word);
});

// Added after the implementation (not part of the red run): the deployed
// /docs page lists the review queue and Publish operations.
test('API docs list the review queue and Publish operations', async (t) => {
  const h = await reviewHarness(t);
  const spec = (await h.app.inject('/docs/json')).json();
  for (const [path, method] of [
    ['/labs/{labId}/review-queue', 'get'],
    ['/review-items/{itemId}', 'get'],
    ['/review-items/{itemId}/decision', 'post'],
    ['/labs/{labId}/review-queue/confirm-passes', 'post'],
    ['/labs/{labId}/publish', 'post'],
  ]) {
    assert.ok(spec.paths[path]?.[method], `${method} ${path}`);
    assert.deepEqual(spec.paths[path][method].security, [{ bearerAuth: [] }]);
  }
  const input = spec.components.schemas.ReviewDecisionInput;
  assert.equal(input.additionalProperties, false);
  assert.deepEqual(input.properties.decision.enum, ['pass', 'violation']);
  assert.equal('deduction' in input.properties, false);
});
