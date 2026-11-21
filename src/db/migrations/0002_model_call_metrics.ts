import type { Migration } from './types.js';

export const migration0002: Migration = {
  id: '0002_model_call_metrics',
  sql: `
ALTER TABLE model_calls
  ADD CONSTRAINT model_calls_input_tokens_nonnegative CHECK (input_tokens >= 0),
  ADD CONSTRAINT model_calls_output_tokens_nonnegative CHECK (output_tokens >= 0),
  ADD CONSTRAINT model_calls_latency_nonnegative CHECK (latency_ms >= 0),
  ADD CONSTRAINT model_calls_cost_valid
    CHECK (cost_usd >= 0 AND cost_usd < 'Infinity'::double precision);
`,
};
