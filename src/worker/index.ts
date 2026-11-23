import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runWorkerProcess } from './cli.js';

export {
  buildSandboxLimitsFromLab,
  createSandboxJudgeSubmission,
  createStoreIdentityResolver,
  mapSandboxResultToJudgeResult,
  mapSandboxTestStatusToJudgeVerdict,
  mapSandboxVerdictToJudgeVerdict,
  type SandboxJudgeAdapterOptions,
} from './adapters.js';
export {
  computeRetryBackoffMs,
  createDefaultSubmissionEvaluator,
  createQueueWorker,
  createSimulatedJudgeSubmission,
  DEFAULT_MODEL_CALL_RETRY_ATTEMPTS,
  DEFAULT_WORKER_LEASE_MS,
  DEFAULT_WORKER_MAX_ATTEMPTS,
  DEFAULT_WORKER_MAX_RETRY_BACKOFF_MS,
  DEFAULT_WORKER_POLL_INTERVAL_MS,
  DEFAULT_WORKER_RETRY_BACKOFF_MS,
} from './runner.js';
export {
  loadWorkerProcessConfig,
  runWorkerProcess,
  type WorkerProcessConfig,
  type WorkerProcessRunResult,
} from './cli.js';
export type {
  DefaultEvaluatorOptions,
  EvaluateSemanticConstraintsFn,
  HardRulesDecisionInfo,
  JudgeSubmissionFn,
  QueueWorker,
  QueueWorkerOptions,
  SemanticEvaluationOutput,
  SubmissionEvaluator,
  WorkerEvaluationOutput,
  WorkerJobContext,
  WorkerStepResult,
  WorkerStore,
} from './types.js';

function isDirectEntryPoint(): boolean {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }
  try {
    return (
      realpathSync(entryPath) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isDirectEntryPoint()) {
  runWorkerProcess().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
