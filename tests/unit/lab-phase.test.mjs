import assert from 'node:assert/strict';
import test from 'node:test';
import { labPhase } from '../../dist/shared/domain/index.js';

const lab = {
  opensAt: '2026-11-02T00:00:00.000Z',
  deadline: '2026-11-09T15:00:00.000Z',
};
const at = (iso) => labPhase(lab, new Date(iso));

test('a lab is a draft before opensAt', () => {
  assert.equal(at('2026-11-01T23:59:59.999Z'), 'draft');
});

test('a lab is open from opensAt until just before the deadline', () => {
  assert.equal(at('2026-11-02T00:00:00.000Z'), 'open');
  assert.equal(at('2026-11-09T14:59:59.999Z'), 'open');
});

test('a lab is closed from the deadline on', () => {
  assert.equal(at('2026-11-09T15:00:00.000Z'), 'closed');
  assert.equal(at('2026-12-01T00:00:00.000Z'), 'closed');
});
