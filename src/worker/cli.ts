import { writeSync } from 'node:fs';
import { createPostgresStore } from '../db/postgres/index.js';
import type { JudgeVerdict } from '../shared/domain/index.js';
import {
  createDefaultJudgeSubmission,
  createDefaultSubmissionEvaluator,
  createQueueWorker,
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
  readonly simulateCrashAfterClaim: boolean;
  readonly simulateFailError?: string | undefined;
  readonly simulateJudgeVerdict: JudgeVerdict;
  readonly simulateEvalDelayMs?: number | undefined;
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

  const simulateCrashAfterClaim =
    env.WORKER_SIMULATE_CRASH_AFTER_CLAIM === '1' ||
    env.WORKER_SIMULATE_CRASH_AFTER_CLAIM === 'true';
  const simulateFailError = env.WORKER_SIMULATE_FAIL_ERROR?.trim() || undefined;
  const simulateJudgeVerdictRaw = (env.WORKER_SIMULATE_JUDGE_VERDICT?.trim() ||
    'AC') as JudgeVerdict;
  if (!SUPPORTED_VERDICTS.has(simulateJudgeVerdictRaw)) {
    throw new TypeError(
      'WORKER_SIMULATE_JUDGE_VERDICT must be one of AC, WA, TLE, MLE, RE, CE',
    );
  }
  const simulateEvalDelayMs = parseOptionalPositiveInt(
    env.WORKER_SIMULATE_EVAL_DELAY_MS,
    'WORKER_SIMULATE_EVAL_DELAY_MS',
  );

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
    simulateCrashAfterClaim,
    simulateFailError,
    simulateJudgeVerdict: simulateJudgeVerdictRaw,
    simulateEvalDelayMs,
  };
}

function buildProcessEvaluator(
  config: WorkerProcessConfig,
): SubmissionEvaluator {
  const defaultEvaluator = createDefaultSubmissionEvaluator({
    judgeSubmission: createDefaultJudgeSubmission(config.simulateJudgeVerdict),
  });

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
