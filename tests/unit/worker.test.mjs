import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInMemoryStore,
  createStoreSeed,
  STORE_FIXTURE_OPENS_AT,
} from '../../dist/db/index.js';
import {
  createDefaultJudgeSubmission,
  createDefaultSubmissionEvaluator,
  createQueueWorker,
} from '../../dist/worker/index.js';

const OPEN_MS = Date.parse(STORE_FIXTURE_OPENS_AT) + 60_000;

function makeClock(initialMs = OPEN_MS) {
  let nowMs = initialMs;
  return {
    clock: () => new Date(nowMs),
    advance(ms) {
      nowMs += ms;
    },
    get nowMs() {
      return nowMs;
    },
  };
}

function makePassSemanticEvaluator(reason = 'semantic ok') {
  const calls = [];
  return {
    calls,
    evaluateSemanticConstraints: async ({ submission }, constraints) => {
      calls.push({
        submissionId: submission.id,
        constraintIds: constraints.map((c) => c.id),
      });
      return {
        verdicts: constraints.map((constraint) => ({
          submissionId: submission.id,
          constraintId: constraint.id,
          verdict: 'pass',
          evidence: [],
          unsureCause: null,
          reason,
          source: 'model',
        })),
        modelCalls: [
          {
            submissionId: submission.id,
            constraintIds: constraints.map((c) => c.id),
            provider: 'fake',
            model: 'fake-model',
            requestId: `req-${submission.id}`,
            inputTokens: 120,
            outputTokens: 30,
            latencyMs: 45,
            costUsd: 0.0005,
            outcome: 'ok',
          },
        ],
      };
    },
  };
}

test('Rule Q1: stop worker, submit, start worker and restart worker stores exactly one verdict set', async () => {
  const { clock, advance } = makeClock();
  const { store } = createInMemoryStore({
    seed: createStoreSeed(),
    clock,
  });

  // 1. Worker starts and stops before any submission arrives.
  const worker1 = createQueueWorker({
    store,
    workerId: 'worker-stop',
    pollIntervalMs: 10,
  });
  worker1.start();
  await worker1.stop();
  assert.equal(worker1.isRunning(), false);

  // 2. Submit while no worker is running.
  const submission = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'void myMergeSort() {}\nint main() { myMergeSort(); return 0; }\n',
  });
  assert.equal((await store.getSubmission(submission.id))?.status, 'queued');
  assert.equal((await store.listVerdicts(submission.id)).length, 0);

  // 3. Start worker 2 and process the queue.
  advance(500);
  const worker2 = createQueueWorker({
    store,
    workerId: 'worker-start',
  });
  const drained = await worker2.drain();
  assert.equal(drained.length, 1);
  assert.deepEqual(drained[0], {
    processed: true,
    jobId: drained[0]?.jobId,
    submissionId: submission.id,
    attempts: 1,
    outcome: 'completed',
    judgeVerdict: 'AC',
    verdictCount: 2,
  });

  const savedSub = await store.getSubmission(submission.id);
  assert.equal(savedSub?.status, 'judged');
  assert.equal(savedSub?.judgeResult?.verdict, 'AC');
  const firstVerdicts = await store.listVerdicts(submission.id);
  assert.equal(firstVerdicts.length, 2);
  assert.deepEqual(
    firstVerdicts.map((v) => ({
      constraintId: v.constraintId,
      verdict: v.verdict,
      source: v.source,
    })),
    [
      { constraintId: 'c1', verdict: 'pass', source: 'hard_rule' },
      { constraintId: 'c2', verdict: 'unsure', source: 'model' },
    ],
  );
  assert.equal((await store.listReviewQueue('lab-sort')).length, 2);

  // 4. Restart worker 3 on the same store: nothing duplicate is stored.
  advance(500);
  const worker3 = createQueueWorker({
    store,
    workerId: 'worker-restart',
  });
  assert.deepEqual(await worker3.drain(), []);
  assert.equal((await store.listVerdicts(submission.id)).length, 2);
});

test('lease expiry lets a new worker recover cleanly and blocks stale worker completion or duplicate logs', async () => {
  const { clock, advance } = makeClock();
  const { store } = createInMemoryStore({
    seed: createStoreSeed(),
    clock,
  });
  const submission = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() { return 0; }\n',
  });

  let releaseStalledWorker;
  const stalledGate = new Promise((resolve) => {
    releaseStalledWorker = resolve;
  });
  let enteredStalledWorker;
  const enteredPromise = new Promise((resolve) => {
    enteredStalledWorker = resolve;
  });

  const zombieWorker = createQueueWorker({
    store,
    workerId: 'worker-zombie',
    leaseMs: 5_000,
    heartbeatIntervalMs: null,
    evaluator: async () => {
      enteredStalledWorker();
      await stalledGate;
      return {
        judgeResult: {
          verdict: 'AC',
          tests: [
            { testId: 't1', verdict: 'AC' },
            { testId: 't2', verdict: 'AC' },
          ],
        },
        verdicts: [
          {
            submissionId: submission.id,
            constraintId: 'c1',
            verdict: 'pass',
            evidence: [],
            unsureCause: null,
            reason: 'zombie-overwrite',
            source: 'hard_rule',
          },
          {
            submissionId: submission.id,
            constraintId: 'c2',
            verdict: 'violation',
            evidence: [{ line: 1, text: 'int main() { return 0; }' }],
            unsureCause: null,
            reason: 'zombie-overwrite',
            source: 'model',
          },
        ],
        modelCalls: [
          {
            submissionId: submission.id,
            constraintIds: ['c2'],
            provider: 'fake',
            model: 'fake-model',
            requestId: 'req-zombie',
            inputTokens: 10,
            outputTokens: 10,
            latencyMs: 10,
            costUsd: 0.0001,
            outcome: 'ok',
          },
        ],
      };
    },
  });

  const zombiePromise = zombieWorker.runOnce();
  await enteredPromise;

  // Before lease expires, another worker sees no available job.
  const recoveryWorker = createQueueWorker({
    store,
    workerId: 'worker-recovery',
    leaseMs: 5_000,
    ...makePassSemanticEvaluator('recovered-pass'),
  });
  assert.deepEqual(await recoveryWorker.runOnce(), { processed: false });

  // Lease expires after 5000ms: recoveryWorker claims and finishes.
  advance(5_001);
  const recoveryResult = await recoveryWorker.runOnce();
  assert.equal(recoveryResult.processed, true);
  assert.equal(recoveryResult.outcome, 'completed');
  assert.equal(recoveryResult.attempts, 2);

  // Zombie wakes up with its old leaseToken and tries to write results.
  releaseStalledWorker();
  const zombieResult = await zombiePromise;
  assert.equal(zombieResult.processed, true);
  assert.equal(zombieResult.outcome, 'stale_lease');

  // Recovery worker's verdicts and model call remain intact without duplicates.
  const verdicts = await store.listVerdicts(submission.id);
  assert.equal(verdicts.length, 2);
  assert.equal(verdicts.find((v) => v.constraintId === 'c2')?.verdict, 'pass');
  assert.equal(
    verdicts.find((v) => v.constraintId === 'c2')?.reason,
    'recovered-pass',
  );
  const modelCalls = await store.listModelCalls(submission.id);
  assert.equal(modelCalls.length, 1);
  assert.equal(modelCalls[0]?.requestId, `req-${submission.id}`);
});

test('transient failure retries via fail() until maxAttempts and requeue recovers failed submissions', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({
    seed: createStoreSeed(),
    clock,
  });
  const subRetry = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() { return 0; }\n',
  });

  let callCount = 0;
  const retryingWorker = createQueueWorker({
    store,
    workerId: 'worker-retry',
    maxAttempts: 3,
    evaluator: async (ctx) => {
      callCount += 1;
      if (callCount <= 2) {
        throw new Error(`transient failure #${callCount}`);
      }
      return createDefaultSubmissionEvaluator()(ctx);
    },
  });

  const fail1 = await retryingWorker.runOnce();
  assert.equal(fail1.processed, true);
  assert.equal(fail1.outcome, 'failed');
  assert.equal(fail1.attempts, 1);
  assert.match(fail1.error ?? '', /transient failure #1/);
  assert.equal((await store.getSubmission(subRetry.id))?.status, 'queued');

  const fail2 = await retryingWorker.runOnce();
  assert.equal(fail2.processed, true);
  assert.equal(fail2.outcome, 'failed');
  assert.equal(fail2.attempts, 2);
  assert.equal((await store.getSubmission(subRetry.id))?.status, 'queued');

  const ok3 = await retryingWorker.runOnce();
  assert.equal(ok3.processed, true);
  assert.equal(ok3.outcome, 'completed');
  assert.equal(ok3.attempts, 3);
  assert.equal((await store.getSubmission(subRetry.id))?.status, 'judged');
  assert.equal((await store.listVerdicts(subRetry.id)).length, 2);

  // Permanent failures stop at maxAttempts and mark submission 'failed' until requeued.
  const subExhaust = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-2',
    code: 'int main() { return 0; }\n',
  });
  let shouldFail = true;
  const boundedWorker = createQueueWorker({
    store,
    workerId: 'worker-exhaust',
    maxAttempts: 2,
    evaluator: async (ctx) => {
      if (shouldFail) {
        throw new Error('sandbox down');
      }
      return createDefaultSubmissionEvaluator()(ctx);
    },
  });

  assert.equal((await boundedWorker.runOnce()).outcome, 'failed');
  assert.equal((await store.getSubmission(subExhaust.id))?.status, 'queued');
  assert.equal((await boundedWorker.runOnce()).outcome, 'failed');
  assert.equal((await store.getSubmission(subExhaust.id))?.status, 'failed');
  assert.deepEqual(await boundedWorker.runOnce(), { processed: false });

  assert.equal(await store.requeue(subExhaust.id), true);
  shouldFail = false;
  const recovered = await boundedWorker.runOnce();
  assert.equal(recovered.processed, true);
  assert.equal(recovered.outcome, 'completed');
  assert.equal((await store.getSubmission(subExhaust.id))?.status, 'judged');
  assert.equal((await store.listVerdicts(subExhaust.id)).length, 2);
});

test('lease renewal keeps long-running jobs alive past initial leaseMs and signals if lease is lost', async () => {
  const { clock, advance } = makeClock();
  const { store } = createInMemoryStore({
    seed: createStoreSeed(),
    clock,
  });
  const submission = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() { return 0; }\n',
  });

  const peer = createQueueWorker({
    store,
    workerId: 'worker-peer',
    leaseMs: 5_000,
  });

  const longWorker = createQueueWorker({
    store,
    workerId: 'worker-long',
    leaseMs: 5_000,
    heartbeatIntervalMs: null,
    evaluator: async (ctx) => {
      for (let i = 0; i < 3; i += 1) {
        advance(4_000);
        const renewed = await ctx.renewLease();
        assert.equal(renewed, true);
        // Even after 12,000ms total (> 5,000ms initial lease), peer cannot claim the job.
        assert.deepEqual(await peer.runOnce(), { processed: false });
      }
      return createDefaultSubmissionEvaluator()(ctx);
    },
  });

  const done = await longWorker.runOnce();
  assert.equal(done.processed, true);
  assert.equal(done.outcome, 'completed');
  assert.equal((await store.getSubmission(submission.id))?.status, 'judged');

  // Verify AbortSignal triggers if heartbeat detects a lost lease.
  const sub2 = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-2',
    code: 'int main() { return 0; }\n',
  });
  let abortedObserved = false;
  const stolenWorker = createQueueWorker({
    store,
    workerId: 'worker-stolen',
    leaseMs: 1_000,
    heartbeatIntervalMs: null,
    evaluator: async (ctx) => {
      advance(1_500);
      const stealStep = await peer.runOnce();
      assert.equal(stealStep.processed, true);
      assert.equal(stealStep.outcome, 'completed');

      const renewed = await ctx.renewLease();
      assert.equal(renewed, false);
      abortedObserved = ctx.signal.aborted;
      throw new Error('aborted after lease loss');
    },
  });

  const stolenStep = await stolenWorker.runOnce();
  assert.equal(abortedObserved, true);
  assert.equal(stolenStep.processed, true);
  assert.equal(stolenStep.outcome, 'stale_lease');
  assert.equal((await store.listVerdicts(sub2.id)).length, 2);
});

test('hard rules resolve ban-list before semantic evaluator and non-AC skips review (FAQ-04)', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({
    seed: createStoreSeed(),
    clock,
  });

  // Violation of ban-list constraint c1 while c2 is semantic.
  const subViolation = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: [
      '#include <algorithm>',
      '#include <vector>',
      'int main() {',
      '  std::vector<int> a = {3, 1, 2};',
      '  std::sort(a.begin(), a.end());',
      '  return 0;',
      '}',
      '',
    ].join('\n'),
  });

  const semantic = makePassSemanticEvaluator('merge sort implemented');
  const worker = createQueueWorker({
    store,
    workerId: 'worker-rules',
    evaluateSemanticConstraints: semantic.evaluateSemanticConstraints,
  });

  const res1 = await worker.runOnce();
  assert.equal(res1.processed, true);
  assert.equal(res1.outcome, 'completed');
  // c1 was decided by hard rules, so semantic evaluator only saw c2.
  assert.deepEqual(semantic.calls, [
    { submissionId: subViolation.id, constraintIds: ['c2'] },
  ]);

  const verdicts1 = await store.listVerdicts(subViolation.id);
  const c1 = verdicts1.find((v) => v.constraintId === 'c1');
  assert.equal(c1?.verdict, 'violation');
  assert.equal(c1?.source, 'hard_rule');
  assert.ok((c1?.evidence.length ?? 0) >= 1);
  assert.equal(c1?.evidence[0]?.line, 5);

  // Non-AC submission (WA) stores judge result with 0 verdicts and 0 semantic calls (FAQ-04).
  const subWa = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-2',
    code: 'int main() { std::sort(0, 0); }\n',
  });
  const waSemantic = makePassSemanticEvaluator('never called');
  const waWorker = createQueueWorker({
    store,
    workerId: 'worker-wa',
    judgeSubmission: createDefaultJudgeSubmission('WA'),
    evaluateSemanticConstraints: waSemantic.evaluateSemanticConstraints,
  });
  const resWa = await waWorker.runOnce();
  assert.equal(resWa.processed, true);
  assert.equal(resWa.outcome, 'completed');
  assert.equal(resWa.judgeVerdict, 'WA');
  assert.equal(resWa.verdictCount, 0);
  assert.equal(waSemantic.calls.length, 0);
  assert.equal((await store.listVerdicts(subWa.id)).length, 0);
  assert.equal((await store.listReviewQueue('lab-sort')).length, 2);

  // Lab with only ban-list constraint never calls semantic evaluator even on AC.
  const banOnlyLab = await store.createLab({
    classId: 'class-1',
    title: 'Ban only',
    statement: 'No std::sort.',
    opensAt: STORE_FIXTURE_OPENS_AT,
    deadline: '2026-11-10T00:00:00.000Z',
    limits: { cpuTimeMs: 1000, memoryMb: 256 },
    tests: [{ id: 't1', input: '', expectedOutput: '' }],
    constraints: [
      { id: 'c-ban', text: 'Do not use `std::sort`.', deduction: 5 },
    ],
    createdBy: 'ta-1',
  });
  const acNoModel = makePassSemanticEvaluator('should not run');
  const subBanOnly = await store.submit({
    labId: banOnlyLab.id,
    studentId: 'student-1',
    code: 'int main() { return 0; }\n',
  });
  const acWorker = createQueueWorker({
    store,
    workerId: 'worker-ban-only',
    evaluateSemanticConstraints: acNoModel.evaluateSemanticConstraints,
  });
  const resBanAc = await acWorker.runOnce();
  assert.equal(resBanAc.processed, true);
  assert.equal(resBanAc.judgeVerdict, 'AC');
  assert.equal(acNoModel.calls.length, 0);
  assert.equal((await store.listVerdicts(subBanOnly.id)).length, 1);
});

test('background start/stop workers drain concurrent submissions without duplicate verdicts', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({
    seed: createStoreSeed(),
    clock,
  });

  const subIds = [];
  for (const studentId of ['student-1', 'student-2', 'student-1']) {
    const sub = await store.submit({
      labId: 'lab-sort',
      studentId,
      code: 'int main() { return 0; }\n',
    });
    subIds.push(sub.id);
  }

  const w1 = createQueueWorker({
    store,
    workerId: 'bg-1',
    pollIntervalMs: 10,
  });
  const w2 = createQueueWorker({
    store,
    workerId: 'bg-2',
    pollIntervalMs: 10,
  });

  w1.start();
  w2.start();
  assert.equal(w1.isRunning(), true);
  assert.equal(w2.isRunning(), true);

  for (let i = 0; i < 100; i += 1) {
    const statuses = await Promise.all(
      subIds.map(async (id) => (await store.getSubmission(id))?.status),
    );
    if (statuses.every((status) => status === 'judged')) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  await Promise.all([w1.stop(), w2.stop()]);
  assert.equal(w1.isRunning(), false);
  assert.equal(w2.isRunning(), false);

  for (const id of subIds) {
    assert.equal((await store.getSubmission(id))?.status, 'judged');
    assert.equal((await store.listVerdicts(id)).length, 2);
  }
});

test('createQueueWorker and drain validate invalid options', async () => {
  const { store } = createInMemoryStore({ seed: createStoreSeed() });
  assert.throws(
    () => createQueueWorker({ store, workerId: 'bad worker!' }),
    /workerId/,
  );
  assert.throws(() => createQueueWorker({ store, leaseMs: 0 }), /leaseMs/);
  assert.throws(
    () => createQueueWorker({ store, maxAttempts: 1.5 }),
    /maxAttempts/,
  );
  assert.throws(
    () => createQueueWorker({ store, pollIntervalMs: 0 }),
    /pollIntervalMs/,
  );
  assert.throws(
    () => createQueueWorker({ store, heartbeatIntervalMs: -1 }),
    /heartbeatIntervalMs/,
  );

  const worker = createQueueWorker({ store });
  await assert.rejects(() => worker.drain({ maxJobs: 0 }), /maxJobs/);
});
