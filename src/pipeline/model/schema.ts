import type { UnsureCause, VerdictValue } from '../../shared/domain/index.js';

export const MAX_EVIDENCE_LINES = 20;
export const MAX_REASON_LENGTH = 500;

const VERDICTS: readonly VerdictValue[] = ['pass', 'violation', 'unsure'];

/**
 * JSON schema gửi qua `output_config.format`. Mọi object có `additionalProperties: false`
 * và không có trường nào về điểm hay mức trừ. `reason` đứng trước `verdict` để model nêu lý do
 * rồi mới kết luận. Structured outputs không hỗ trợ `minimum`/`maxLength`, nên các giới hạn
 * đó được kiểm trong `parseModelOutput`.
 */
export const buildResultSchema = (
  constraintIds: readonly string[],
): Record<string, unknown> => ({
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          constraint_id: { type: 'string', enum: [...constraintIds] },
          reason: { type: 'string' },
          evidence_lines: { type: 'array', items: { type: 'integer' } },
          verdict: { type: 'string', enum: [...VERDICTS] },
        },
        required: ['constraint_id', 'reason', 'evidence_lines', 'verdict'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
});

export interface ParsedConstraintResult {
  readonly constraintId: string;
  readonly verdict: VerdictValue;
  /** Số dòng (từ 1, đã sắp xếp, không trùng) trong phạm vi file; rỗng khi verdict bị hạ xuống unsure. */
  readonly evidenceLines: readonly number[];
  readonly reason: string | null;
  readonly unsureCause: UnsureCause | null;
}

export interface ParsedModelOutput {
  /** Đúng một kết quả cho mỗi id được hỏi, theo thứ tự `constraintIds`. */
  readonly results: ParsedConstraintResult[];
  /** True nếu có bất kỳ constraint nào thành `unsure` vì `schema_error`, hoặc có id lạ. */
  readonly hasSchemaError: boolean;
}

export interface ParseModelOutputInput {
  readonly text: string | null;
  readonly stopReason: string | null;
  readonly constraintIds: readonly string[];
  /** Số dòng của file gốc. */
  readonly lineCount: number;
  readonly maxEvidenceLines?: number | undefined;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * G5: chỉ đòi đủ field bắt buộc. Field ngoài schema (ví dụ `deduction`, `score`) bị bỏ qua và
 * không bao giờ được đọc, nên không thể đổi verdict hay mức trừ; mức trừ luôn là mức TA đặt.
 * Thiếu field bắt buộc hoặc sai kiểu vẫn là `schema_error` (G1).
 */
const hasRequiredKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => keys.every((key) => Object.hasOwn(value, key));

const RESULT_KEYS = ['constraint_id', 'evidence_lines', 'reason', 'verdict'];

interface RawResult {
  readonly constraintId: string;
  readonly verdict: VerdictValue;
  readonly evidenceLines: number[];
  readonly reason: string;
}

const readRawResult = (value: unknown): RawResult | null => {
  if (!isPlainObject(value) || !hasRequiredKeys(value, RESULT_KEYS))
    return null;
  const { constraint_id, verdict, evidence_lines, reason } = value;
  if (typeof constraint_id !== 'string') return null;
  if (typeof reason !== 'string') return null;
  if (!VERDICTS.includes(verdict as VerdictValue)) return null;
  if (
    !Array.isArray(evidence_lines) ||
    !evidence_lines.every((line) => Number.isInteger(line))
  ) {
    return null;
  }
  return {
    constraintId: constraint_id,
    verdict: verdict as VerdictValue,
    evidenceLines: evidence_lines as number[],
    reason,
  };
};

const unsureResult = (
  constraintId: string,
  cause: UnsureCause,
  reason: string,
): ParsedConstraintResult => ({
  constraintId,
  verdict: 'unsure',
  evidenceLines: [],
  reason,
  unsureCause: cause,
});

const allSchemaError = (
  constraintIds: readonly string[],
  reason: string,
): ParsedModelOutput => ({
  results: constraintIds.map((id) => unsureResult(id, 'schema_error', reason)),
  hasSchemaError: true,
});

const clip = (value: string): string =>
  value.length > MAX_REASON_LENGTH
    ? `${value.slice(0, MAX_REASON_LENGTH)}…`
    : value;

/**
 * Kiểm output của model theo schema và theo phạm vi dòng. Luôn chạy, kể cả khi API đã ép schema,
 * vì refusal, `max_tokens` và model giả có thể trả output sai. Quy tắc gốc ở evidence PA03-T08
 * (`docs/evidence/PA03/T08/README.md`); các guardrail PA04 thay một phần quy tắc đó, ghi ở
 * `docs/evidence/PA04/T02/README.md` (G5: field ngoài schema bị bỏ qua, không còn là `schema_error`).
 */
export const parseModelOutput = (
  input: ParseModelOutputInput,
): ParsedModelOutput => {
  const { constraintIds, lineCount } = input;
  const maxLines = input.maxEvidenceLines ?? MAX_EVIDENCE_LINES;

  if (input.stopReason !== 'end_turn') {
    return allSchemaError(
      constraintIds,
      `The model response was not usable (stop reason: ${input.stopReason ?? 'none'}).`,
    );
  }
  if (input.text === null || input.text.trim() === '') {
    return allSchemaError(constraintIds, 'The model response had no text.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch {
    return allSchemaError(
      constraintIds,
      'The model output was not valid JSON.',
    );
  }
  if (
    !isPlainObject(parsed) ||
    !hasRequiredKeys(parsed, ['results']) ||
    !Array.isArray(parsed['results'])
  ) {
    return allSchemaError(
      constraintIds,
      'The model output did not match the response schema.',
    );
  }

  const byId = new Map<string, RawResult[]>();
  for (const item of parsed['results'] as unknown[]) {
    const raw = readRawResult(item);
    if (raw === null) {
      return allSchemaError(
        constraintIds,
        'The model output did not match the response schema.',
      );
    }
    const list = byId.get(raw.constraintId) ?? [];
    list.push(raw);
    byId.set(raw.constraintId, list);
  }

  const asked = new Set(constraintIds);
  let hasSchemaError = [...byId.keys()].some((id) => !asked.has(id));

  const results = constraintIds.map((id): ParsedConstraintResult => {
    const entries = byId.get(id) ?? [];
    if (entries.length === 0) {
      hasSchemaError = true;
      return unsureResult(
        id,
        'schema_error',
        'The model returned no result for this constraint.',
      );
    }
    const [raw] = entries;
    if (entries.length > 1 || raw === undefined) {
      hasSchemaError = true;
      return unsureResult(
        id,
        'schema_error',
        'The model returned more than one result for this constraint.',
      );
    }

    const lines = [...new Set(raw.evidenceLines)].sort((a, b) => a - b);
    const inRange = lines.every((line) => line >= 1 && line <= lineCount);
    const reason = raw.reason.trim() === '' ? null : clip(raw.reason.trim());

    if (!inRange || (raw.verdict === 'violation' && lines.length === 0)) {
      return unsureResult(
        id,
        'evidence_mismatch',
        clip(
          `The model said "${raw.verdict}" but its evidence lines are missing or outside the file.${
            reason === null ? '' : ` Model reason: ${reason}`
          }`,
        ),
      );
    }
    return {
      constraintId: id,
      verdict: raw.verdict,
      evidenceLines: lines.slice(0, maxLines),
      reason,
      unsureCause: raw.verdict === 'unsure' ? 'model_unsure' : null,
    };
  });

  return { results, hasSchemaError };
};
