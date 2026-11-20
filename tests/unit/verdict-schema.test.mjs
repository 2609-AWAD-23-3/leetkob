import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODEL_VERDICT_SCHEMA,
  parseModelVerdicts,
} from '../../dist/shared/verdict-schema.js';

const IDS = ['c1', 'c2'];
const valid = () => ({
  verdicts: [
    {
      constraintId: 'c1',
      verdict: 'violation',
      evidence: [{ line: 3, text: 'std::sort(a, a + n);' }],
      reason: 'calls std::sort',
    },
    { constraintId: 'c2', verdict: 'unsure', evidence: [], reason: null },
  ],
});

test('verdict schema has no deduction field and forbids extra fields', () => {
  const item = MODEL_VERDICT_SCHEMA.properties.verdicts.items;
  assert.equal(MODEL_VERDICT_SCHEMA.additionalProperties, false);
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(Object.keys(item.properties).sort(), [
    'constraintId',
    'evidence',
    'reason',
    'verdict',
  ]);
});

test('valid model output parses into one verdict per constraint', () => {
  assert.deepEqual(parseModelVerdicts(valid(), IDS), {
    ok: true,
    verdicts: valid().verdicts,
  });
});

const invalidCases = [
  ['a deduction field from the model', (o) => (o.verdicts[0].deduction = 3)],
  ['an extra top-level field', (o) => (o.score = 7)],
  ['an unknown verdict value', (o) => (o.verdicts[0].verdict = 'maybe')],
  ['evidence line 0', (o) => (o.verdicts[0].evidence[0].line = 0)],
  ['a fractional evidence line', (o) => (o.verdicts[0].evidence[0].line = 1.5)],
  ['a violation without evidence', (o) => (o.verdicts[0].evidence = [])],
  ['an unknown constraint', (o) => (o.verdicts[1].constraintId = 'c9')],
  ['a duplicate constraint', (o) => (o.verdicts[1].constraintId = 'c1')],
  ['a missing constraint', (o) => o.verdicts.pop()],
  ['a missing reason field', (o) => delete o.verdicts[1].reason],
  ['a numeric reason', (o) => (o.verdicts[1].reason = 1)],
];

for (const [name, mutate] of invalidCases) {
  test(`model output with ${name} is rejected`, () => {
    const output = valid();
    mutate(output);
    const result = parseModelVerdicts(output, IDS);
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
  });
}

test('non-object model output is rejected', () => {
  for (const value of [null, 'pass', [], { verdicts: 'pass' }]) {
    assert.equal(parseModelVerdicts(value, IDS).ok, false);
  }
});
