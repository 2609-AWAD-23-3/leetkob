// Kiểm tra ở mức kiểu (do `npm run type-check` chạy): evaluator của T08 gắn được vào
// `evaluateSemanticConstraints` của worker T06 mà `src/pipeline/` không import `src/worker/`.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSemanticEvaluator,
  type ModelClient,
} from '../../src/pipeline/model/index.js';
import type { EvaluateSemanticConstraintsFn } from '../../src/worker/types.js';

const client: ModelClient = {
  provider: 'fake',
  model: 'fake-model',
  complete: () => Promise.reject(new Error('never called')),
};

test('createSemanticEvaluator is assignable to EvaluateSemanticConstraintsFn', async () => {
  const evaluate: EvaluateSemanticConstraintsFn = createSemanticEvaluator({
    client,
    timeoutMs: 1_000,
    getIdentity: () => [],
  });
  assert.equal(typeof evaluate, 'function');
});
