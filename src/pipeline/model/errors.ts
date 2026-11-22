import type { NewModelCallLog } from '../../shared/domain/index.js';

/** Thiếu hoặc sai cấu hình model (ví dụ thiếu `MODEL_API_KEY`). Thông báo không chứa giá trị key. */
export class ModelConfigError extends Error {
  override readonly name = 'ModelConfigError';
}

/** Call vượt hạn cứng. Evaluator đổi lỗi này thành `unsure` với cause `timeout`. */
export class ModelTimeoutError extends Error {
  override readonly name = 'ModelTimeoutError';
}

export interface ModelProviderErrorOptions {
  readonly status?: number | null | undefined;
  readonly retryable?: boolean | undefined;
  readonly requestId?: string | null | undefined;
  readonly modelCall?: NewModelCallLog | undefined;
}

/**
 * Lỗi từ provider (429, 5xx, lỗi kết nối, 400/401). Không bị đổi thành `unsure`:
 * evaluator ném lại để worker T06 retry job. `modelCall` là dòng call log
 * (`outcome: 'provider_error'`) để bên gọi ghi lại nếu muốn.
 */
export class ModelProviderError extends Error {
  override readonly name = 'ModelProviderError';
  readonly status: number | null;
  readonly retryable: boolean;
  readonly requestId: string | null;
  modelCall: NewModelCallLog | undefined;

  constructor(message: string, options: ModelProviderErrorOptions = {}) {
    super(message);
    this.status = options.status ?? null;
    this.retryable =
      options.retryable ??
      (this.status === null || this.status === 429 || this.status >= 500);
    this.requestId = options.requestId ?? null;
    this.modelCall = options.modelCall;
  }
}
