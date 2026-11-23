import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInMemoryStore,
  createStoreSeed,
  STORE_FIXTURE_OPENS_AT,
} from '../../dist/db/index.js';
import {
  createSemanticEvaluator,
  ModelConfigError,
  ModelProviderError,
} from '../../dist/pipeline/model/index.js';
import { FIXED_JUDGE_LIMITS } from '../../dist/shared/domain/index.js';
import {
  buildSandboxLimitsFromLab,
  createDefaultSubmissionEvaluator,
  createQueueWorker,
  createSandboxJudgeSubmission,
  createStoreIdentityResolver,
  DEFAULT_WORKER_RETRY_BACKOFF_MS,
  loadWorkerProcessConfig,
  mapSandboxResultToJudgeResult,
} from '../../dist/worker/index.js';
import {
  createFakeModel,
  okCompletion,
  result as modelResult,
} from '../support/model-fakes.mjs';

const OPEN_MS = Date.parse(STORE_FIXTURE_OPENS_AT) + 60_000;

function makeClock(initialMs = OPEN_MS) {
  let nowMs = initialMs;
  return {
    clock: () => new Date(nowMs),
    advance(ms) {
      nowMs += ms;
    },
  };
}

test('buildSandboxLimitsFromLab converts lab limits and FIXED_JUDGE_LIMITS to SandboxLimits', () => {
  const limits = buildSandboxLimitsFromLab({ cpuTimeMs: 2500, memoryMb: 384 });
  assert.deepEqual(limits, {
    cpuTimeLimitSeconds: 2.5,
    wallTimeLimitSeconds: 7.5,
    memoryLimitMb: 384,
    maxProcesses: FIXED_JUDGE_LIMITS.maxProcesses,
    outputLimitBytes: FIXED_JUDGE_LIMITS.maxOutputBytes,
    compileCpuTimeLimitSeconds: FIXED_JUDGE_LIMITS.compileTimeMs / 1000,
    compileWallTimeLimitSeconds: (FIXED_JUDGE_LIMITS.compileTimeMs * 3) / 1000,
  });
});

test('mapSandboxResultToJudgeResult maps all sandbox verdicts and test statuses cleanly', () => {
  const baseCompile = {
    success: true,
    exitCode: 0,
    stderr: '',
    outputTruncated: false,
    terminationReason: 'normal',
    containerKilled: false,
    containerName: 'sbx-1',
    durationMs: 12,
    commandArgs: [],
  };
  const makeTc = (testCaseId, status) => ({
    testCaseId,
    status,
    terminationReason: 'normal',
    exitCode: 0,
    signal: null,
    stdout: '',
    stderr: '',
    outputTruncated: false,
    containerKilled: false,
    containerName: 'sbx-2',
    durationMs: 5,
    commandArgs: [],
  });

  assert.deepEqual(
    mapSandboxResultToJudgeResult({
      verdict: 'CompileError',
      compileResult: { ...baseCompile, success: false, exitCode: 1 },
      testResults: [],
    }),
    { verdict: 'CE', tests: [] },
  );

  assert.deepEqual(
    mapSandboxResultToJudgeResult({
      verdict: 'Accepted',
      compileResult: baseCompile,
      testResults: [makeTc('t1', 'accepted'), makeTc('t2', 'accepted')],
    }),
    {
      verdict: 'AC',
      tests: [
        { testId: 't1', verdict: 'AC' },
        { testId: 't2', verdict: 'AC' },
      ],
    },
  );

  assert.deepEqual(
    mapSandboxResultToJudgeResult({
      verdict: 'OutputLimitExceeded',
      compileResult: baseCompile,
      testResults: [
        makeTc('t1', 'wrong_answer'),
        makeTc('t2', 'time_limit_exceeded'),
        makeTc('t3', 'memory_limit_exceeded'),
        makeTc('t4', 'output_limit_exceeded'),
        makeTc('t5', 'runtime_error'),
      ],
    }),
    {
      verdict: 'RE',
      tests: [
        { testId: 't1', verdict: 'WA' },
        { testId: 't2', verdict: 'TLE' },
        { testId: 't3', verdict: 'MLE' },
        { testId: 't4', verdict: 'RE' },
        { testId: 't5', verdict: 'RE' },
      ],
    },
  );
});

test('createSandboxJudgeSubmission delegates to SandboxRunner using lab limits and tests', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({ seed: createStoreSeed(), clock });
  const submission = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() { return 0; }',
  });
  const lab = await store.getLab('lab-sort');
  assert.ok(lab);
  const customLab = {
    ...lab,
    limits: { cpuTimeMs: 1500, memoryMb: 128 },
  };

  let capturedOptions = null;
  let capturedSource = null;
  let capturedTests = null;
  const judgeSubmission = createSandboxJudgeSubmission({
    imageTag: 'custom-sbx:test',
    dockerCommand: 'podman',
    createRunner: (opts) => {
      capturedOptions = opts;
      return {
        compile: async () => {
          throw new Error('not called');
        },
        runBinary: async () => {
          throw new Error('not called');
        },
        compileAndRun: async (source, tests) => {
          capturedSource = source;
          capturedTests = tests;
          return {
            verdict: 'WrongAnswer',
            compileResult: {
              success: true,
              exitCode: 0,
              stderr: '',
              outputTruncated: false,
              terminationReason: 'normal',
              containerKilled: false,
              containerName: 'sbx-1',
              durationMs: 10,
              commandArgs: [],
            },
            testResults: tests.map((tc, index) => ({
              testCaseId: tc.id,
              status: index === 0 ? 'accepted' : 'wrong_answer',
              terminationReason: 'normal',
              exitCode: 0,
              signal: null,
              stdout: '',
              stderr: '',
              outputTruncated: false,
              containerKilled: false,
              containerName: 'sbx-2',
              durationMs: 4,
              commandArgs: [],
            })),
          };
        },
      };
    },
  });

  const result = await judgeSubmission({
    job: {
      id: 'job-1',
      submissionId: submission.id,
      attempts: 1,
      leaseOwner: 'w1',
      leaseToken: 'tok-1',
      leaseExpiresAt: null,
      lastError: null,
    },
    submission,
    lab: customLab,
    signal: new AbortController().signal,
    renewLease: async () => true,
  });

  assert.equal(capturedOptions?.imageTag, 'custom-sbx:test');
  assert.equal(capturedOptions?.dockerCommand, 'podman');
  assert.equal(capturedOptions?.limits?.cpuTimeLimitSeconds, 1.5);
  assert.equal(capturedOptions?.limits?.wallTimeLimitSeconds, 4.5);
  assert.equal(capturedOptions?.limits?.memoryLimitMb, 128);
  assert.equal(capturedSource, submission.code);
  assert.deepEqual(
    capturedTests?.map((t) => t.id),
    customLab.tests.map((t) => t.id),
  );
  assert.deepEqual(result, {
    verdict: 'WA',
    tests: [
      { testId: 't1', verdict: 'AC' },
      { testId: 't2', verdict: 'WA' },
    ],
  });
});

test('createStoreIdentityResolver resolves user displayName, parts and username, and fails closed when user missing', async () => {
  const { clock } = makeClock();
  const seed = createStoreSeed();
  seed.users[3].displayName = 'Nguyen Van An';
  const { store } = createInMemoryStore({ seed, clock });
  const resolveIdentity = createStoreIdentityResolver(store);

  const sub = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() {}',
  });
  const ids = await resolveIdentity(sub);
  assert.ok(ids.includes('Nguyen Van An'));
  assert.ok(ids.includes('student1'));
  assert.ok(ids.includes('Nguyen'));

  const missingIds = await resolveIdentity({
    ...sub,
    studentId: 'unknown-student',
  });
  assert.deepEqual(missingIds, []);

  const fakeModel = createFakeModel(() =>
    okCompletion([modelResult('c2', 'pass')]),
  );
  const evaluator = createSemanticEvaluator({
    client: fakeModel,
    timeoutMs: 1_000,
    getIdentity: resolveIdentity,
  });

  const lab = await store.getLab('lab-sort');
  assert.ok(lab);
  await assert.rejects(
    () =>
      evaluator(
        {
          job: {
            id: 'j1',
            submissionId: sub.id,
            attempts: 1,
            leaseOwner: 'w',
            leaseToken: 't',
            leaseExpiresAt: null,
            lastError: null,
          },
          submission: { ...sub, studentId: 'unknown-student' },
          lab,
          signal: new AbortController().signal,
          renewLease: async () => true,
        },
        [lab.constraints[1]],
      ),
    ModelConfigError,
  );
  assert.equal(fakeModel.calls.length, 0);
});

test('non-retryable ModelProviderError (401) records error.modelCall and fails job on first attempt', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({ seed: createStoreSeed(), clock });
  const sub = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() { return 0; }',
  });

  const failedModelCall = {
    submissionId: sub.id,
    constraintIds: ['c2'],
    provider: 'anthropic',
    model: 'claude-haiku-5-5',
    requestId: 'req_401',
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 35,
    costUsd: 0,
    outcome: 'provider_error',
  };

  const worker = createQueueWorker({
    store,
    workerId: 'w-nonretry',
    maxAttempts: 3,
    retryBackoffMs: 0,
    judgeSubmission: async ({ lab }) => ({
      verdict: 'AC',
      tests: lab.tests.map((tc) => ({ testId: tc.id, verdict: 'AC' })),
    }),
    evaluateSemanticConstraints: async () => {
      throw new ModelProviderError('Unauthorized', {
        status: 401,
        retryable: false,
        requestId: 'req_401',
        modelCall: failedModelCall,
      });
    },
  });

  const step = await worker.runOnce();
  assert.equal(step.processed, true);
  assert.equal(step.outcome, 'failed');
  assert.equal(step.willRetry, false);
  assert.equal(step.attempts, 1);

  const saved = await store.getSubmission(sub.id);
  assert.equal(saved?.status, 'failed');
  const modelCalls = await store.listModelCalls(sub.id);
  assert.equal(modelCalls.length, 1);
  assert.equal(modelCalls[0]?.outcome, 'provider_error');
  assert.equal(modelCalls[0]?.requestId, 'req_401');

  // Next runOnce must not reclaim the job because it was permanently failed.
  const nextStep = await worker.runOnce();
  assert.equal(nextStep.processed, false);
});

test('ModelConfigError fails job immediately on first attempt without retry', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({ seed: createStoreSeed(), clock });
  const sub = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() { return 0; }',
  });

  const worker = createQueueWorker({
    store,
    workerId: 'w-cfg-err',
    maxAttempts: 3,
    retryBackoffMs: 0,
    judgeSubmission: async ({ lab }) => ({
      verdict: 'AC',
      tests: lab.tests.map((tc) => ({ testId: tc.id, verdict: 'AC' })),
    }),
    evaluateSemanticConstraints: async () => {
      throw new ModelConfigError('Missing student identity');
    },
  });

  const step = await worker.runOnce();
  assert.equal(step.processed, true);
  assert.equal(step.outcome, 'failed');
  assert.equal(step.willRetry, false);
  const saved = await store.getSubmission(sub.id);
  assert.equal(saved?.status, 'failed');
  assert.equal((await worker.runOnce()).processed, false);
});

test('retryable ModelProviderError (429) records error.modelCall, signals willRetry and waits backoff before retry', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({ seed: createStoreSeed(), clock });
  const sub = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: 'int main() { return 0; }',
  });

  let callCount = 0;
  const recordedSleeps = [];
  let worker = null;

  worker = createQueueWorker({
    store,
    workerId: 'w-retry-backoff',
    maxAttempts: 3,
    pollIntervalMs: 5,
    retryBackoffMs: 25,
    maxRetryBackoffMs: 100,
    sleep: async (ms) => {
      recordedSleeps.push(ms);
    },
    judgeSubmission: async ({ lab }) => ({
      verdict: 'AC',
      tests: lab.tests.map((tc) => ({ testId: tc.id, verdict: 'AC' })),
    }),
    evaluateSemanticConstraints: async ({ submission }, constraints) => {
      callCount += 1;
      if (callCount === 1) {
        throw new ModelProviderError('Rate limited', {
          status: 429,
          retryable: true,
          requestId: 'req_429',
          modelCall: {
            submissionId: submission.id,
            constraintIds: constraints.map((c) => c.id),
            provider: 'anthropic',
            model: 'claude-haiku-5-5',
            requestId: 'req_429',
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 50,
            costUsd: 0,
            outcome: 'provider_error',
          },
        });
      }
      queueMicrotask(() => {
        void worker?.stop();
      });
      return {
        verdicts: constraints.map((c) => ({
          submissionId: submission.id,
          constraintId: c.id,
          verdict: 'pass',
          evidence: [],
          unsureCause: null,
          reason: 'ok on retry',
          source: 'model',
        })),
        modelCalls: [
          {
            submissionId: submission.id,
            constraintIds: constraints.map((c) => c.id),
            provider: 'anthropic',
            model: 'claude-haiku-5-5',
            requestId: 'req_ok_retry',
            inputTokens: 90,
            outputTokens: 20,
            latencyMs: 40,
            costUsd: 0.0002,
            outcome: 'ok',
          },
        ],
      };
    },
  });

  worker.start();
  const deadline = Date.now() + 2000;
  while (worker.isRunning() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10));
  }
  await worker.stop();

  assert.equal(callCount, 2);
  assert.deepEqual(recordedSleeps, [25]);
  const saved = await store.getSubmission(sub.id);
  assert.equal(saved?.status, 'judged');
  const calls = await store.listModelCalls(sub.id);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((c) => c.outcome),
    ['provider_error', 'ok'],
  );
});

test('createDefaultSubmissionEvaluator reports hard rules decisionLog with modelCalled=false', async () => {
  const { clock } = makeClock();
  const { store } = createInMemoryStore({ seed: createStoreSeed(), clock });
  const sub = await store.submit({
    labId: 'lab-sort',
    studentId: 'student-1',
    code: '#include <algorithm>\nint main() { int a[2]={2,1}; std::sort(a,a+2); }',
  });
  const lab = await store.getLab('lab-sort');
  assert.ok(lab);

  const decisions = [];
  const evaluator = createDefaultSubmissionEvaluator({
    judgeSubmission: async () => ({
      verdict: 'AC',
      tests: lab.tests.map((tc) => ({ testId: tc.id, verdict: 'AC' })),
    }),
    onHardRulesDecision: (entry) => decisions.push(entry),
  });

  const output = await evaluator({
    job: {
      id: 'j1',
      submissionId: sub.id,
      attempts: 1,
      leaseOwner: 'w',
      leaseToken: 'tok',
      leaseExpiresAt: null,
      lastError: null,
    },
    submission: sub,
    lab,
    signal: new AbortController().signal,
    renewLease: async () => true,
  });

  assert.equal(output.judgeResult.verdict, 'AC');
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.submissionId, sub.id);
  assert.equal(decisions[0]?.decisionLog[0]?.route, 'hard_rule');
  assert.equal(decisions[0]?.decisionLog[0]?.modelCalled, false);
});

test('loadWorkerProcessConfig requires MODEL_API_KEY in default real mode and reads sandbox/backoff options', () => {
  assert.throws(
    () =>
      loadWorkerProcessConfig({
        DATABASE_URL: 'postgres://user:pass@127.0.0.1:5433/leetkob',
      }),
    ModelConfigError,
  );

  const config = loadWorkerProcessConfig({
    DATABASE_URL: 'postgres://user:pass@127.0.0.1:5433/leetkob',
    MODEL_API_KEY: 'sk-test-only-placeholder',
    MODEL_TIMEOUT_MS: '15000',
    SANDBOX_IMAGE: 'leetkob-sandbox:custom',
    DOCKER_COMMAND: 'docker',
    WORKER_RETRY_BACKOFF_MS: '750',
  });
  assert.equal(config.modelConfig?.apiKey, 'sk-test-only-placeholder');
  assert.equal(config.modelConfig?.timeoutMs, 15_000);
  assert.equal(config.sandboxImage, 'leetkob-sandbox:custom');
  assert.equal(config.dockerCommand, 'docker');
  assert.equal(config.retryBackoffMs, 750);

  const defaults = loadWorkerProcessConfig({
    DATABASE_URL: 'postgres://user:pass@127.0.0.1:5433/leetkob',
    MODEL_API_KEY: 'sk-test-only-placeholder',
  });
  assert.equal(defaults.retryBackoffMs, DEFAULT_WORKER_RETRY_BACKOFF_MS);
});
