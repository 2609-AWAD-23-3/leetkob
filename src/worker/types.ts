import type { Store } from '../db/index.js';
import type {
  Constraint,
  Job,
  JudgeResult,
  JudgeVerdict,
  Lab,
  NewConstraintVerdict,
  NewModelCallLog,
  Submission,
} from '../shared/domain/index.js';

export type WorkerStore = Pick<
  Store,
  | 'claim'
  | 'extendLease'
  | 'complete'
  | 'fail'
  | 'getSubmission'
  | 'getLab'
  | 'recordModelCall'
>;

export interface WorkerJobContext {
  readonly job: Job;
  readonly submission: Submission;
  readonly lab: Lab;
  readonly signal: AbortSignal;
  renewLease(): Promise<boolean>;
}

export interface WorkerEvaluationOutput {
  readonly judgeResult: JudgeResult;
  readonly verdicts?: readonly NewConstraintVerdict[] | undefined;
  readonly modelCalls?: readonly NewModelCallLog[] | undefined;
}

export type SubmissionEvaluator = (
  context: WorkerJobContext,
) => Promise<WorkerEvaluationOutput>;

export type JudgeSubmissionFn = (
  context: WorkerJobContext,
) => Promise<JudgeResult>;

export interface SemanticEvaluationOutput {
  readonly verdicts: readonly NewConstraintVerdict[];
  readonly modelCalls?: readonly NewModelCallLog[] | undefined;
}

export type EvaluateSemanticConstraintsFn = (
  context: WorkerJobContext,
  constraints: readonly Constraint[],
) => Promise<SemanticEvaluationOutput>;

export interface DefaultEvaluatorOptions {
  readonly judgeSubmission: JudgeSubmissionFn;
  readonly evaluateSemanticConstraints?:
    EvaluateSemanticConstraintsFn | undefined;
}

export interface QueueWorkerOptions {
  readonly store: WorkerStore;
  readonly workerId?: string | undefined;
  readonly leaseMs?: number | undefined;
  readonly maxAttempts?: number | undefined;
  readonly pollIntervalMs?: number | undefined;
  readonly heartbeatIntervalMs?: number | null | undefined;
  readonly evaluator?: SubmissionEvaluator | undefined;
  readonly judgeSubmission?: JudgeSubmissionFn | undefined;
  readonly evaluateSemanticConstraints?:
    EvaluateSemanticConstraintsFn | undefined;
  readonly modelCallJournalPath?: string | undefined;
  readonly modelCallRetryAttempts?: number | undefined;
  readonly onError?: ((error: unknown) => void) | undefined;
}

export type WorkerStepResult =
  | { readonly processed: false }
  | {
      readonly processed: true;
      readonly jobId: string;
      readonly submissionId: string;
      readonly attempts: number;
      readonly outcome: 'completed' | 'failed' | 'stale_lease';
      readonly judgeVerdict?: JudgeVerdict | undefined;
      readonly verdictCount?: number | undefined;
      readonly pendingModelCallCount?: number | undefined;
      readonly error?: string | undefined;
    };

export interface QueueWorker {
  readonly workerId: string;
  readonly leaseMs: number;
  readonly maxAttempts: number;
  runOnce(): Promise<WorkerStepResult>;
  drain(options?: {
    readonly maxJobs?: number | undefined;
  }): Promise<WorkerStepResult[]>;
  flushPendingModelCalls(): Promise<{
    readonly flushed: number;
    readonly remaining: number;
  }>;
  pendingModelCallCount(): number;
  start(): void;
  stop(): Promise<void>;
  isRunning(): boolean;
}
