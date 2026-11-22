// Model và giá theo ADR 0001 (docs/architecture/decisions/0001-host-model-and-spending-cap.md).
export const MODEL_NAME = 'claude-haiku-5-5';
export const MODEL_PROVIDER = 'anthropic';

/** USD cho 1 triệu token, áp dụng khi prompt <= 100K token (ADR 0001). */
export const MODEL_PRICING = {
  inputUsdPerMTok: 0.1,
  outputUsdPerMTok: 0.5,
} as const;

const MICRO_USD_PER_USD = 1_000_000;
const TOKENS_PER_MTOK = 1_000_000;

const assertTokenCount = (value: number, name: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
};

/**
 * costUsd = inputTokens × $0.10/1M + outputTokens × $0.50/1M.
 * Tính bằng số nguyên (micro-USD cho 1M token) rồi chia một lần để tránh sai số số thực.
 */
export function computeCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  assertTokenCount(inputTokens, 'inputTokens');
  assertTokenCount(outputTokens, 'outputTokens');
  const inputRate = Math.round(
    MODEL_PRICING.inputUsdPerMTok * MICRO_USD_PER_USD,
  );
  const outputRate = Math.round(
    MODEL_PRICING.outputUsdPerMTok * MICRO_USD_PER_USD,
  );
  return (
    (inputTokens * inputRate + outputTokens * outputRate) /
    (MICRO_USD_PER_USD * TOKENS_PER_MTOK)
  );
}

export interface LabCostAssumptions {
  readonly submissions: number;
  /** Mỗi bài nộp gọi model một lần cho tất cả constraint semantic. */
  readonly callsPerSubmission: number;
  readonly inputTokensPerCall: number;
  readonly outputTokensPerCall: number;
}

/** Chi phí một lab theo giả định token trung bình mỗi call. */
export function estimateLabCostUsd(assumptions: LabCostAssumptions): number {
  const calls = assumptions.submissions * assumptions.callsPerSubmission;
  return computeCostUsd(
    calls * assumptions.inputTokensPerCall,
    calls * assumptions.outputTokensPerCall,
  );
}
