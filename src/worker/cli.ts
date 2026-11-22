import { writeSync } from 'node:fs';
import { createPostgresStore } from '../db/postgres/index.js';
import type { JudgeVerdict } from '../shared/domain/index.js';
import {
  createDefaultSubmissionEvaluator,
  createQueueWorker,
  createSimulatedJudgeSubmission,
  DEFAULT_WORKER_LEASE_MS,
  DEFAULT_WORKER_MAX_ATTEMPTS,
  DEFAULT_WORKER_POLL_INTERVAL_MS,
} from './runner.js';
import type { SubmissionEvaluator, WorkerStepResult } from './types.js';

const SUPPORTED_VERDICTS = new Set<JudgeVerdict>([
  'AC',
  'WA',
  'TLE',
  'MLE',
  'RE',
  'CE',
]);

export interface WorkerProcessConfig {
  readonly connectionString: string;
  readonly schema?: string | undefined;
  readonly workerId?: string | undefined;
  readonly leaseMs: number;
  readonly maxAttempts: number;
  readonly pollIntervalMs: number;
  readonly maxJobs?: number | undefined;
  readonly exitWhenIdle: boolean;
  readonly clockIso?: string | undefined;
  readonly allowSimulatedJudge: boolean;
  readonly simulateCrashAfterClaim: boolean;
  readonly simulateFailError?: string | undefined;
  readonly simulateJudgeVerdict?: JudgeVerdict | undefined;
  readonly simulateEvalDelayMs?: number | undefined;
  readonly modelCallJournalPath?: string | undefined;
}

export interface WorkerProcessRunResult {
  readonly workerId: string;
  readonly results: readonly WorkerStepResult[];
}

function parseOptionalPositiveInt(
  raw: string | undefined,
  name: string,
): number | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  if (!/^[0-9]+$/.test(raw.trim())) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

export function loadWorkerProcessConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerProcessConfig {
  const connectionString = env.DATABASE_URL ?? env.TEST_DATABASE_URL ?? '';
  if (!connectionString.trim()) {
    throw new Error(
      'DATABASE_URL or TEST_DATABASE_URL must be set to start the queue worker',
    );
  }

  const schema = env.DATABASE_SCHEMA?.trim() || undefined;
  const workerId = env.WORKER_ID?.trim() || undefined;
  const leaseMs =
    parseOptionalPositiveInt(env.WORKER_LEASE_MS, 'WORKER_LEASE_MS') ??
    DEFAULT_WORKER_LEASE_MS;
  const maxAttempts =
    parseOptionalPositiveInt(env.WORKER_MAX_ATTEMPTS, 'WORKER_MAX_ATTEMPTS') ??
    DEFAULT_WORKER_MAX_ATTEMPTS;
  const pollIntervalMs =
    parseOptionalPositiveInt(
      env.WORKER_POLL_INTERVAL_MS,
      'WORKER_POLL_INTERVAL_MS',
    ) ?? DEFAULT_WORKER_POLL_INTERVAL_MS;
  const maxJobs = parseOptionalPositiveInt(
    env.WORKER_MAX_JOBS,
    'WORKER_MAX_JOBS',
  );
  const exitWhenIdle =
    env.WORKER_EXIT_WHEN_IDLE === '1' || env.WORKER_EXIT_WHEN_IDLE === 'true';

  const clockIso = env.WORKER_CLOCK_ISO?.trim() || undefined;
  if (clockIso !== undefined && !Number.isFinite(Date.parse(clockIso))) {
    throw new TypeError('WORKER_CLOCK_ISO must be a valid ISO timestamp');
  }

  const allowSimulatedJudge =
    env.WORKER_ALLOW_SIMULATED_JUDGE === '1' ||
    env.WORKER_ALLOW_SIMULATED_JUDGE === 'true';
  const simulateCrashAfterClaim =
    env.WORKER_SIMULATE_CRASH_AFTER_CLAIM === '1' ||
    env.WORKER_SIMULATE_CRASH_AFTER_CLAIM === 'true';
  const simulateFailError = env.WORKER_SIMULATE_FAIL_ERROR?.trim() || undefined;

  const rawSimulateVerdict = env.WORKER_SIMULATE_JUDGE_VERDICT?.trim();
  let simulateJudgeVerdict: JudgeVerdict | undefined;
  if (rawSimulateVerdict !== undefined && rawSimulateVerdict !== '') {
    const candidate = rawSimulateVerdict as JudgeVerdict;
    if (!SUPPORTED_VERDICTS.has(candidate)) {
      throw new TypeError(
        'WORKER_SIMULATE_JUDGE_VERDICT must be one of AC, WA, TLE, MLE, RE, CE',
      );
    }
    if (!allowSimulatedJudge) {
      throw new Error(
        'WORKER_SIMULATE_JUDGE_VERDICT requires WORKER_ALLOW_SIMULATED_JUDGE=1 (explicit test simulation mode)',
      );
    }
    simulateJudgeVerdict = candidate;
  }

  if (
    !simulateCrashAfterClaim &&
    simulateFailError === undefined &&
    (!allowSimulatedJudge || simulateJudgeVerdict === undefined)
  ) {
    throw new Error(
      'Queue worker requires a real judge adapter (wired in PA03-T11); refusing to start with simulated AC. For tests, set WORKER_ALLOW_SIMULATED_JUDGE=1 and WORKER_SIMULATE_JUDGE_VERDICT=<AC|WA|TLE|MLE|RE|CE>.',
    );
  }

  const simulateEvalDelayMs = parseOptionalPositiveInt(
    env.WORKER_SIMULATE_EVAL_DELAY_MS,
    'WORKER_SIMULATE_EVAL_DELAY_MS',
  );
  const modelCallJournalPath =
    env.WORKER_MODEL_CALL_JOURNAL_PATH?.trim() || undefined;

  return {
    connectionString,
    schema,
    workerId,
    leaseMs,
    maxAttempts,
    pollIntervalMs,
    maxJobs,
    exitWhenIdle,
    clockIso,
    allowSimulatedJudge,
    simulateCrashAfterClaim,
    simulateFailError,
    simulateJudgeVerdict,
    simulateEvalDelayMs,
    modelCallJournalPath,
  };
}

function buildProcessEvaluator(
  config: WorkerProcessConfig,
): SubmissionEvaluator {
  const defaultEvaluator =
    config.allowSimulatedJudge && config.simulateJudgeVerdict !== undefined
      ? createDefaultSubmissionEvaluator({
          judgeSubmission: createSimulatedJudgeSubmission(
            config.simulateJudgeVerdict,
          ),
        })
      : null;

  return async (context) => {
    if (config.simulateEvalDelayMs !== undefined) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, config.simulateEvalDelayMs);
        timer.unref();
      });
    }

    if (config.simulateCrashAfterClaim) {
      writeSync(
        1,
        `${JSON.stringify({
          event: 'crash_after_claim',
          jobId: context.job.id,
          submissionId: context.submission.id,
          leaseToken: context.job.leaseToken,
          attempts: context.job.attempts,
        })}\n`,
      );
      process.exit(137);
    }

    if (config.simulateFailError !== undefined) {
      throw new Error(config.simulateFailError);
    }

    if (!defaultEvaluator) {
      throw new Error(
        'Queue worker requires a real judge adapter; simulated judging is disabled',
      );
    }

    return defaultEvaluator(context);
  };
}

export async function runWorkerProcess(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WorkerProcessRunResult> {
  const config = loadWorkerProcessConfig(env);
  const storeOptions: Parameters<typeof createPostgresStore>[0] = {
    connectionString: config.connectionString,
  };
  if (config.schema !== undefined) {
    storeOptions.schema = config.schema;
  }
  if (config.clockIso !== undefined) {
    const fixedTimeMs = Date.parse(config.clockIso);
    storeOptions.clock = () => new Date(fixedTimeMs);
  }

  const { store, ready } = createPostgresStore(storeOptions);
  try {
    await ready;

    const worker = createQueueWorker({
      store,
      workerId: config.workerId,
      leaseMs: config.leaseMs,
      maxAttempts: config.maxAttempts,
      pollIntervalMs: config.pollIntervalMs,
      modelCallJournalPath: config.modelCallJournalPath,
      evaluator: buildProcessEvaluator(config),
      onError: (error) => {
        console.error('[worker] error:', error);
      },
    });

    if (config.exitWhenIdle || config.maxJobs !== undefined) {
      const results = await worker.drain(
        config.maxJobs !== undefined ? { maxJobs: config.maxJobs } : undefined,
      );
      return {
        workerId: worker.workerId,
        results,
      };
    }

    await new Promise<void>((resolve) => {
      let stopping = false;
      const shutdown = (): void => {
        if (stopping) {
          return;
        }
        stopping = true;
        process.removeListener('SIGINT', shutdown);
        process.removeListener('SIGTERM', shutdown);
        void worker.stop().then(resolve, resolve);
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
      worker.start();
    });

    return {
      workerId: worker.workerId,
      results: [],
    };
  } finally {
    await store.close();
  }
}
