import { createInMemoryStore } from '../../dist/db/index.js';
import { defineLabConformance } from '../support/lab-conformance.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNewLab } from '../../dist/db/validation.js';
import { newLab } from '../support/labs.mjs';
defineLabConformance('fake labs', createInMemoryStore);

test('lab validation: Unicode and byte/count boundaries use decoded data', () => {
  const mb = 'x'.repeat(1024 * 1024);
  const tests = Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`,
    input: mb,
    expectedOutput: mb,
  }));
  const valid = newLab({
    title: '😀'.repeat(200),
    statement: 'é'.repeat(128 * 1024),
    tests,
    constraints: Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      text: 'é'.repeat(2048),
      deduction: 10,
    })),
  });
  assert.doesNotThrow(() => validateNewLab(valid));
  assert.throws(() => validateNewLab({ ...valid, title: valid.title + 'x' }));
  assert.throws(() =>
    validateNewLab({ ...valid, statement: valid.statement + 'x' }),
  );
  assert.throws(() =>
    validateNewLab({
      ...valid,
      tests: [...tests, { id: 'extra', input: 'x', expectedOutput: '' }],
    }),
  );
  assert.throws(() =>
    validateNewLab({
      ...valid,
      tests: [{ id: 't1', input: mb + 'x', expectedOutput: '' }],
    }),
  );
  assert.throws(() =>
    validateNewLab({
      ...valid,
      constraints: [{ id: 'c1', text: 'x'.repeat(4097), deduction: 1 }],
    }),
  );
  assert.throws(() =>
    validateNewLab({
      ...valid,
      constraints: [
        ...valid.constraints,
        { id: 'extra', text: 'x', deduction: 1 },
      ],
    }),
  );
  const hundred = Array.from({ length: 100 }, (_, i) => ({
    id: `t${i}`,
    input: '',
    expectedOutput: '',
  }));
  assert.doesNotThrow(() => validateNewLab(newLab({ tests: hundred })));
  assert.throws(() =>
    validateNewLab(
      newLab({
        tests: [...hundred, { id: 'extra', input: '', expectedOutput: '' }],
      }),
    ),
  );
  for (const text of ['\u0000', '\ud800', '   \n']) {
    assert.throws(() => validateNewLab(newLab({ statement: text })));
    assert.throws(() =>
      validateNewLab(
        newLab({ constraints: [{ id: 'c1', text, deduction: 1 }] }),
      ),
    );
  }
});
