import {
  LAB_LIMIT_RANGES,
  MAX_SCORE,
  type Evidence,
  type JudgeResult,
  type NewConstraintVerdict,
  type NewLab,
  type NewModelCallLog,
} from '../shared/domain/index.js';

// Input checks shared by every Store implementation, so the in-memory fake
// rejects the same values the Postgres schema (CHECK, enum, FK) will reject.
// Objects must have exactly the documented fields: an unknown field such as
// `deduction` is rejected, never stored. All failures throw TypeError and
// must happen before any write.

const VERDICTS = new Set(['pass', 'violation', 'unsure']);
const SOURCES = new Set(['hard_rule', 'model']);
const UNSURE_CAUSES = new Set([
  'model_unsure',
  'schema_error',
  'evidence_mismatch',
  'timeout',
  'cost_cap',
]);
const JUDGE_VERDICTS = new Set(['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE']);

const EVIDENCE_KEYS = ['line', 'text'] as const;
const VERDICT_KEYS = [
  'submissionId',
  'constraintId',
  'verdict',
  'evidence',
  'unsureCause',
  'reason',
  'source',
] as const;

const NEW_LAB_KEYS = [
  'classId',
  'title',
  'statement',
  'deadline',
  'limits',
  'tests',
  'constraints',
  'createdBy',
] as const;

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireId(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value))
    throw new TypeError(`${field} must match ${ID_PATTERN.source}`);
}

export function requireTimestamp(
  value: unknown,
  field: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new TypeError(`${field} must be a canonical UTC ISO timestamp`);
}

export function requireText(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new TypeError(`${field} must be a nonempty string`);
}

function requireIntInRange(
  value: unknown,
  range: { min: number; max: number },
  field: string,
): void {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < range.min ||
    value > range.max
  )
    throw new TypeError(
      `${field} must be an integer in [${range.min}, ${range.max}]`,
    );
}

// Every required key must be present; besides those, only optional keys are allowed.
export function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  field: string,
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...keys, ...optional]);
  if (
    !keys.every((key) => Object.hasOwn(value, key)) ||
    !Object.keys(value).every((key) => allowed.has(key))
  )
    throw new TypeError(
      `${field} must have exactly: ${keys.join(', ')}` +
        (optional.length > 0 ? ` (optional: ${optional.join(', ')})` : ''),
    );
}

export function requirePositiveInteger(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    throw new TypeError(`${field} must be a positive integer`);
}

export function validateEvidenceList(
  value: unknown,
  field: string,
): asserts value is Evidence[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  for (const entry of value as unknown[]) {
    if (!isPlainObject(entry))
      throw new TypeError(`${field} items must be { line >= 1, text }`);
    requireExactKeys(entry, EVIDENCE_KEYS, `${field} item`);
    if (
      typeof entry.line !== 'number' ||
      !Number.isInteger(entry.line) ||
      entry.line < 1 ||
      typeof entry.text !== 'string'
    )
      throw new TypeError(`${field} items must be { line >= 1, text }`);
  }
}

// Copies only the documented fields, in a fixed key order.
export function copyEvidence(evidence: readonly Evidence[]): Evidence[] {
  return evidence.map(({ line, text }) => ({ line, text }));
}

// Compares by value, independent of key order inside each item.
export function sameEvidence(
  a: readonly Evidence[],
  b: readonly Evidence[],
): boolean {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        item.line === other.line &&
        item.text === other.text
      );
    })
  );
}

export function validateJudgeResult(
  value: unknown,
): asserts value is JudgeResult {
  if (!isPlainObject(value))
    throw new TypeError('judgeResult must be an object');
  requireExactKeys(value, ['verdict', 'tests'], 'judgeResult');
  if (!JUDGE_VERDICTS.has(value.verdict as string))
    throw new TypeError('judgeResult.verdict is not supported');
  if (!Array.isArray(value.tests))
    throw new TypeError('judgeResult.tests must be an array');
  for (const test of value.tests as unknown[]) {
    if (!isPlainObject(test))
      throw new TypeError('judgeResult.tests items must be objects');
    requireExactKeys(test, ['testId', 'verdict'], 'judgeResult.tests item');
    if (
      typeof test.testId !== 'string' ||
      test.verdict === 'CE' ||
      !JUDGE_VERDICTS.has(test.verdict as string)
    )
      throw new TypeError(
        'judgeResult.tests items must be { testId, verdict }',
      );
  }
}

export function copyJudgeResult(result: JudgeResult): JudgeResult {
  return {
    verdict: result.verdict,
    tests: result.tests.map(({ testId, verdict }) => ({ testId, verdict })),
  };
}

// Match Postgres integer storage and reject invalid provider accounting
// before either implementation writes a log.
export function validateModelCallMetrics(log: NewModelCallLog): void {
  for (const field of ['inputTokens', 'outputTokens', 'latencyMs'] as const) {
    const value = log[field];
    if (!Number.isInteger(value) || value < 0 || value > 2_147_483_647)
      throw new TypeError(`${field} must be a nonnegative 32-bit integer`);
  }
  if (!Number.isFinite(log.costUsd) || log.costUsd < 0)
    throw new TypeError('costUsd must be finite and nonnegative');
}

export function validateNewVerdict(
  value: unknown,
): asserts value is NewConstraintVerdict {
  if (!isPlainObject(value)) throw new TypeError('verdict must be an object');
  requireExactKeys(value, VERDICT_KEYS, 'verdict');
  const { verdict, evidence, unsureCause, reason, source } = value;
  if (typeof value.submissionId !== 'string')
    throw new TypeError('verdict.submissionId must be a string');
  if (typeof value.constraintId !== 'string')
    throw new TypeError('verdict.constraintId must be a string');
  if (typeof verdict !== 'string' || !VERDICTS.has(verdict))
    throw new TypeError('verdict.verdict must be pass, violation or unsure');
  validateEvidenceList(evidence, 'verdict.evidence');
  if (verdict === 'violation' && evidence.length === 0)
    throw new TypeError('A violation needs at least one evidence line');
  if (verdict === 'unsure') {
    if (typeof unsureCause !== 'string' || !UNSURE_CAUSES.has(unsureCause))
      throw new TypeError('An unsure verdict needs a supported unsureCause');
  } else if (unsureCause !== null) {
    throw new TypeError(
      'unsureCause must be null unless the verdict is unsure',
    );
  }
  if (reason !== null && typeof reason !== 'string')
    throw new TypeError('verdict.reason must be a string or null');
  if (typeof source !== 'string' || !SOURCES.has(source))
    throw new TypeError('verdict.source must be hard_rule or model');
}

export function copyNewVerdict(
  verdict: NewConstraintVerdict,
): NewConstraintVerdict {
  return {
    submissionId: verdict.submissionId,
    constraintId: verdict.constraintId,
    verdict: verdict.verdict,
    evidence: copyEvidence(verdict.evidence),
    unsureCause: verdict.unsureCause,
    reason: verdict.reason,
    source: verdict.source,
  };
}

// Lab input without id and createdAt, as passed to LabStore.createLab.
// Class and creator existence are checked by the store (foreign keys).
export function validateNewLab(value: unknown): asserts value is NewLab {
  if (!isPlainObject(value)) throw new TypeError('lab must be an object');
  requireExactKeys(value, NEW_LAB_KEYS, 'lab', ['opensAt']);
  requireId(value.classId, 'lab.classId');
  requireText(value.title, 'lab.title');
  requireText(value.statement, 'lab.statement');
  requireTimestamp(value.deadline, 'lab.deadline');
  if (value.opensAt !== undefined) {
    requireTimestamp(value.opensAt, 'lab.opensAt');
    requireOpensBeforeDeadline(value.opensAt, value.deadline);
  }
  requireId(value.createdBy, 'lab.createdBy');

  const { limits, tests, constraints } = value;
  if (!isPlainObject(limits))
    throw new TypeError('lab.limits must be an object');
  requireExactKeys(limits, ['cpuTimeMs', 'memoryMb'], 'lab.limits');
  requireIntInRange(
    limits.cpuTimeMs,
    LAB_LIMIT_RANGES.cpuTimeMs,
    'lab.limits.cpuTimeMs',
  );
  requireIntInRange(
    limits.memoryMb,
    LAB_LIMIT_RANGES.memoryMb,
    'lab.limits.memoryMb',
  );

  if (!Array.isArray(tests) || tests.length === 0)
    throw new TypeError('lab.tests must be a nonempty array');
  const testIds = new Set<string>();
  for (const test of tests as unknown[]) {
    if (!isPlainObject(test))
      throw new TypeError('lab.tests items must be objects');
    requireExactKeys(test, ['id', 'input', 'expectedOutput'], 'lab.tests item');
    requireId(test.id, 'test.id');
    if (testIds.has(test.id)) throw new TypeError('Duplicate test.id');
    testIds.add(test.id);
    if (
      typeof test.input !== 'string' ||
      typeof test.expectedOutput !== 'string'
    )
      throw new TypeError('test input and expectedOutput must be strings');
  }

  if (!Array.isArray(constraints))
    throw new TypeError('lab.constraints must be an array');
  const constraintIds = new Set<string>();
  for (const constraint of constraints as unknown[]) {
    if (!isPlainObject(constraint))
      throw new TypeError('lab.constraints items must be objects');
    requireExactKeys(
      constraint,
      ['id', 'text', 'deduction'],
      'lab.constraints item',
    );
    requireId(constraint.id, 'constraint.id');
    if (constraintIds.has(constraint.id))
      throw new TypeError('Duplicate constraint.id');
    constraintIds.add(constraint.id);
    requireText(constraint.text, 'constraint.text');
    if (
      typeof constraint.deduction !== 'number' ||
      !Number.isFinite(constraint.deduction) ||
      constraint.deduction <= 0 ||
      constraint.deduction > MAX_SCORE
    )
      throw new TypeError(`constraint.deduction must be in (0, ${MAX_SCORE}]`);
  }
}

export function copyNewLab(lab: NewLab): NewLab {
  return {
    classId: lab.classId,
    title: lab.title,
    statement: lab.statement,
    deadline: lab.deadline,
    limits: { cpuTimeMs: lab.limits.cpuTimeMs, memoryMb: lab.limits.memoryMb },
    tests: lab.tests.map(({ id, input, expectedOutput }) => ({
      id,
      input,
      expectedOutput,
    })),
    constraints: lab.constraints.map(({ id, text, deduction }) => ({
      id,
      text,
      deduction,
    })),
    createdBy: lab.createdBy,
    ...(lab.opensAt === undefined ? {} : { opensAt: lab.opensAt }),
  };
}

// A lab must open before it closes (FAQ milestones).
export function requireOpensBeforeDeadline(
  opensAt: string,
  deadline: string,
): void {
  if (Date.parse(opensAt) >= Date.parse(deadline))
    throw new TypeError('lab.opensAt must be before lab.deadline');
}
