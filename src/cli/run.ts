// Lõi checker (PA03-T10): dataset → prediction cho từng (solution, constraint) + call log.
// Dùng chung pipeline với worker: hard rules (T07) trước, model (T08) cho constraint semantic.
// Không import src/api, src/db hay src/worker.
import { runHardRules } from '../pipeline/hard-rules/index.js';
import {
  createSemanticEvaluator,
  ModelProviderError,
  NO_STUDENT_IDENTITY_DATASET,
} from '../pipeline/model/index.js';
import type {
  ModelClient,
  PromptRecord,
  SemanticEvaluator,
} from '../pipeline/model/index.js';
import type {
  Evidence,
  NewModelCallLog,
  UnsureCause,
  VerdictValue,
} from '../shared/domain/index.js';
import type { DatasetProblem, DatasetSolution } from './dataset.js';

/** Một dòng của file prediction, đúng format của `eval.mjs`. */
export interface Prediction {
  readonly solution: string;
  readonly constraint: string;
  readonly verdict: VerdictValue;
  readonly evidence: readonly Evidence[];
}

/** Quyết định cho một cặp: ai quyết, có gọi model không, vì sao `unsure`. */
export interface DecisionEntry {
  readonly type: 'decision';
  readonly solution: string;
  readonly constraint: string;
  /** `model_off`: constraint semantic không được gửi vì `MODEL_OFF=1`. */
  readonly route: 'hard_rule' | 'model' | 'model_off';
  readonly verdict: VerdictValue;
  readonly evidenceLines: readonly number[];
  readonly modelCalled: boolean;
  /** Có giá trị khi và chỉ khi `verdict` là `unsure`. */
  readonly unsureCause: CheckerUnsureCause | null;
  /**
   * PA04-T08: chỉ có ở decision `unsure` của đường model: lý do của verdict (lý do model đưa ra,
   * hoặc vì sao output bị hạ xuống `unsure`, ví dụ dòng evidence lệch) hoặc thông điệp lỗi
   * provider. Dùng để chẩn đoán lần chạy held-out; không có ở `pass`, `violation`, hard rule
   * hay `model_off` để call log không phình.
   */
  readonly reason?: string;
  readonly bannedNames?: readonly string[];
}

/**
 * Bộ cause chung cộng `provider_error`, chỉ dùng trong call log của checker: lỗi provider sau
 * khi SDK đã retry. Worker không bao giờ ghi giá trị này thành verdict (nó retry cả job), nên
 * `provider_error` không thuộc `UnsureCause` của domain/DB (hướng A, Vượng chốt 23/11/2026).
 */
export type CheckerUnsureCause = UnsureCause | 'provider_error';

/** Một call model thật (hoặc giả trong test), kèm prompt đã gửi. */
export interface ModelCallEntry {
  readonly type: 'model_call';
  readonly solution: string;
  readonly constraintIds: readonly string[];
  readonly provider: string;
  readonly model: string;
  readonly requestId: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly outcome: NewModelCallLog['outcome'];
  readonly identity: PromptRecord['identity'] | null;
  readonly promptSha256: string | null;
  readonly system: string | null;
  readonly user: string | null;
}

export type CallLogEntry = DecisionEntry | ModelCallEntry;

export interface CheckerModel {
  readonly client: ModelClient;
  readonly timeoutMs: number;
}

export interface RunCheckerOptions {
  readonly problems: readonly DatasetProblem[];
  /** `MODEL_OFF=1`: chỉ hard rules, constraint semantic ghi `unsure`, không tạo call nào. */
  readonly modelOff: boolean;
  /** Bắt buộc khi `modelOff` là false. */
  readonly model?: CheckerModel | undefined;
  /** Số bài chấm song song khi bật model (mặc định 4). Không ảnh hưởng thứ tự output. */
  readonly concurrency?: number | undefined;
}

export interface CheckerResult {
  readonly predictions: Prediction[];
  readonly callLog: CallLogEntry[];
}

interface SolutionResult {
  readonly predictions: Prediction[];
  readonly callLog: CallLogEntry[];
}

export const DEFAULT_CONCURRENCY = 4;

const toModelCallEntry = (
  solution: string,
  call: NewModelCallLog,
  prompt: PromptRecord | undefined,
): ModelCallEntry => ({
  type: 'model_call',
  solution,
  constraintIds: [...call.constraintIds],
  provider: call.provider,
  model: call.model,
  requestId: call.requestId,
  inputTokens: call.inputTokens,
  outputTokens: call.outputTokens,
  latencyMs: call.latencyMs,
  costUsd: call.costUsd,
  outcome: call.outcome,
  identity: prompt?.identity ?? null,
  promptSha256: prompt?.promptSha256 ?? null,
  system: prompt?.system ?? null,
  user: prompt?.user ?? null,
});

const copyEvidence = (evidence: readonly Evidence[]): Evidence[] =>
  evidence.map((e) => ({ line: e.line, text: e.text }));

const checkSolution = async (
  problem: DatasetProblem,
  solution: DatasetSolution,
  modelOff: boolean,
  evaluate: SemanticEvaluator | null,
  prompts: Map<string, PromptRecord>,
): Promise<SolutionResult> => {
  const hard = runHardRules({
    code: solution.code,
    constraints: problem.constraints,
  });
  const byConstraint = new Map<
    string,
    { prediction: Prediction; decision: DecisionEntry }
  >();
  const callLog: CallLogEntry[] = [];

  for (const verdict of hard.verdicts) {
    const entry = hard.decisionLog.find(
      (d) => d.constraintId === verdict.constraintId,
    );
    byConstraint.set(verdict.constraintId, {
      prediction: {
        solution: solution.id,
        constraint: verdict.constraintId,
        verdict: verdict.verdict,
        evidence: copyEvidence(verdict.evidence),
      },
      decision: {
        type: 'decision',
        solution: solution.id,
        constraint: verdict.constraintId,
        route: 'hard_rule',
        verdict: verdict.verdict,
        evidenceLines: verdict.evidence.map((e) => e.line),
        modelCalled: false,
        unsureCause: null,
        ...(entry?.route === 'hard_rule' ? { bannedNames: entry.names } : {}),
      },
    });
  }

  const semantic = problem.constraints.filter((c) =>
    hard.modelConstraintIds.includes(c.id),
  );
  const unsure = (
    constraint: string,
    route: DecisionEntry['route'],
    unsureCause: CheckerUnsureCause,
    reason?: string,
  ) => ({
    prediction: {
      solution: solution.id,
      constraint,
      verdict: 'unsure' as const,
      evidence: [],
    },
    decision: {
      type: 'decision' as const,
      solution: solution.id,
      constraint,
      route,
      verdict: 'unsure' as const,
      evidenceLines: [],
      modelCalled: route === 'model',
      unsureCause,
      ...(reason === undefined ? {} : { reason }),
    },
  });

  if (semantic.length > 0 && (modelOff || evaluate === null)) {
    for (const c of semantic) {
      byConstraint.set(c.id, unsure(c.id, 'model_off', 'model_off'));
    }
  } else if (semantic.length > 0 && evaluate !== null) {
    try {
      const out = await evaluate(
        {
          submission: { id: solution.id, code: solution.code },
          lab: { statement: problem.statement },
          signal: new AbortController().signal,
        },
        semantic,
      );
      for (const call of out.modelCalls) {
        callLog.push(
          toModelCallEntry(solution.id, call, prompts.get(solution.id)),
        );
      }
      for (const v of out.verdicts) {
        byConstraint.set(v.constraintId, {
          prediction: {
            solution: solution.id,
            constraint: v.constraintId,
            verdict: v.verdict,
            evidence: copyEvidence(v.evidence),
          },
          decision: {
            type: 'decision',
            solution: solution.id,
            constraint: v.constraintId,
            route: 'model',
            verdict: v.verdict,
            evidenceLines: v.evidence.map((e) => e.line),
            modelCalled: true,
            unsureCause: v.unsureCause,
            ...(v.verdict === 'unsure' && v.reason !== null
              ? { reason: v.reason }
              : {}),
          },
        });
      }
    } catch (error) {
      if (!(error instanceof ModelProviderError)) throw error;
      // C1: một bài lỗi provider không làm mất cả lần chạy; ghi `unsure` và log lỗi.
      if (error.modelCall) {
        callLog.push(
          toModelCallEntry(
            solution.id,
            error.modelCall,
            prompts.get(solution.id),
          ),
        );
      }
      for (const c of semantic) {
        byConstraint.set(
          c.id,
          unsure(c.id, 'model', 'provider_error', error.message),
        );
      }
    }
  }

  const predictions: Prediction[] = [];
  const decisions: CallLogEntry[] = [];
  for (const c of problem.constraints) {
    const item = byConstraint.get(c.id);
    if (!item) {
      throw new Error(
        `internal: no verdict for ${solution.id} ${c.id}; the pipeline must decide every constraint`,
      );
    }
    predictions.push(item.prediction);
    decisions.push(item.decision);
  }
  return { predictions, callLog: [...decisions, ...callLog] };
};

/** Chạy checker trên mọi bài của dataset. Output theo thứ tự bài → solution → constraint. */
export const runChecker = async (
  options: RunCheckerOptions,
): Promise<CheckerResult> => {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('concurrency must be a positive integer');
  }
  const prompts = new Map<string, PromptRecord>();
  let evaluate: SemanticEvaluator | null = null;
  if (!options.modelOff) {
    if (!options.model) {
      throw new TypeError('a model is required unless MODEL_OFF=1');
    }
    evaluate = createSemanticEvaluator({
      client: options.model.client,
      timeoutMs: options.model.timeoutMs,
      // B3: dataset không có sinh viên; ghi `none:dataset` vào PromptRecord.
      getIdentity: () => NO_STUDENT_IDENTITY_DATASET,
      onPrompt: (record) => {
        prompts.set(record.submissionId, record);
      },
    });
  }

  const jobs = options.problems.flatMap((problem) =>
    problem.solutions.map((solution) => ({ problem, solution })),
  );
  const results = Array.from<SolutionResult>({ length: jobs.length });
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const index = next;
      next += 1;
      const job = jobs[index]!;
      results[index] = await checkSolution(
        job.problem,
        job.solution,
        options.modelOff,
        evaluate,
        prompts,
      );
    }
  };
  const width = options.modelOff ? 1 : Math.min(concurrency, jobs.length || 1);
  await Promise.all(Array.from({ length: width }, worker));

  return {
    predictions: results.flatMap((r) => r.predictions),
    callLog: results.flatMap((r) => r.callLog),
  };
};

/** JSONL: một object mỗi dòng, kết thúc bằng xuống dòng. */
export const formatJsonl = (records: readonly unknown[]): string =>
  records.map((record) => JSON.stringify(record)).join('\n') +
  (records.length > 0 ? '\n' : '');
