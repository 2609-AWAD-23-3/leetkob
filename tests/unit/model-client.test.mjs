// Test của client model. Không có network: `globalThis.fetch` bị chặn, client thật chỉ nhận
// `fetch` giả, và không test nào dùng key thật (không có MODEL_API_KEY trong môi trường).
globalThis.fetch = () => {
  throw new Error('network access is forbidden in unit tests');
};
delete process.env.MODEL_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  computeCostUsd,
  createAnthropicModelClient,
  DEFAULT_MODEL_TIMEOUT_MS,
  estimateLabCostUsd,
  MODEL_NAME,
  MODEL_PRICING,
  ModelConfigError,
  ModelProviderError,
  ModelTimeoutError,
  readModelConfig,
} from '../../dist/pipeline/model/index.js';

const TEST_KEY = 'test-key-not-a-real-secret';
const SCHEMA = {
  type: 'object',
  properties: { results: { type: 'array', items: { type: 'object' } } },
  required: ['results'],
  additionalProperties: false,
};

const messageBody = (overrides = {}) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [
    { type: 'thinking', thinking: 'hmm', signature: 'sig' },
    { type: 'text', text: '{"results":[]}' },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1500, output_tokens: 300 },
  ...overrides,
});

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const makeFetch = (respond) => {
  const seen = [];
  const fetchFn = async (url, init) => {
    seen.push({ url: String(url), init });
    return respond(url, init, seen.length);
  };
  fetchFn.seen = seen;
  return fetchFn;
};

const makeClient = (fetchFn, extra = {}) =>
  createAnthropicModelClient({
    apiKey: TEST_KEY,
    timeoutMs: 2_000,
    fetch: fetchFn,
    ...extra,
  });

const request = (extra = {}) => ({
  system: 'SYSTEM PROMPT',
  user: 'USER PROMPT',
  schema: SCHEMA,
  signal: new AbortController().signal,
  timeoutMs: 2_000,
  ...extra,
});

test('cost: price constants follow ADR 0001', () => {
  assert.equal(MODEL_NAME, 'claude-haiku-5-5');
  assert.equal(MODEL_PRICING.inputUsdPerMTok, 0.1);
  assert.equal(MODEL_PRICING.outputUsdPerMTok, 0.5);
  assert.equal(DEFAULT_MODEL_TIMEOUT_MS, 30_000);
});

test('cost: computeCostUsd = in × $0.10/1M + out × $0.50/1M', () => {
  assert.equal(computeCostUsd(0, 0), 0);
  assert.equal(computeCostUsd(1_000_000, 0), 0.1);
  assert.equal(computeCostUsd(0, 1_000_000), 0.5);
  assert.ok(Math.abs(computeCostUsd(2_000, 1_000) - 0.0007) < 1e-12);
  assert.ok(Math.abs(computeCostUsd(1_234, 567) - 0.0004069) < 1e-12);
});

test('cost: invalid token counts are rejected', () => {
  for (const [a, b] of [
    [-1, 0],
    [0, -1],
    [1.5, 0],
    [Number.NaN, 0],
    [0, Infinity],
  ]) {
    assert.throws(() => computeCostUsd(a, b), RangeError);
  }
});

test('cost: a lab estimate is submissions × calls × cost of one call', () => {
  const cost = estimateLabCostUsd({
    submissions: 80,
    callsPerSubmission: 1,
    inputTokensPerCall: 2_000,
    outputTokensPerCall: 1_000,
  });
  assert.ok(Math.abs(cost - 0.056) < 1e-12);
});

test('config: MODEL_API_KEY is required and the error never prints a value', () => {
  assert.throws(
    () => readModelConfig({}),
    (error) => {
      assert.ok(error instanceof ModelConfigError);
      assert.match(error.message, /MODEL_API_KEY/);
      return true;
    },
  );
  assert.throws(
    () => readModelConfig({ MODEL_API_KEY: '   ' }),
    ModelConfigError,
  );
});

test('config: key and timeout are read from the environment, the timeout has a default', () => {
  assert.deepEqual(readModelConfig({ MODEL_API_KEY: TEST_KEY }), {
    apiKey: TEST_KEY,
    timeoutMs: 30_000,
  });
  assert.equal(
    readModelConfig({ MODEL_API_KEY: TEST_KEY, MODEL_TIMEOUT_MS: '12000' })
      .timeoutMs,
    12_000,
  );
  for (const bad of ['abc', '0', '-1', '1.5', '999999999']) {
    assert.throws(
      () => readModelConfig({ MODEL_API_KEY: TEST_KEY, MODEL_TIMEOUT_MS: bad }),
      ModelConfigError,
      bad,
    );
  }
  // ANTHROPIC_API_KEY không được dùng thay MODEL_API_KEY.
  assert.throws(
    () => readModelConfig({ ANTHROPIC_API_KEY: TEST_KEY }),
    ModelConfigError,
  );
});

test('no key: the real client cannot be created and nothing touches the network', () => {
  assert.equal(process.env.MODEL_API_KEY, undefined);
  assert.throws(() => createAnthropicModelClient({}), ModelConfigError);
  assert.throws(
    () => createAnthropicModelClient({ apiKey: '' }),
    ModelConfigError,
  );
  assert.throws(
    () => createAnthropicModelClient({ apiKey: TEST_KEY, timeoutMs: 0 }),
    ModelConfigError,
  );
});

test('no key: no other test file builds a real client or imports the SDK', () => {
  const offenders = [];
  for (const file of globSync('tests/**/*.test.{mjs,js,ts}')) {
    if (file.replaceAll('\\', '/').endsWith('unit/model-client.test.mjs'))
      continue;
    const source = readFileSync(file, 'utf8');
    if (
      /@anthropic-ai\/sdk/.test(source) ||
      /createAnthropicModelClient\s*\(/.test(source) ||
      /new Anthropic\s*\(/.test(source)
    ) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
});

test('real client: request body follows ADR 0001 (low effort, json schema, no sampling or thinking params)', async () => {
  const fetchFn = makeFetch(() =>
    jsonResponse(messageBody(), 200, { 'request-id': 'req_test_abc123' }),
  );
  const client = makeClient(fetchFn);
  assert.equal(client.provider, 'anthropic');
  assert.equal(client.model, 'claude-haiku-5-5');
  await client.complete(request());

  assert.equal(fetchFn.seen.length, 1);
  const { url, init } = fetchFn.seen[0];
  assert.match(url, /\/v1\/messages$/);
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.equal(body.system, 'SYSTEM PROMPT');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'USER PROMPT' }]);
  assert.equal(body.max_tokens, 4000);
  assert.equal(body.output_config.effort, 'low');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.deepEqual(body.output_config.format.schema, SCHEMA);
  for (const forbidden of [
    'temperature',
    'top_p',
    'top_k',
    'thinking',
    'stream',
  ]) {
    assert.equal(forbidden in body, false, `body must not send ${forbidden}`);
  }
  // Key đi qua header của SDK, không nằm trong body.
  assert.equal(JSON.stringify(body).includes(TEST_KEY), false);
});

test('real client: reads the text block after a thinking block, request id, usage and model', async () => {
  const fetchFn = makeFetch(() =>
    jsonResponse(messageBody(), 200, { 'request-id': 'req_test_abc123' }),
  );
  const out = await makeClient(fetchFn).complete(request());
  assert.equal(out.text, '{"results":[]}');
  assert.equal(out.stopReason, 'end_turn');
  assert.equal(out.requestId, 'req_test_abc123');
  assert.equal(out.model, 'claude-haiku-5-5');
  assert.equal(out.inputTokens, 1500);
  assert.equal(out.outputTokens, 300);
  assert.ok(Number.isFinite(out.latencyMs) && out.latencyMs >= 0);
});

test('real client: a response without a text block gives text null; refusal is passed through', async () => {
  const fetchFn = makeFetch(() =>
    jsonResponse(
      messageBody({
        content: [{ type: 'thinking', thinking: 'x', signature: 's' }],
        stop_reason: 'refusal',
      }),
    ),
  );
  const out = await makeClient(fetchFn).complete(request());
  assert.equal(out.text, null);
  assert.equal(out.stopReason, 'refusal');
  assert.equal(out.requestId, null);
});

test('real client: 429 and 5xx become ModelProviderError and are not retried inside the client', async () => {
  for (const status of [429, 500, 503, 529]) {
    const fetchFn = makeFetch(() =>
      jsonResponse(
        { type: 'error', error: { type: 'api_error', message: 'try later' } },
        status,
        { 'request-id': 'req_err_1' },
      ),
    );
    await assert.rejects(makeClient(fetchFn).complete(request()), (error) => {
      assert.ok(error instanceof ModelProviderError, `status ${status}`);
      assert.equal(error.status, status);
      assert.equal(error.retryable, true);
      return true;
    });
    assert.equal(
      fetchFn.seen.length,
      1,
      `status ${status} must not be retried`,
    );
  }
});

test('real client: 400 and 401 are ModelProviderError, not retryable, and never contain the key', async () => {
  for (const status of [400, 401]) {
    const fetchFn = makeFetch(() =>
      jsonResponse(
        {
          type: 'error',
          error: {
            type:
              status === 401 ? 'authentication_error' : 'invalid_request_error',
            message: `rejected credential ${TEST_KEY}`,
          },
        },
        status,
      ),
    );
    await assert.rejects(makeClient(fetchFn).complete(request()), (error) => {
      assert.ok(error instanceof ModelProviderError);
      assert.equal(error.status, status);
      assert.equal(error.retryable, false);
      assert.equal(error.message.includes(TEST_KEY), false);
      assert.equal(String(error.stack).includes(TEST_KEY), false);
      return true;
    });
  }
});

test('real client: a connection failure is a retryable ModelProviderError', async () => {
  const fetchFn = makeFetch(() => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(makeClient(fetchFn).complete(request()), (error) => {
    assert.ok(error instanceof ModelProviderError);
    assert.equal(error.status, null);
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(fetchFn.seen.length, 1);
});

test('real client: a hanging request is cut at the deadline with ModelTimeoutError', async () => {
  const fetchFn = makeFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
      }),
  );
  const client = makeClient(fetchFn, { timeoutMs: 50 });
  const started = Date.now();
  await assert.rejects(
    client.complete(request({ timeoutMs: 50 })),
    ModelTimeoutError,
  );
  assert.ok(Date.now() - started < 2_000);
  assert.equal(fetchFn.seen.length, 1, 'a timed out call must not be retried');
});

test('real client: the caller signal aborts the request without becoming a timeout', async () => {
  const fetchFn = makeFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
      }),
  );
  const controller = new AbortController();
  const pending = makeClient(fetchFn).complete(
    request({ signal: controller.signal }),
  );
  setTimeout(() => controller.abort(new Error('lease lost')), 20);
  await assert.rejects(pending, (error) => {
    assert.equal(error instanceof ModelTimeoutError, false);
    assert.equal(error instanceof ModelProviderError, false);
    return true;
  });
});
