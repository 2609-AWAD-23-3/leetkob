import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from '@anthropic-ai/sdk';
import { MODEL_NAME, MODEL_PROVIDER } from './cost.js';
import {
  ModelConfigError,
  ModelProviderError,
  ModelTimeoutError,
} from './errors.js';
import type {
  ModelClient,
  ModelCompletion,
  ModelCompletionRequest,
} from './types.js';

export const DEFAULT_MODEL_TIMEOUT_MS = 30_000;
export const MAX_MODEL_TIMEOUT_MS = 300_000;
/** Chỗ cho thinking (effort low) và JSON kết quả. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4_000;
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export interface ModelConfig {
  readonly apiKey: string;
  readonly timeoutMs: number;
}

const parseTimeoutMs = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_MODEL_TIMEOUT_MS) {
    throw new ModelConfigError(
      `${label} must be an integer between 1 and ${MAX_MODEL_TIMEOUT_MS} milliseconds`,
    );
  }
  return value;
};

/**
 * Đọc cấu hình model từ biến môi trường: `MODEL_API_KEY` (bắt buộc, không dùng
 * `ANTHROPIC_API_KEY`) và `MODEL_TIMEOUT_MS` (tuỳ chọn, mặc định 30 giây).
 * Thông báo lỗi chỉ nêu tên biến, không bao giờ in giá trị.
 */
export const readModelConfig = (
  env: Readonly<Record<string, string | undefined>>,
): ModelConfig => {
  const apiKey = env['MODEL_API_KEY']?.trim();
  if (apiKey === undefined || apiKey === '') {
    throw new ModelConfigError(
      'MODEL_API_KEY is not set; the semantic model cannot be called without it',
    );
  }
  const rawTimeout = env['MODEL_TIMEOUT_MS']?.trim();
  const timeoutMs =
    rawTimeout === undefined || rawTimeout === ''
      ? DEFAULT_MODEL_TIMEOUT_MS
      : parseTimeoutMs(Number(rawTimeout), 'MODEL_TIMEOUT_MS');
  return { apiKey, timeoutMs };
};

export interface AnthropicModelClientOptions {
  readonly apiKey?: string | undefined;
  readonly model?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxTokens?: number | undefined;
  /** Chỉ để test: thay `fetch` để không có network. */
  readonly fetch?: typeof globalThis.fetch | undefined;
}

const redact = (message: string, secret: string): string =>
  message.split(secret).join('[redacted]');

const joinText = (
  content: Anthropic.Messages.Message['content'],
): string | null => {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text);
  }
  return parts.length === 0 ? null : parts.join('');
};

/**
 * Client thật dùng SDK chính thức của Anthropic (ADR 0001): `claude-haiku-5-5`,
 * `output_config.effort = "low"`, kết quả theo JSON schema. Không gửi `temperature`,
 * `top_p`, `top_k`, `thinking` hay assistant prefill (Haiku 5.5 trả lỗi 400 cho các tham số đó).
 *
 * Hạn cứng: timeout của SDK cộng `AbortController` riêng, `maxRetries: 0` để thời gian chờ
 * thực tế không bị nhân lên. Retry là việc của worker (job), không phải của client.
 */
export const createAnthropicModelClient = (
  options: AnthropicModelClientOptions,
): ModelClient => {
  const apiKey = options.apiKey?.trim();
  if (apiKey === undefined || apiKey === '') {
    throw new ModelConfigError(
      'MODEL_API_KEY is not set; the semantic model cannot be called without it',
    );
  }
  const model = options.model ?? MODEL_NAME;
  const defaultTimeoutMs = parseTimeoutMs(
    options.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS,
    'timeoutMs',
  );
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const sdk = new Anthropic({
    apiKey,
    baseURL: ANTHROPIC_BASE_URL,
    maxRetries: 0,
    timeout: defaultTimeoutMs,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });

  return {
    provider: MODEL_PROVIDER,
    model,
    async complete(request: ModelCompletionRequest): Promise<ModelCompletion> {
      if (request.signal.aborted) {
        throw request.signal.reason ?? new Error('Model call aborted');
      }
      const timeoutMs = parseTimeoutMs(request.timeoutMs, 'timeoutMs');
      const controller = new AbortController();
      const forwardAbort = (): void => controller.abort(request.signal.reason);
      request.signal.addEventListener('abort', forwardAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const started = Date.now();

      try {
        const message = await sdk.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: request.system,
            messages: [{ role: 'user', content: request.user }],
            output_config: {
              effort: 'low',
              format: { type: 'json_schema', schema: request.schema },
            },
          },
          { signal: controller.signal, timeout: timeoutMs, maxRetries: 0 },
        );
        return {
          text: joinText(message.content),
          stopReason: message.stop_reason,
          requestId: message._request_id ?? null,
          model: message.model,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        if (timedOut || error instanceof APIConnectionTimeoutError) {
          throw new ModelTimeoutError(
            `Model call exceeded ${timeoutMs} ms and was aborted`,
          );
        }
        if (request.signal.aborted || error instanceof APIUserAbortError) {
          throw request.signal.reason ?? error;
        }
        if (error instanceof APIError) {
          const status = error.status ?? null;
          const requestId = error.requestID ?? null;
          const type = error.type === null ? '' : `, ${error.type}`;
          const requestPart =
            requestId === null ? '' : `, request-id ${requestId}`;
          const detail = redact(error.apiMessage ?? error.message, apiKey);
          throw new ModelProviderError(
            `Anthropic API call failed (${status === null ? 'no HTTP status' : `HTTP ${status}`}${type}${requestPart}): ${detail}`,
            { status, requestId },
          );
        }
        throw new ModelProviderError(
          `Anthropic API call failed: ${redact(
            error instanceof Error ? error.message : String(error),
            apiKey,
          )}`,
        );
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener('abort', forwardAbort);
      }
    },
  };
};
