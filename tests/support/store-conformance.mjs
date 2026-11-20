import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoreSeed, FIXTURE_DEADLINE } from '../../dist/db/index.js';

// Behaviour every Store implementation must share. Phase 2 runs the same
// suite against Postgres. makeFixture({ seed, clock, idGenerator }) must
// return { store } with fresh, isolated state.

const START = '2026-11-09T10:00:00.000Z'; // before FIXTURE_DEADLINE
const LAB = 'lab-sort';

function controllableClock(start = START) {
  let ms = Date.parse(start);
  return {
    clock: () => new Date(ms),
    advance(deltaMs) {
      ms += deltaMs;
    },
    set(iso) {
      ms = Date.parse(iso);
    },
  };
}

function sequentialIds() {
  let next = 0;
  return () => `id-${++next}`;
}

const AC = {
  verdict: 'AC',
  tests: [
    { testId: 't1', verdict: 'AC' },
    { testId: 't2', verdict: 'AC' },
  ],
};
const WA = {
  verdict: 'WA',
  tests: [
    { testId: 't1', verdict: 'WA' },
    { testId: 't2', verdict: 'AC' },
  ],
};

function verdict(submissionId, constraintId, value, extra = {}) {
  return {
    submissionId,
    constraintId,
    verdict: value,
    evidence:
      value === 'violation' ? [{ line: 3, text: 'std::sort(a, a + n);' }] : [],
    unsureCause: value === 'unsure' ? 'model_unsure' : null,
    reason: null,
    source: 'model',
    ...extra,
  };
}

export function defineStoreConformance(label, makeFixture) {
  const setup = () => {
    const time = controllableClock();
    const { store } = makeFixture({
      seed: createStoreSeed(),
      clock: time.clock,
      idGenerator: sequentialIds(),
    });
    // Submits, claims and completes one submission in a single helper.
    const judge = async (studentId, judgeResult, verdictsFor) => {
      const submission = await store.submit({
        labId: LAB,
        studentId,
        code: 'int main() {}',
      });
      const job = await store.claim({
        workerId: 'worker-a',
        leaseMs: 60_000,
        maxAttempts: 3,
      });
      assert.equal(job.submissionId, submission.id);
      const ok = await store.complete({
        jobId: job.id,
        workerId: 'worker-a',
        judgeResult,
        verdicts: verdictsFor(submission.id),
      });
      assert.equal(ok, true);
      return submission;
    };
    return { store, time, judge };
  };

  test(`${label}: login lookup returns the hash apart from the public user`, async () => {
    const { store } = setup();
    const found = await store.findUserByUsername('ta1');
    assert.deepEqual(found, {
      user: { id: 'ta-1', username: 'ta1', displayName: 'TA One', role: 'TA' },
      passwordHash: 'test-hash-ta1',
    });
    assert.equal(await store.findUserByUsername('nobody'), undefined);
    assert.equal((await store.getUser('ta-1')).passwordHash, undefined);
  });

  test(`${label}: sessions expire by the store clock and can be deleted`, async () => {
    const { store, time } = setup();
    await store.createSession({
      tokenHash: 'hash-a',
      userId: 'student-1',
      expiresAt: '2026-11-09T11:00:00.000Z',
    });
    assert.equal((await store.getSessionUser('hash-a')).id, 'student-1');
    time.set('2026-11-09T11:00:00.000Z');
    assert.equal(await store.getSessionUser('hash-a'), undefined);
    await store.createSession({
      tokenHash: 'hash-b',
      userId: 'student-1',
      expiresAt: '2026-11-10T00:00:00.000Z',
    });
    await store.deleteSession('hash-b');
    assert.equal(await store.getSessionUser('hash-b'), undefined);
  });

  test(`${label}: memberships scope the labs a user sees`, async () => {
    const { store } = setup();
    assert.deepEqual(await store.getMembership('ta-1', 'class-1'), {
      userId: 'ta-1',
      classId: 'class-1',
      role: 'TA',
    });
    assert.equal(await store.getMembership('ta-2', 'class-1'), undefined);
    assert.deepEqual(
      (await store.listLabsForUser('student-1')).map((lab) => lab.id),
      [LAB],
    );
    assert.deepEqual(await store.listLabsForUser('ta-2'), []);
  });

  test(`${label}: createLab stores a valid lab and rejects bad limits or deductions`, async () => {
    const { store } = setup();
    const base = await store.getLab(LAB);
    delete base.id;
    delete base.createdAt;
    const lab = await store.createLab({ ...base, title: 'Second lab' });
    assert.equal(lab.title, 'Second lab');
    assert.equal(lab.createdAt, START);
    assert.deepEqual(await store.getLab(lab.id), lab);
    const badDeduction = {
      ...base,
      constraints: [{ id: 'c1', text: 'No loops.', deduction: 0 }],
    };
    await assert.rejects(store.createLab(badDeduction), TypeError);
    const badLimits = { ...base, limits: { cpuTimeMs: 6000, memoryMb: 256 } };
    await assert.rejects(store.createLab(badLimits), TypeError);
    await assert.rejects(
      store.createLab({ ...base, classId: 'class-9' }),
      TypeError,
    );
    await assert.rejects(
      store.createLab({ ...base, createdBy: 'ghost-ta' }),
      TypeError,
    );
  });

  test(`${label}: opensAt defaults to createdAt and must be before the deadline`, async () => {
    const { store } = setup();
    const base = await store.getLab(LAB);
    assert.equal(base.opensAt, '2026-11-02T00:00:00.000Z');
    delete base.id;
    delete base.createdAt;
    const scheduled = await store.createLab({
      ...base,
      opensAt: '2026-11-09T12:00:00.000Z',
    });
    assert.equal(scheduled.opensAt, '2026-11-09T12:00:00.000Z');
    const { opensAt: _ignored, ...withoutOpensAt } = base;
    const immediate = await store.createLab(withoutOpensAt);
    assert.equal(immediate.opensAt, immediate.createdAt);
    for (const opensAt of [
      FIXTURE_DEADLINE,
      '2026-11-10T00:00:00.000Z',
      '2026-11-09',
    ]) {
      await assert.rejects(store.createLab({ ...base, opensAt }), TypeError);
    }
    // Created after its deadline without opensAt: it would open after it closes.
    await assert.rejects(
      store.createLab({
        ...withoutOpensAt,
        deadline: '2026-11-09T09:00:00.000Z',
      }),
      TypeError,
    );
  });

  const unknownLabFields = [
    ['on the lab', (lab) => (lab.published = true)],
    ['as a client-chosen id', (lab) => (lab.id = 'lab-mine')],
    ['on the limits', (lab) => (lab.limits.wallTimeMs = 9000)],
    ['on a test', (lab) => (lab.tests[0].hidden = true)],
    ['on a constraint', (lab) => (lab.constraints[0].hidden = true)],
  ];

  for (const [where, mutate] of unknownLabFields) {
    test(`${label}: createLab rejects an unknown field ${where}`, async () => {
      const { store } = setup();
      const input = await store.getLab(LAB);
      delete input.id;
      delete input.createdAt;
      mutate(input);
      await assert.rejects(store.createLab(input), TypeError);
      assert.deepEqual(
        (await store.listLabsForUser('ta-1')).map((lab) => lab.id),
        [LAB],
      );
    });
  }

  test(`${label}: returned objects are copies`, async () => {
    const { store } = setup();
    const lab = await store.getLab(LAB);
    lab.constraints[0].deduction = 10;
    assert.equal((await store.getLab(LAB)).constraints[0].deduction, 3);
  });

  test(`${label}: submit stores a queued submission and exactly one job`, async () => {
    const { store } = setup();
    const submission = await store.submit({
      labId: LAB,
      studentId: 'student-1',
      code: 'int main() {}',
    });
    assert.equal(submission.status, 'queued');
    assert.equal(submission.submittedAt, START);
    assert.equal(submission.judgeResult, null);
    const job = await store.claim({
      workerId: 'worker-a',
      leaseMs: 1000,
      maxAttempts: 3,
    });
    assert.equal(job.submissionId, submission.id);
    assert.equal(job.attempts, 1);
    assert.equal((await store.getSubmission(submission.id)).status, 'judging');
    assert.equal(
      await store.claim({
        workerId: 'worker-b',
        leaseMs: 1000,
        maxAttempts: 3,
      }),
      undefined,
    );
  });

  test(`${label}: an expired lease is reclaimed and only the holder can complete`, async () => {
    const { store, time } = setup();
    const submission = await store.submit({
      labId: LAB,
      studentId: 'student-1',
      code: 'int main() {}',
    });
    const first = await store.claim({
      workerId: 'worker-a',
      leaseMs: 1000,
      maxAttempts: 3,
    });
    time.advance(500);
    assert.equal(
      await store.extendLease({
        jobId: first.id,
        workerId: 'worker-a',
        leaseMs: 1000,
      }),
      true,
    );
    time.advance(1001);
    const second = await store.claim({
      workerId: 'worker-b',
      leaseMs: 1000,
      maxAttempts: 3,
    });
    assert.equal(second.id, first.id);
    assert.equal(second.attempts, 2);
    const verdicts = [
      verdict(submission.id, 'c1', 'pass'),
      verdict(submission.id, 'c2', 'pass'),
    ];
    assert.equal(
      await store.complete({
        jobId: first.id,
        workerId: 'worker-a',
        judgeResult: AC,
        verdicts,
      }),
      false,
    );
    assert.equal(
      await store.complete({
        jobId: second.id,
        workerId: 'worker-b',
        judgeResult: AC,
        verdicts,
      }),
      true,
    );
    assert.equal(
      await store.complete({
        jobId: second.id,
        workerId: 'worker-b',
        judgeResult: AC,
        verdicts,
      }),
      false,
    );
    assert.equal((await store.listVerdicts(submission.id)).length, 2);
    assert.equal((await store.getSubmission(submission.id)).status, 'judged');
    assert.equal(
      await store.claim({
        workerId: 'worker-c',
        leaseMs: 1000,
        maxAttempts: 3,
      }),
      undefined,
    );
  });

  // Each case replaces the full, valid AC batch (c1 pass, c2 violation).
  const invalidCompletes = [
    ['verdicts for a non-AC result', (b) => (b.judgeResult = WA)],
    [
      'an unknown judge verdict',
      (b) => (b.judgeResult = { verdict: 'OK', tests: [] }),
    ],
    ['an AC batch missing a constraint', (b) => b.verdicts.pop()],
    [
      'a duplicate pair in one batch',
      (b) => (b.verdicts[1].constraintId = 'c1'),
    ],
    ['an unknown constraint', (b) => (b.verdicts[1].constraintId = 'c9')],
    ['an unknown verdict value', (b) => (b.verdicts[0].verdict = 'bogus')],
    ['evidence that is not an array', (b) => (b.verdicts[0].evidence = 'nope')],
    [
      'evidence line 0',
      (b) => (b.verdicts[1].evidence = [{ line: 0, text: 'x' }]),
    ],
    ['a violation without evidence', (b) => (b.verdicts[1].evidence = [])],
    ['an unknown source', (b) => (b.verdicts[0].source = 'oracle')],
    ['a numeric reason', (b) => (b.verdicts[0].reason = 5)],
    [
      'an unsure verdict without a cause',
      (b) => {
        b.verdicts[0].verdict = 'unsure';
        b.verdicts[0].unsureCause = null;
      },
    ],
    [
      'an unknown unsure cause',
      (b) => {
        b.verdicts[0].verdict = 'unsure';
        b.verdicts[0].unsureCause = 'gut_feeling';
      },
    ],
    [
      'an unsureCause on a pass verdict',
      (b) => (b.verdicts[0].unsureCause = 'timeout'),
    ],
    ['an unknown field on a verdict', (b) => (b.verdicts[1].deduction = 9)],
    [
      'an unknown field on evidence',
      (b) => (b.verdicts[1].evidence[0].deduction = 9),
    ],
    [
      'an unknown field on the judge result',
      (b) => (b.judgeResult = { ...AC, score: 10 }),
    ],
    [
      'an unknown field on a test result',
      (b) =>
        (b.judgeResult = {
          verdict: 'AC',
          tests: [{ testId: 't1', verdict: 'AC', output: '1 2 3' }],
        }),
    ],
  ];

  for (const [name, mutate] of invalidCompletes) {
    test(`${label}: complete rejects ${name} and writes nothing`, async () => {
      const { store } = setup();
      const submission = await store.submit({
        labId: LAB,
        studentId: 'student-1',
        code: 'int main() {}',
      });
      const job = await store.claim({
        workerId: 'worker-a',
        leaseMs: 60_000,
        maxAttempts: 3,
      });
      const batch = {
        jobId: job.id,
        workerId: 'worker-a',
        judgeResult: AC,
        verdicts: [
          verdict(submission.id, 'c1', 'pass'),
          verdict(submission.id, 'c2', 'violation'),
        ],
      };
      mutate(batch);
      await assert.rejects(store.complete(batch), TypeError);
      assert.deepEqual(await store.listVerdicts(submission.id), []);
      const after = await store.getSubmission(submission.id);
      assert.equal(after.status, 'judging');
      assert.equal(after.judgeResult, null);
    });
  }

  test(`${label}: a worker that crashes on every attempt ends the submission as failed`, async () => {
    const { store, time } = setup();
    const submission = await store.submit({
      labId: LAB,
      studentId: 'student-1',
      code: 'int main() {}',
    });
    const claim = () =>
      store.claim({ workerId: 'worker-a', leaseMs: 1000, maxAttempts: 2 });
    assert.equal((await claim()).attempts, 1);
    time.advance(1001); // crashed: no complete, no fail
    assert.equal((await claim()).attempts, 2);
    time.advance(1001);
    assert.equal(await claim(), undefined);
    assert.equal((await store.getSubmission(submission.id)).status, 'failed');
    assert.equal((await store.getReviewState(LAB)).pendingCount, 1);
    assert.equal(await store.requeue(submission.id), true);
    assert.equal((await claim()).attempts, 1);
  });

  test(`${label}: claim and fail reject a missing or invalid maxAttempts`, async () => {
    const { store } = setup();
    await store.submit({ labId: LAB, studentId: 'student-1', code: '' });
    await assert.rejects(
      store.claim({ workerId: 'worker-a', leaseMs: 1000 }),
      TypeError,
    );
    const job = await store.claim({
      workerId: 'worker-a',
      leaseMs: 1000,
      maxAttempts: 3,
    });
    for (const maxAttempts of [undefined, 0, 1.5]) {
      await assert.rejects(
        store.fail({
          jobId: job.id,
          workerId: 'worker-a',
          error: 'x',
          maxAttempts,
        }),
        TypeError,
      );
    }
  });

  test(`${label}: fail retries, then marks the submission failed until requeued`, async () => {
    const { store } = setup();
    const submission = await store.submit({
      labId: LAB,
      studentId: 'student-1',
      code: 'int main() {}',
    });
    const attempt = async () => {
      const job = await store.claim({
        workerId: 'worker-a',
        leaseMs: 1000,
        maxAttempts: 3,
      });
      return store.fail({
        jobId: job.id,
        workerId: 'worker-a',
        error: 'sandbox down',
        maxAttempts: 2,
      });
    };
    assert.equal(await attempt(), true);
    assert.equal((await store.getSubmission(submission.id)).status, 'queued');
    assert.equal(await attempt(), true);
    assert.equal((await store.getSubmission(submission.id)).status, 'failed');
    assert.equal(
      await store.claim({
        workerId: 'worker-a',
        leaseMs: 1000,
        maxAttempts: 3,
      }),
      undefined,
    );
    assert.equal((await store.getReviewState(LAB)).pendingCount, 1);
    assert.equal(await store.requeue(submission.id), true);
    assert.equal(await store.requeue(submission.id), false);
    assert.equal((await store.getSubmission(submission.id)).status, 'queued');
    assert.notEqual(
      await store.claim({
        workerId: 'worker-a',
        leaseMs: 1000,
        maxAttempts: 3,
      }),
      undefined,
    );
  });

  test(`${label}: the counted submission is the last one received before the deadline`, async () => {
    const { store, time } = setup();
    const submit = () =>
      store.submit({
        labId: LAB,
        studentId: 'student-1',
        code: 'int main() {}',
      });
    await submit();
    time.advance(60_000);
    const last = await submit();
    time.set(FIXTURE_DEADLINE);
    await submit(); // received exactly at the deadline: not counted
    const counted = await store.listCountedSubmissions(LAB);
    assert.deepEqual(
      counted.map((s) => s.id),
      [last.id],
    );
    assert.equal((await store.listSubmissions(LAB, 'student-1')).length, 3);
  });

  test(`${label}: a submission received before opensAt is never counted`, async () => {
    const { store, time } = setup();
    time.set('2026-11-01T12:00:00.000Z'); // before the seed lab opens
    await store.submit({ labId: LAB, studentId: 'student-2', code: '' });
    assert.deepEqual(await store.listCountedSubmissions(LAB), []);
    assert.equal((await store.getReviewState(LAB)).pendingCount, 0);
  });

  test(`${label}: the queue holds every verdict of counted AC submissions only`, async () => {
    const { store, judge } = setup();
    const accepted = await judge('student-1', AC, (id) => [
      verdict(id, 'c1', 'pass'),
      verdict(id, 'c2', 'violation'),
    ]);
    await judge('student-2', WA, () => []);
    const queue = await store.listReviewQueue(LAB);
    assert.deepEqual(
      queue.map((item) => [
        item.submissionId,
        item.constraintId,
        item.verdict,
        item.deduction,
      ]),
      [
        [accepted.id, 'c1', 'pass', 3],
        [accepted.id, 'c2', 'violation', 4],
      ],
    );
    assert.equal(queue[1].constraintText, 'Implement merge sort yourself.');
    assert.equal(queue[1].studentId, 'student-1');
    assert.deepEqual(await store.getReviewState(LAB), {
      queueItemCount: 2,
      passDecisionCount: 0,
      violationDecisionCount: 0,
      pendingCount: 2,
    });
  });

  test(`${label}: an unreviewed pass blocks until confirmed in bulk`, async () => {
    const { store, judge } = setup();
    await judge('student-1', AC, (id) => [
      verdict(id, 'c1', 'pass'),
      verdict(id, 'c2', 'violation'),
    ]);
    const [passItem, violationItem] = await store.listReviewQueue(LAB);
    const decided = await store.decide({
      itemId: violationItem.id,
      decision: 'violation',
      taId: 'ta-1',
      evidence: [{ line: 3, text: 'std::sort(a, a + n);' }],
    });
    assert.equal(decided.taDecision, 'violation');
    assert.equal(decided.reviewedBy, 'ta-1');
    assert.equal((await store.getReviewState(LAB)).pendingCount, 1);
    assert.equal(await store.confirmPasses({ labId: LAB, taId: 'ta-1' }), 1);
    assert.equal(await store.confirmPasses({ labId: LAB, taId: 'ta-1' }), 0);
    assert.equal((await store.getReviewItem(passItem.id)).taDecision, 'pass');
    assert.deepEqual(await store.getReviewState(LAB), {
      queueItemCount: 2,
      passDecisionCount: 1,
      violationDecisionCount: 1,
      pendingCount: 0,
    });
  });

  test(`${label}: unfinished counted submissions count as pending`, async () => {
    const { store } = setup();
    await store.submit({
      labId: LAB,
      studentId: 'student-1',
      code: 'int main() {}',
    });
    assert.deepEqual(await store.getReviewState(LAB), {
      queueItemCount: 0,
      passDecisionCount: 0,
      violationDecisionCount: 0,
      pendingCount: 1,
    });
    assert.equal(await store.getReviewState('lab-unknown'), undefined);
  });

  test(`${label}: decide and confirmPasses reject an unknown reviewer or bad evidence`, async () => {
    const { store, judge } = setup();
    await judge('student-1', AC, (id) => [
      verdict(id, 'c1', 'pass'),
      verdict(id, 'c2', 'violation'),
    ]);
    const [item] = await store.listReviewQueue(LAB);
    await assert.rejects(
      store.decide({ itemId: item.id, decision: 'pass', taId: 'ghost-ta' }),
      TypeError,
    );
    await assert.rejects(
      store.confirmPasses({ labId: LAB, taId: 'ghost-ta' }),
      TypeError,
    );
    for (const evidence of [
      'line 3',
      [{ line: 0, text: 'x' }],
      [{ line: 2 }],
      [{ line: 2, text: 'x', deduction: 9 }],
    ]) {
      await assert.rejects(
        store.decide({
          itemId: item.id,
          decision: 'violation',
          taId: 'ta-1',
          evidence,
        }),
        TypeError,
      );
    }
    assert.equal((await store.getReviewItem(item.id)).taDecision, null);
    assert.deepEqual(await store.listDecisionLog(item.id), []);
  });

  test(`${label}: every decision change is logged`, async () => {
    const { store, judge, time } = setup();
    await judge('student-1', AC, (id) => [
      verdict(id, 'c1', 'unsure'),
      verdict(id, 'c2', 'pass'),
    ]);
    const [item] = await store.listReviewQueue(LAB);
    assert.equal(item.unsureCause, 'model_unsure');
    await store.decide({ itemId: item.id, decision: 'pass', taId: 'ta-1' });
    time.advance(1000);
    await store.decide({
      itemId: item.id,
      decision: 'violation',
      taId: 'ta-1',
    });
    // Identical repeat: nothing changes, nothing is logged.
    await store.decide({
      itemId: item.id,
      decision: 'violation',
      taId: 'ta-1',
    });
    // Same decision, new evidence: logged.
    const lines = [{ line: 4, text: 'std::sort(a, a + n);' }];
    await store.decide({
      itemId: item.id,
      decision: 'violation',
      taId: 'ta-1',
      evidence: lines,
    });
    // Same evidence with keys in another order: unchanged, not logged.
    await store.decide({
      itemId: item.id,
      decision: 'violation',
      taId: 'ta-1',
      evidence: [{ text: 'std::sort(a, a + n);', line: 4 }],
    });
    // Same decision and evidence, another reviewer: logged.
    await store.decide({
      itemId: item.id,
      decision: 'violation',
      taId: 'admin-1',
      evidence: lines,
    });
    const log = await store.listDecisionLog(item.id);
    assert.deepEqual(
      log.map((entry) => [
        entry.previous,
        entry.next,
        entry.changedBy,
        entry.evidence.length,
      ]),
      [
        [null, 'pass', 'ta-1', 0],
        ['pass', 'violation', 'ta-1', 0],
        ['violation', 'violation', 'ta-1', 1],
        ['violation', 'violation', 'admin-1', 1],
      ],
    );
    assert.equal(log[1].changedAt, '2026-11-09T10:00:01.000Z');
    const reviewed = await store.getReviewItem(item.id);
    assert.equal(reviewed.reviewedBy, 'admin-1');
    assert.deepEqual(reviewed.taEvidence, lines);
  });

  test(`${label}: verdicts of a replaced submission leave the queue`, async () => {
    const { store, judge } = setup();
    await judge('student-1', AC, (id) => [
      verdict(id, 'c1', 'pass'),
      verdict(id, 'c2', 'pass'),
    ]);
    const [oldItem] = await store.listReviewQueue(LAB);
    await store.submit({
      labId: LAB,
      studentId: 'student-1',
      code: 'int main() { return 0; }',
    });
    assert.deepEqual(await store.listReviewQueue(LAB), []);
    assert.equal(await store.getReviewItem(oldItem.id), undefined);
    assert.equal(
      await store.decide({
        itemId: oldItem.id,
        decision: 'pass',
        taId: 'ta-1',
      }),
      undefined,
    );
    assert.equal((await store.getReviewState(LAB)).pendingCount, 1);
  });

  test(`${label}: model calls are logged per submission`, async () => {
    const { store } = setup();
    const submission = await store.submit({
      labId: LAB,
      studentId: 'student-1',
      code: 'int main() {}',
    });
    const logged = await store.recordModelCall({
      submissionId: submission.id,
      constraintIds: ['c2'],
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      requestId: 'req_test',
      inputTokens: 2000,
      outputTokens: 1000,
      latencyMs: 1200,
      costUsd: 0.0007,
      outcome: 'ok',
    });
    assert.equal(logged.createdAt, START);
    assert.deepEqual(await store.listModelCalls(submission.id), [logged]);
  });
}
