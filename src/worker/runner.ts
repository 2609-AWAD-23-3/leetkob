import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { runHardRules } from '../pipeline/hard-rules/index.js';
import type {
  JudgeVerdict,
  NewConstraintVerdict,
  NewModelCallLog,
} from '../shared/domain/index.js';
import type {
  DefaultEvaluatorOptions,
  JudgeSubmissionFn,
  QueueWorker,
  QueueWorkerOptions,
  SubmissionEvaluator,
  WorkerJobContext,
  WorkerStepResult,
} from './types.js';

export const DEFAULT_WORKER_LEASE_MS = 30_000;
export const DEFAULT_WORKER_MAX_ATTEMPTS = 3;
export const DEFAULT_WORKER_POLL_INTERVAL_MS = 200;
export const DEFAULT_MODEL_CALL_RETRY_ATTEMPTS = 2;

const WORKER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function requirePositiveInt(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive integer`);
  }
  return value;
}

function resolveWorkerId(workerId: string | undefined): string {
  if (workerId === undefined) {
    return `worker-${randomUUID().slice(0, 12)}`;
  }
  if (!WORKER_ID_PATTERN.test(workerId)) {
    throw new TypeError(
      `workerId must match ${WORKER_ID_PATTERN.source} (got "${workerId}")`,
    );
  }
  return workerId;
}

function resolveHeartbeatIntervalMs(
  heartbeatIntervalMs: number | null | undefined,
  leaseMs: number,
): number | null {
  if (heartbeatIntervalMs === null || heartbeatIntervalMs === 0) {
    return null;
  }
  if (heartbeatIntervalMs === undefined) {
    return Math.max(25, Math.floor(leaseMs / 3));
  }
  if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs < 0) {
    throw new TypeError(
      'heartbeatIntervalMs must be positive, 0, or null to disable',
    );
  }
  return heartbeatIntervalMs;
}

function resolveJournalPath(journalPath: string | undefined): string | null {
  if (journalPath === undefined) {
    return null;
  }
  const trimmed = journalPath.trim();
  if (!trimmed) {
    throw new TypeError('modelCallJournalPath must be a non-empty string');
  }
  return trimmed;
}

function readPendingJournal(journalPath: string | null): NewModelCallLog[] {
  if (!journalPath || !existsSync(journalPath)) {
    return [];
  }
  const raw = readFileSync(journalPath, 'utf8').trim();
  if (!raw) {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new TypeError(
      `Model call journal at "${journalPath}" must contain a JSON array`,
    );
  }
  return [...(parsed as NewModelCallLog[])];
}

function writePendingJournal(
  journalPath: string | null,
  entries: readonly NewModelCallLog[],
): void {
  if (!journalPath) {
    return;
  }
  if (entries.length === 0) {
    rmSync(journalPath, { force: true });
    return;
  }
  mkdirSync(path.dirname(journalPath), { recursive: true });
  const tmpPath = `${journalPath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(entries), 'utf8');
  renameSync(tmpPath, journalPath);
}

/**
 * Explicit simulated judge adapter intended solely for unit/integration tests
 * before PA03-T11 wires the real Docker sandbox runner. Never used by default.
 */
export function createSimulatedJudgeSubmission(
  simulatedVerdict: JudgeVerdict = 'AC',
): JudgeSubmissionFn {
  return async ({ lab }) => {
    if (simulatedVerdict === 'CE') {
      return { verdict: 'CE', tests: [] };
    }
    return {
      verdict: simulatedVerdict,
      tests: lab.tests.map((testCase) => ({
        testId: testCase.id,
        verdict: simulatedVerdict,
      })),
    };
  };
}

export function createDefaultSubmissionEvaluator(
  options: DefaultEvaluatorOptions,
): SubmissionEvaluator {
  if (typeof options?.judgeSubmission !== 'function') {
    throw new Error(
      'Submission evaluator requires an explicit judgeSubmission; simulated judging is disabled by default',
    );
  }
  const { judgeSubmission } = options;

  return async (context: WorkerJobContext) => {
    const judgeResult = await judgeSubmission(context);
    if (judgeResult.verdict !== 'AC') {
      // Non-AC submissions are neither reviewed nor verified by constraints (FAQ-04).
      return {
        judgeResult,
        verdicts: [],
        modelCalls: [],
      };
    }

    const hardResult = runHardRules({
      code: context.submission.code,
      constraints: context.lab.constraints,
    });

    const verdictsByConstraintId = new Map<string, NewConstraintVerdict>();
    for (const hv of hardResult.verdicts) {
      verdictsByConstraintId.set(hv.constraintId, {
        submissionId: context.submission.id,
        constraintId: hv.constraintId,
        verdict: hv.verdict,
        evidence: hv.evidence.map((entry) => ({
          line: entry.line,
          text: entry.text,
        })),
        unsureCause: null,
        reason: null,
        source: 'hard_rule',
      });
    }

    const semanticConstraints = context.lab.constraints.filter(
      (constraint) => !verdictsByConstraintId.has(constraint.id),
    );
    let modelCalls: readonly NewModelCallLog[] = [];

    if (
      semanticConstraints.length > 0 &&
      options.evaluateSemanticConstraints !== undefined
    ) {
      const semanticOutput = await options.evaluateSemanticConstraints(
        context,
        semanticConstraints,
      );
      const semanticIdSet = new Set(semanticConstraints.map((c) => c.id));
      for (const sv of semanticOutput.verdicts) {
        if (
          semanticIdSet.has(sv.constraintId) &&
          !verdictsByConstraintId.has(sv.constraintId)
        ) {
          verdictsByConstraintId.set(sv.constraintId, sv);
        }
      }
      modelCalls = semanticOutput.modelCalls ?? [];
    }

    const verdicts: NewConstraintVerdict[] = [];
    for (const constraint of context.lab.constraints) {
      const decided = verdictsByConstraintId.get(constraint.id);
      if (decided !== undefined) {
        verdicts.push(decided);
      } else {
        verdicts.push({
          submissionId: context.submission.id,
          constraintId: constraint.id,
          verdict: 'unsure',
          evidence: [],
          unsureCause: 'model_unsure',
          reason: 'Semantic model evaluation deferred or unavailable',
          source: 'model',
        });
      }
    }

    return {
      judgeResult,
      verdicts,
      modelCalls,
    };
  };
}

export function createQueueWorker(options: QueueWorkerOptions): QueueWorker {
  const { store } = options;
  const workerId = resolveWorkerId(options.workerId);
  const leaseMs = requirePositiveInt(
    options.leaseMs ?? DEFAULT_WORKER_LEASE_MS,
    'leaseMs',
  );
  const maxAttempts = requirePositiveInt(
    options.maxAttempts ?? DEFAULT_WORKER_MAX_ATTEMPTS,
    'maxAttempts',
  );
  const pollIntervalMs =
    options.pollIntervalMs ?? DEFAULT_WORKER_POLL_INTERVAL_MS;
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new TypeError('pollIntervalMs must be a positive finite number');
  }
  const heartbeatIntervalMs = resolveHeartbeatIntervalMs(
    options.heartbeatIntervalMs,
    leaseMs,
  );
  const modelCallRetryAttempts = requirePositiveInt(
    options.modelCallRetryAttempts ?? DEFAULT_MODEL_CALL_RETRY_ATTEMPTS,
    'modelCallRetryAttempts',
  );
  const journalPath = resolveJournalPath(options.modelCallJournalPath);

  if (
    options.evaluator === undefined &&
    options.judgeSubmission === undefined
  ) {
    throw new Error(
      'Queue worker requires an explicit evaluator or judgeSubmission; simulated judging is disabled by default',
    );
  }
  const evaluator =
    options.evaluator ??
    createDefaultSubmissionEvaluator({
      judgeSubmission: options.judgeSubmission!,
      evaluateSemanticConstraints: options.evaluateSemanticConstraints,
    });

  const pendingModelCalls: NewModelCallLog[] = readPendingJournal(journalPath);
  const persistPendingModelCalls = (): void => {
    try {
      writePendingJournal(journalPath, pendingModelCalls);
    } catch (error) {
      options.onError?.(error);
    }
  };

  let flushChain: Promise<{
    readonly flushed: number;
    readonly remaining: number;
  }> = Promise.resolve({
    flushed: 0,
    remaining: pendingModelCalls.length,
  });

  const runFlush = async (): Promise<{
    readonly flushed: number;
    readonly remaining: number;
  }> => {
    let flushed = 0;
    let idx = 0;
    while (idx < pendingModelCalls.length) {
      const entry = pendingModelCalls[idx];
      if (!entry) {
        pendingModelCalls.splice(idx, 1);
        continue;
      }
      let recorded = false;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < modelCallRetryAttempts; attempt += 1) {
        try {
          await store.recordModelCall(entry);
          recorded = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (recorded) {
        pendingModelCalls.splice(idx, 1);
        persistPendingModelCalls();
        flushed += 1;
      } else {
        options.onError?.(lastError);
        idx += 1;
      }
    }
    return {
      flushed,
      remaining: pendingModelCalls.length,
    };
  };

  const flushPendingModelCalls = (): Promise<{
    readonly flushed: number;
    readonly remaining: number;
  }> => {
    const next = flushChain.then(runFlush, runFlush);
    flushChain = next;
    return next;
  };

  let running = false;
  let loopPromise: Promise<void> | null = null;
  let sleepTimer: NodeJS.Timeout | null = null;
  let wakeSleep: (() => void) | null = null;

  const waitForNextPoll = (): Promise<void> =>
    new Promise<void>((resolve) => {
      if (!running) {
        resolve();
        return;
      }
      wakeSleep = () => {
        wakeSleep = null;
        if (sleepTimer) {
          clearTimeout(sleepTimer);
          sleepTimer = null;
        }
        resolve();
      };
      // Keep the polling timer referenced while the background loop is active so
      // an idle Postgres pool connection timeout cannot let the worker process exit.
      sleepTimer = setTimeout(() => {
        if (wakeSleep) {
          wakeSleep();
        }
      }, pollIntervalMs);
    });

  const runOnce = async (): Promise<WorkerStepResult> => {
    if (pendingModelCalls.length > 0) {
      await flushPendingModelCalls();
    }

    const job = await store.claim({ workerId, leaseMs, maxAttempts });
    if (!job) {
      return { processed: false };
    }
    const leaseToken = job.leaseToken;
    if (!leaseToken) {
      return {
        processed: true,
        jobId: job.id,
        submissionId: job.submissionId,
        attempts: job.attempts,
        outcome: 'stale_lease',
        error: 'Claimed job did not include a leaseToken',
      };
    }

    const submission = await store.getSubmission(job.submissionId);
    const lab = submission ? await store.getLab(submission.labId) : undefined;
    if (!submission || !lab) {
      const missingError = !submission
        ? `Submission "${job.submissionId}" not found`
        : `Lab "${submission.labId}" not found for submission "${submission.id}"`;
      const failed = await store.fail({
        jobId: job.id,
        leaseToken,
        error: missingError,
        maxAttempts,
      });
      return {
        processed: true,
        jobId: job.id,
        submissionId: job.submissionId,
        attempts: job.attempts,
        outcome: failed ? 'failed' : 'stale_lease',
        error: missingError,
      };
    }

    const abortController = new AbortController();
    let leaseLost = false;
    let renewalChain: Promise<boolean> = Promise.resolve(true);

    const renewLease = (): Promise<boolean> => {
      renewalChain = renewalChain.then(async (stillValid) => {
        if (!stillValid || leaseLost || abortController.signal.aborted) {
          return false;
        }
        try {
          const extended = await store.extendLease({
            jobId: job.id,
            leaseToken,
            leaseMs,
          });
          if (!extended) {
            leaseLost = true;
            abortController.abort(new Error('Worker job lease expired'));
          }
          return extended;
        } catch (error) {
          options.onError?.(error);
          return true;
        }
      });
      return renewalChain;
    };

    let heartbeatTimer: NodeJS.Timeout | null = null;
    if (heartbeatIntervalMs !== null) {
      heartbeatTimer = setInterval(() => {
        void renewLease();
      }, heartbeatIntervalMs);
      heartbeatTimer.unref();
    }

    const context: WorkerJobContext = {
      job,
      submission,
      lab,
      signal: abortController.signal,
      renewLease,
    };

    let completed = false;
    let judgeVerdict: JudgeVerdict;
    let verdictCount = 0;
    let evaluatedModelCalls: readonly NewModelCallLog[] = [];

    try {
      const output = await evaluator(context);
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      await renewalChain;

      const verdicts =
        output.judgeResult.verdict === 'AC' ? [...(output.verdicts ?? [])] : [];
      completed = await store.complete({
        jobId: job.id,
        leaseToken,
        judgeResult: output.judgeResult,
        verdicts,
      });
      if (!completed) {
        return {
          processed: true,
          jobId: job.id,
          submissionId: submission.id,
          attempts: job.attempts,
          outcome: 'stale_lease',
        };
      }
      judgeVerdict = output.judgeResult.verdict;
      verdictCount = verdicts.length;
      evaluatedModelCalls = output.modelCalls ?? [];
    } catch (error) {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      await renewalChain;

      const message =
        error instanceof Error ? error.message || error.name : String(error);
      if (leaseLost) {
        return {
          processed: true,
          jobId: job.id,
          submissionId: submission.id,
          attempts: job.attempts,
          outcome: 'stale_lease',
          error: message,
        };
      }

      const failed = await store.fail({
        jobId: job.id,
        leaseToken,
        error: message,
        maxAttempts,
      });
      return {
        processed: true,
        jobId: job.id,
        submissionId: submission.id,
        attempts: job.attempts,
        outcome: failed ? 'failed' : 'stale_lease',
        error: message,
      };
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    }

    // Job is already committed in store.complete(): never call store.fail() or report
    // stale_lease if recording model call logs fails transiently afterward.
    if (evaluatedModelCalls.length > 0) {
      pendingModelCalls.push(...evaluatedModelCalls);
      persistPendingModelCalls();
      await flushPendingModelCalls();
    }

    const baseResult: WorkerStepResult = {
      processed: true,
      jobId: job.id,
      submissionId: submission.id,
      attempts: job.attempts,
      outcome: 'completed',
      judgeVerdict,
      verdictCount,
    };
    if (pendingModelCalls.length > 0) {
      return {
        ...baseResult,
        pendingModelCallCount: pendingModelCalls.length,
      };
    }
    return baseResult;
  };

  const drain = async (drainOptions?: {
    readonly maxJobs?: number | undefined;
  }): Promise<WorkerStepResult[]> => {
    const maxJobs = drainOptions?.maxJobs ?? Number.POSITIVE_INFINITY;
    if (
      maxJobs !== Number.POSITIVE_INFINITY &&
      (!Number.isInteger(maxJobs) || maxJobs <= 0)
    ) {
      throw new TypeError('drain maxJobs must be a positive integer');
    }
    const results: WorkerStepResult[] = [];
    while (results.length < maxJobs) {
      const step = await runOnce();
      if (!step.processed) {
        break;
      }
      results.push(step);
    }
    return results;
  };

  const start = (): void => {
    if (running) {
      return;
    }
    running = true;
    loopPromise = (async () => {
      while (running) {
        try {
          const step = await runOnce();
          if (!running) {
            break;
          }
          if (!step.processed) {
            await waitForNextPoll();
          }
        } catch (error) {
          options.onError?.(error);
          if (!running) {
            break;
          }
          await waitForNextPoll();
        }
      }
    })().finally(() => {
      loopPromise = null;
    });
  };

  const stop = async (): Promise<void> => {
    running = false;
    if (wakeSleep) {
      wakeSleep();
    }
    if (loopPromise) {
      await loopPromise;
    }
    if (pendingModelCalls.length > 0) {
      await flushPendingModelCalls();
    }
  };

  return {
    workerId,
    leaseMs,
    maxAttempts,
    runOnce,
    drain,
    flushPendingModelCalls,
    pendingModelCallCount: () => pendingModelCalls.length,
    start,
    stop,
    isRunning: () => running,
  };
}
