import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildResultSchema,
  parseModelOutput,
} from '../../dist/pipeline/model/index.js';
import { result } from '../support/model-fakes.mjs';

const IDS = ['c1', 'c2'];
const parse = (text, overrides = {}) =>
  parseModelOutput({
    text,
    stopReason: 'end_turn',
    constraintIds: IDS,
    lineCount: 10,
    ...overrides,
  });
const body = (results) => JSON.stringify({ results });
const byId = (parsed, id) => parsed.results.find((r) => r.constraintId === id);

const assertAllSchemaError = (parsed) => {
  assert.equal(parsed.results.length, IDS.length);
  for (const r of parsed.results) {
    assert.equal(r.verdict, 'unsure');
    assert.equal(r.unsureCause, 'schema_error');
    assert.deepEqual(r.evidenceLines, []);
  }
  assert.equal(parsed.hasSchemaError, true);
};

test('schema: the request schema has enums for ids and verdicts and no score field', () => {
  const schema = buildResultSchema(IDS);
  const item = schema.properties.results.items;
  assert.deepEqual(item.properties.constraint_id.enum, IDS);
  assert.deepEqual(item.properties.verdict.enum, [
    'pass',
    'violation',
    'unsure',
  ]);
  assert.equal(item.properties.evidence_lines.items.type, 'integer');
  assert.equal(item.properties.reason.type, 'string');
  assert.equal(schema.additionalProperties, false);
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(
    [...item.required].sort(),
    ['constraint_id', 'evidence_lines', 'reason', 'verdict'].sort(),
  );
  const serialised = JSON.stringify(schema).toLowerCase();
  for (const word of ['deduction', 'score', 'penalty', 'points', 'grade']) {
    assert.equal(serialised.includes(word), false, `schema mentions ${word}`);
  }
});

test('schema: a clean output is accepted as is', () => {
  const parsed = parse(
    body([result('c1', 'pass'), result('c2', 'violation', [3, 5], 'bad')]),
  );
  assert.equal(parsed.hasSchemaError, false);
  assert.equal(byId(parsed, 'c1').verdict, 'pass');
  assert.equal(byId(parsed, 'c1').unsureCause, null);
  assert.equal(byId(parsed, 'c2').verdict, 'violation');
  assert.deepEqual(byId(parsed, 'c2').evidenceLines, [3, 5]);
  assert.equal(byId(parsed, 'c2').reason, 'bad');
});

for (const [name, text] of [
  ['broken JSON', '{"results": [ {'],
  ['not JSON at all', 'I think everything passes.'],
  ['empty text', ''],
  ['null JSON', 'null'],
  ['an array at the top level', '[]'],
  ['missing results', '{}'],
  ['results is not an array', '{"results": "pass"}'],
  ['an extra top-level field', '{"results": [], "deduction": 2}'],
]) {
  test(`schema: ${name} makes every constraint unsure with schema_error`, () => {
    assertAllSchemaError(parse(text));
  });
}

const badItems = {
  'an unknown verdict': { ...result('c1', 'pass'), verdict: 'maybe' },
  'an extra field named deduction': { ...result('c1', 'pass'), deduction: 2 },
  'an extra field named score': { ...result('c1', 'pass'), score: 0.5 },
  'a missing reason': (() => {
    const r = result('c1', 'pass');
    delete r.reason;
    return r;
  })(),
  'a missing evidence_lines': (() => {
    const r = result('c1', 'pass');
    delete r.evidence_lines;
    return r;
  })(),
  'evidence_lines that are not integers': {
    ...result('c1', 'violation'),
    evidence_lines: ['3'],
  },
  'evidence_lines with a fractional number': {
    ...result('c1', 'violation'),
    evidence_lines: [2.5],
  },
  'a reason that is not a string': { ...result('c1', 'pass'), reason: 42 },
  'a constraint_id that is not a string': {
    ...result('c1', 'pass'),
    constraint_id: 1,
  },
  'an item that is not an object': 'pass',
};
for (const [name, item] of Object.entries(badItems)) {
  test(`schema: ${name} makes every constraint unsure with schema_error`, () => {
    assertAllSchemaError(parse(body([item, result('c2', 'pass')])));
  });
}

test('schema: a missing constraint becomes schema_error, the valid one is kept', () => {
  const parsed = parse(body([result('c1', 'pass')]));
  assert.equal(byId(parsed, 'c1').verdict, 'pass');
  assert.equal(byId(parsed, 'c2').verdict, 'unsure');
  assert.equal(byId(parsed, 'c2').unsureCause, 'schema_error');
  assert.equal(parsed.hasSchemaError, true);
});

test('schema: a duplicated id becomes schema_error for that id only', () => {
  const parsed = parse(
    body([
      result('c1', 'pass'),
      result('c1', 'violation', [2]),
      result('c2', 'pass'),
    ]),
  );
  assert.equal(byId(parsed, 'c1').verdict, 'unsure');
  assert.equal(byId(parsed, 'c1').unsureCause, 'schema_error');
  assert.equal(byId(parsed, 'c2').verdict, 'pass');
});

test('schema: an unknown id is ignored, the asked constraints keep their result', () => {
  const parsed = parse(
    body([
      result('c1', 'pass'),
      result('zzz', 'violation', [1]),
      result('c2', 'pass'),
    ]),
  );
  assert.equal(parsed.results.length, 2);
  assert.equal(byId(parsed, 'c1').verdict, 'pass');
  assert.equal(byId(parsed, 'c2').verdict, 'pass');
  assert.equal(parsed.hasSchemaError, true);
});

test('schema: an unknown id with a missing asked constraint leaves that one as schema_error', () => {
  const parsed = parse(body([result('c1', 'pass'), result('zzz', 'pass')]));
  assert.equal(byId(parsed, 'c1').verdict, 'pass');
  assert.equal(byId(parsed, 'c2').unsureCause, 'schema_error');
});

for (const stopReason of ['refusal', 'max_tokens', 'tool_use', null]) {
  test(`schema: stop_reason ${stopReason} is schema_error even if the text is valid`, () => {
    assertAllSchemaError(
      parse(body([result('c1', 'pass'), result('c2', 'pass')]), { stopReason }),
    );
  });
}

test('schema: no text block is schema_error', () => {
  assertAllSchemaError(parse(null));
});

test('schema: violation without evidence lines is evidence_mismatch', () => {
  const parsed = parse(
    body([result('c1', 'violation', []), result('c2', 'pass')]),
  );
  assert.equal(byId(parsed, 'c1').verdict, 'unsure');
  assert.equal(byId(parsed, 'c1').unsureCause, 'evidence_mismatch');
  assert.equal(byId(parsed, 'c2').verdict, 'pass');
  assert.equal(parsed.hasSchemaError, false);
});

for (const lines of [[0], [11], [-1], [3, 99]]) {
  test(`schema: evidence lines ${JSON.stringify(lines)} outside 1..10 is evidence_mismatch`, () => {
    const parsed = parse(
      body([result('c1', 'violation', lines), result('c2', 'pass')]),
    );
    assert.equal(byId(parsed, 'c1').verdict, 'unsure');
    assert.equal(byId(parsed, 'c1').unsureCause, 'evidence_mismatch');
  });
}

test('schema: pass and unsure may omit evidence, but lines that are given must be in range', () => {
  const ok = parse(
    body([result('c1', 'pass', []), result('c2', 'unsure', [])]),
  );
  assert.equal(byId(ok, 'c1').verdict, 'pass');
  assert.equal(byId(ok, 'c2').unsureCause, 'model_unsure');

  const bad = parse(
    body([result('c1', 'pass', [50]), result('c2', 'unsure', [0])]),
  );
  assert.equal(byId(bad, 'c1').verdict, 'unsure');
  assert.equal(byId(bad, 'c1').unsureCause, 'evidence_mismatch');
  assert.equal(byId(bad, 'c2').unsureCause, 'evidence_mismatch');
});

test('schema: evidence lines are sorted, deduplicated and capped', () => {
  const lines = [9, 2, 2, 5, 1, 3, 4, 6, 7, 8];
  const parsed = parseModelOutput({
    text: body([result('c1', 'violation', lines), result('c2', 'pass')]),
    stopReason: 'end_turn',
    constraintIds: IDS,
    lineCount: 100,
    maxEvidenceLines: 4,
  });
  assert.deepEqual(byId(parsed, 'c1').evidenceLines, [1, 2, 3, 4]);
});

test('schema: a very long reason is truncated, not rejected', () => {
  const parsed = parse(
    body([result('c1', 'pass', [], 'x'.repeat(5000)), result('c2', 'pass')]),
  );
  assert.equal(parsed.hasSchemaError, false);
  assert.ok(byId(parsed, 'c1').reason.length <= 600);
});

test('schema: a model unsure verdict has cause model_unsure', () => {
  const parsed = parse(
    body([result('c1', 'unsure', [2], 'cannot tell'), result('c2', 'pass')]),
  );
  assert.equal(byId(parsed, 'c1').verdict, 'unsure');
  assert.equal(byId(parsed, 'c1').unsureCause, 'model_unsure');
  assert.equal(byId(parsed, 'c1').reason, 'cannot tell');
});
