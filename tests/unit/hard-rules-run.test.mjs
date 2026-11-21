import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkBanList,
  classifyConstraint,
  runHardRules,
} from '../../dist/pipeline/hard-rules/index.js';

const cpp = (strings) => strings.raw[0].replace(/^\n/, '');

const constraints = [
  { id: 'C1', text: 'Do not call a library sort: `std::sort`, `qsort`.' },
  { id: 'C2', text: 'Sort with a merge sort you wrote yourself.' },
  { id: 'C3', text: 'Do not use loop statements: `for`, `while`.' },
];

const violatingCode = cpp`
#include <algorithm>
int main() {
  int a[3] = {3, 1, 2};
  std::sort(a, a + 3);
  return a[0];
}
`;

// Model giả: ghi lại mọi constraint id mà backend định gửi đi. Đây là bằng chứng
// "constraint đã quyết thì model không được gọi", không cần network hay model thật.
const makeFakeModel = () => {
  const calls = [];
  return {
    calls,
    judge(constraintIds) {
      calls.push([...constraintIds]);
    },
  };
};
const reviewWithModel = (result, model) => {
  if (result.modelConstraintIds.length > 0) {
    model.judge(result.modelConstraintIds);
  }
};

test('ban-list constraints get a hard-rule verdict, semantic ones go to the model', () => {
  const result = runHardRules({ code: violatingCode, constraints });
  assert.deepEqual(result.verdicts, [
    {
      constraintId: 'C1',
      verdict: 'violation',
      source: 'hard_rule',
      evidence: [{ line: 4, text: '  std::sort(a, a + 3);' }],
    },
    {
      constraintId: 'C3',
      verdict: 'pass',
      source: 'hard_rule',
      evidence: [],
    },
  ]);
  assert.deepEqual(result.modelConstraintIds, ['C2']);
});

test('the fake model only ever receives the semantic constraint ids', () => {
  const model = makeFakeModel();
  reviewWithModel(runHardRules({ code: violatingCode, constraints }), model);
  assert.deepEqual(model.calls, [['C2']]);
});

test('a decided constraint never reaches the model, even when it passes', () => {
  const model = makeFakeModel();
  const cleanCode = 'int main() { return 0; }\n';
  const result = runHardRules({ code: cleanCode, constraints });
  reviewWithModel(result, model);
  assert.deepEqual(
    result.verdicts.map((item) => [item.constraintId, item.verdict]),
    [
      ['C1', 'pass'],
      ['C3', 'pass'],
    ],
  );
  assert.deepEqual(model.calls, [['C2']]);
});

test('when every constraint is a ban list the model is not called at all', () => {
  const model = makeFakeModel();
  const result = runHardRules({
    code: violatingCode,
    constraints: [constraints[0], constraints[2]],
  });
  reviewWithModel(result, model);
  assert.deepEqual(result.modelConstraintIds, []);
  assert.deepEqual(model.calls, []);
});

test('the decision log says which constraints the hard rules decided', () => {
  const { decisionLog } = runHardRules({ code: violatingCode, constraints });
  assert.deepEqual(decisionLog, [
    {
      constraintId: 'C1',
      route: 'hard_rule',
      kind: 'ban_list',
      names: ['std::sort', 'qsort'],
      verdict: 'violation',
      evidenceLines: [4],
      modelCalled: false,
    },
    { constraintId: 'C2', route: 'model', kind: 'semantic' },
    {
      constraintId: 'C3',
      route: 'hard_rule',
      kind: 'ban_list',
      names: ['for', 'while'],
      verdict: 'pass',
      evidenceLines: [],
      modelCalled: false,
    },
  ]);
});

test('every id is either decided by a hard rule or handed to the model, never both', () => {
  const result = runHardRules({ code: violatingCode, constraints });
  const decided = result.verdicts.map((item) => item.constraintId);
  for (const id of result.modelConstraintIds) {
    assert.ok(
      !decided.includes(id),
      `${id} is both decided and sent to the model`,
    );
  }
  assert.deepEqual(
    [...decided, ...result.modelConstraintIds].sort(),
    constraints.map((item) => item.id).sort(),
  );
});

test('a "Do not use" constraint with no usable name is left to the model', () => {
  const result = runHardRules({
    code: violatingCode,
    constraints: [{ id: 'X1', text: 'Do not use recursion.' }],
  });
  assert.deepEqual(result.verdicts, []);
  assert.deepEqual(result.modelConstraintIds, ['X1']);
});

test('verdicts and evidence match classifyConstraint plus checkBanList', () => {
  const direct = classifyConstraint(constraints[0].text);
  assert.equal(direct.kind, 'ban_list');
  const expected = checkBanList(violatingCode, direct.names);
  const result = runHardRules({ code: violatingCode, constraints });
  assert.equal(result.verdicts[0].verdict, expected.verdict);
  assert.deepEqual(result.verdicts[0].evidence, expected.evidence);
});

test('runHardRules is deterministic and keeps the order of the constraints', () => {
  const reordered = [constraints[2], constraints[1], constraints[0]];
  const first = runHardRules({ code: violatingCode, constraints: reordered });
  const second = runHardRules({ code: violatingCode, constraints: reordered });
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.verdicts.map((item) => item.constraintId),
    ['C3', 'C1'],
  );
  assert.deepEqual(
    first.decisionLog.map((item) => item.constraintId),
    ['C3', 'C2', 'C1'],
  );
});

test('no constraints give an empty result', () => {
  assert.deepEqual(runHardRules({ code: violatingCode, constraints: [] }), {
    verdicts: [],
    modelConstraintIds: [],
    decisionLog: [],
  });
});
