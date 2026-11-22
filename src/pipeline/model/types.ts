import type {
  Constraint,
  Lab,
  NewConstraintVerdict,
  NewModelCallLog,
  Submission,
} from '../../shared/domain/index.js';

export interface ModelCompletionRequest {
  readonly system: string;
  readonly user: string;
  /** JSON schema của output, gửi qua `output_config.format`. */
  readonly schema: Record<string, unknown>;
  /** Bị abort khi hết hạn hoặc khi job bị huỷ; client phải dừng request khi signal abort. */
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

export interface ModelCompletion {
  /** Text JSON của model; `null` nếu response không có text block. */
  readonly text: string | null;
  readonly stopReason: string | null;
  /** Provider request id (header `request-id` / `_request_id`); `null` nếu không có response. */
  readonly requestId: string | null;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
}

/** Client model nhỏ, thay được bằng fake trong test. Lỗi provider và timeout được ném ra. */
export interface ModelClient {
  readonly provider: string;
  readonly model: string;
  complete(request: ModelCompletionRequest): Promise<ModelCompletion>;
}

// Khớp cấu trúc với `WorkerJobContext` và `EvaluateSemanticConstraintsFn` của T06,
// nhưng không import `src/worker/` (pipeline không phụ thuộc worker).
export interface SemanticEvaluationContext {
  readonly submission: Pick<Submission, 'id' | 'code'>;
  readonly lab: Pick<Lab, 'statement'>;
  readonly signal: AbortSignal;
}

export type SemanticConstraint = Pick<Constraint, 'id' | 'text'>;

export interface SemanticEvaluationResult {
  readonly verdicts: NewConstraintVerdict[];
  readonly modelCalls: NewModelCallLog[];
}

export type SemanticEvaluator = (
  context: SemanticEvaluationContext,
  constraints: readonly SemanticConstraint[],
) => Promise<SemanticEvaluationResult>;

/** Prompt cuối cùng đã gửi, để script evidence ghi ra file (bảng `model_calls` không có cột prompt). */
export interface PromptRecord {
  readonly submissionId: string;
  readonly system: string;
  readonly user: string;
  readonly promptSha256: string;
}
