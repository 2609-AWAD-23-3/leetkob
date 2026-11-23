import type {
  Evidence,
  NewConstraintVerdict,
  NewModelCallLog,
  Submission,
  UnsureCause,
} from '../../shared/domain/index.js';
import { computeCostUsd } from './cost.js';
import { ModelProviderError, ModelTimeoutError } from './errors.js';
import { resolvePromptIdentity } from './identity.js';
import { buildPrompt } from './prompt.js';
import {
  buildResultSchema,
  parseModelOutput,
  type ParsedConstraintResult,
} from './schema.js';
import { sanitizeCode, splitLines } from './sanitize.js';
import type {
  ModelClient,
  ModelCompletion,
  PromptIdentity,
  PromptRecord,
  SemanticConstraint,
  SemanticEvaluationContext,
  SemanticEvaluationResult,
  SemanticEvaluator,
} from './types.js';

const MAX_EVIDENCE_TEXT_LENGTH = 500;

export interface SemanticEvaluatorDeps {
  readonly client: ModelClient;
  /** Hạn cứng của một call (ms). */
  readonly timeoutMs: number;
  /** Đồng hồ (ms) để đo thời gian call bị timeout; mặc định `Date.now`. */
  readonly now?: (() => number) | undefined;
  /**
   * Danh tính sinh viên cần che khỏi prompt: họ tên và từng phần tên, MSSV, username, email.
   * Bắt buộc, để không ai quên bước này; T11 lấy từ DB.
   */
  readonly getIdentity: (
    submission: Pick<Submission, 'id' | 'code'>,
  ) =>
    | readonly string[]
    | PromptIdentity
    | Promise<readonly string[] | PromptIdentity>;
  /** Tuỳ chọn: nhận prompt cuối cùng trước khi gọi model (ghi evidence, hoặc lưu prompt/hash). */
  readonly onPrompt?:
    ((record: PromptRecord) => void | Promise<void>) | undefined;
}

const originalLineText = (line: string): string =>
  line.length > MAX_EVIDENCE_TEXT_LENGTH
    ? line.slice(0, MAX_EVIDENCE_TEXT_LENGTH)
    : line;

const unsureVerdict = (
  submissionId: string,
  constraintId: string,
  cause: UnsureCause,
  reason: string,
): NewConstraintVerdict => ({
  submissionId,
  constraintId,
  verdict: 'unsure',
  evidence: [],
  unsureCause: cause,
  reason,
  source: 'model',
});

const callLog = (
  client: ModelClient,
  submissionId: string,
  constraintIds: readonly string[],
  fields: {
    /** Model do provider báo trong response; mặc định là model của client. */
    model?: string;
  } & Pick<
    NewModelCallLog,
    | 'requestId'
    | 'inputTokens'
    | 'outputTokens'
    | 'latencyMs'
    | 'costUsd'
    | 'outcome'
  >,
): NewModelCallLog => ({
  submissionId,
  constraintIds: [...constraintIds],
  provider: client.provider,
  model: fields.model ?? client.model,
  ...fields,
});

/**
 * Evaluator chấm các constraint semantic bằng model. Đầu vào và đầu ra khớp cấu trúc với
 * `EvaluateSemanticConstraintsFn` của worker (T06) mà không import `src/worker/`.
 *
 * - Không có constraint semantic: không gọi model.
 * - Mỗi bài nộp một call cho tất cả constraint semantic.
 * - Output sai schema, hết giờ, evidence không khớp: `unsure` kèm cause.
 * - Lỗi provider (429, 5xx, kết nối, 400/401) và job bị huỷ: ném lỗi để worker retry.
 */
export const createSemanticEvaluator = (
  deps: SemanticEvaluatorDeps,
): SemanticEvaluator => {
  if (typeof deps?.client?.complete !== 'function') {
    throw new TypeError('createSemanticEvaluator requires a model client');
  }
  if (typeof deps.getIdentity !== 'function') {
    throw new TypeError(
      'createSemanticEvaluator requires getIdentity so student identity is always removed from the prompt',
    );
  }
  if (!Number.isFinite(deps.timeoutMs) || deps.timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }
  const { client, timeoutMs } = deps;
  const now = deps.now ?? Date.now;

  return async (
    context: SemanticEvaluationContext,
    constraints: readonly SemanticConstraint[],
  ): Promise<SemanticEvaluationResult> => {
    if (constraints.length === 0) return { verdicts: [], modelCalls: [] };

    const constraintIds = constraints.map((c) => c.id);
    if (new Set(constraintIds).size !== constraintIds.length) {
      throw new TypeError('Semantic constraint ids must be unique');
    }
    const submissionId = context.submission.id;
    if (context.signal.aborted) throw abortReason(context.signal);

    // Fail-closed: không che được danh tính thì không gửi prompt (tên thật sẽ lọt vào model).
    // Chỉ `NO_STUDENT_IDENTITY_DATASET` (checker trên dataset) được phép không có danh tính.
    const identity = resolvePromptIdentity(
      await deps.getIdentity(context.submission),
    );
    const originalLines = splitLines(context.submission.code);
    const sanitized = sanitizeCode(context.submission.code, identity.parts);
    const sanitizedLines = splitLines(sanitized);
    const prompt = buildPrompt({
      statement: context.lab.statement,
      constraints,
      sanitizedCode: sanitized,
    });
    await deps.onPrompt?.({
      submissionId,
      system: prompt.system,
      user: prompt.user,
      promptSha256: prompt.promptSha256,
      identity: identity.label,
    });

    const startedAt = now();
    let completion: ModelCompletion;
    try {
      completion = await callWithDeadline(client, context.signal, timeoutMs, {
        system: prompt.system,
        user: prompt.user,
        schema: buildResultSchema(constraintIds),
      });
    } catch (error) {
      if (context.signal.aborted) throw abortReason(context.signal);
      if (error instanceof ModelTimeoutError) {
        return {
          verdicts: constraints.map((c) =>
            unsureVerdict(
              submissionId,
              c.id,
              'timeout',
              `The model did not answer within ${timeoutMs} ms.`,
            ),
          ),
          modelCalls: [
            callLog(client, submissionId, constraintIds, {
              requestId: null,
              inputTokens: 0,
              outputTokens: 0,
              latencyMs: Math.max(0, now() - startedAt),
              costUsd: 0,
              outcome: 'timeout',
            }),
          ],
        };
      }
      const failure =
        error instanceof ModelProviderError
          ? error
          : new ModelProviderError(
              error instanceof Error ? error.message : String(error),
              {
                status:
                  typeof (error as { status?: unknown })?.status === 'number'
                    ? (error as { status: number }).status
                    : null,
              },
            );
      failure.modelCall ??= callLog(client, submissionId, constraintIds, {
        requestId: failure.requestId,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Math.max(0, now() - startedAt),
        costUsd: 0,
        outcome: 'provider_error',
      });
      throw failure;
    }

    const parsed = parseModelOutput({
      text: completion.text,
      stopReason: completion.stopReason,
      constraintIds,
      lineCount: originalLines.length,
    });
    const verdicts = parsed.results.map((r) =>
      toVerdict(submissionId, r, originalLines, sanitizedLines),
    );
    return {
      verdicts,
      modelCalls: [
        callLog(client, submissionId, constraintIds, {
          model: completion.model,
          requestId: completion.requestId,
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
          latencyMs: completion.latencyMs,
          costUsd: computeCostUsd(
            completion.inputTokens,
            completion.outputTokens,
          ),
          outcome: parsed.hasSchemaError ? 'schema_error' : 'ok',
        }),
      ],
    };
  };
};

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new Error('Semantic evaluation aborted');

/**
 * Gọi client với hạn cứng: tới hạn thì abort `signal` đưa cho client và bỏ kết quả của call,
 * kể cả khi client bỏ qua signal. Signal của job bị abort thì ném lỗi.
 */
const callWithDeadline = (
  client: ModelClient,
  jobSignal: AbortSignal,
  timeoutMs: number,
  request: { system: string; user: string; schema: Record<string, unknown> },
): Promise<ModelCompletion> =>
  new Promise<ModelCompletion>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      jobSignal.removeEventListener('abort', onJobAbort);
      action();
    };
    const timer = setTimeout(() => {
      finish(() => {
        const error = new ModelTimeoutError(
          `Model call exceeded ${timeoutMs} ms and was aborted`,
        );
        controller.abort(error);
        reject(error);
      });
    }, timeoutMs);
    const onJobAbort = (): void =>
      finish(() => {
        controller.abort(jobSignal.reason);
        reject(abortReason(jobSignal));
      });
    jobSignal.addEventListener('abort', onJobAbort, { once: true });

    let pending: Promise<ModelCompletion>;
    try {
      pending = client.complete({
        ...request,
        signal: controller.signal,
        timeoutMs,
      });
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    pending.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });

const toVerdict = (
  submissionId: string,
  result: ParsedConstraintResult,
  originalLines: readonly string[],
  sanitizedLines: readonly string[],
): NewConstraintVerdict => {
  // Dòng mà model chưa từng thấy nội dung (dòng trống sau khi bỏ comment) không phải là
  // bằng chứng cho một violation.
  const citesVisibleCode = result.evidenceLines.some(
    (line) => (sanitizedLines[line - 1] ?? '').trim() !== '',
  );
  if (result.verdict === 'violation' && !citesVisibleCode) {
    return unsureVerdict(
      submissionId,
      result.constraintId,
      'evidence_mismatch',
      `The model said "violation" but cited only lines with no code. Model reason: ${result.reason ?? '(none)'}`,
    );
  }
  const evidence: Evidence[] = result.evidenceLines.map((line) => ({
    line,
    text: originalLineText(originalLines[line - 1] ?? ''),
  }));
  return {
    submissionId,
    constraintId: result.constraintId,
    verdict: result.verdict,
    evidence,
    unsureCause: result.unsureCause,
    reason: result.reason,
    source: 'model',
  };
};
