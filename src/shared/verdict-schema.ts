import type { Evidence, VerdictValue } from './domain/index.js';

// JSON Schema for the model's structured output (PA03-T08).
// It has no deduction field: deductions always come from the TA's constraint
// (FAQ-11), and additionalProperties: false rejects any extra field.
export const MODEL_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['constraintId', 'verdict', 'evidence', 'reason'],
        properties: {
          constraintId: { type: 'string' },
          verdict: { type: 'string', enum: ['pass', 'violation', 'unsure'] },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['line', 'text'],
              properties: {
                line: { type: 'integer', minimum: 1 },
                text: { type: 'string' },
              },
            },
          },
          reason: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export interface ModelVerdictItem {
  constraintId: string;
  verdict: VerdictValue;
  // Lines refer to the code the model saw (comments stripped); T08 maps them
  // back to the original code and checks the text before storing.
  evidence: Evidence[];
  reason: string | null;
}

export type ParseModelVerdictsResult =
  { ok: true; verdicts: ModelVerdictItem[] } | { ok: false; error: string };

const VERDICTS = new Set<string>(['pass', 'violation', 'unsure']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function parseEvidence(value: unknown): Evidence | string {
  if (!isPlainObject(value) || !hasExactKeys(value, ['line', 'text']))
    return 'evidence item must have exactly line and text';
  const { line, text } = value;
  if (typeof line !== 'number' || !Number.isInteger(line) || line < 1)
    return 'evidence line must be an integer >= 1';
  if (typeof text !== 'string') return 'evidence text must be a string';
  return { line, text };
}

// Validates model output against MODEL_VERDICT_SCHEMA plus the rules the schema
// cannot express: one verdict per requested constraint, no unknown constraints,
// and at least one evidence line for a violation. Any failure means the caller
// records 'unsure' with cause 'schema_error' (FAQ-09).
export function parseModelVerdicts(
  value: unknown,
  constraintIds: readonly string[],
): ParseModelVerdictsResult {
  const fail = (error: string): ParseModelVerdictsResult => ({
    ok: false,
    error,
  });
  if (!isPlainObject(value) || !hasExactKeys(value, ['verdicts']))
    return fail('output must be an object with exactly one field: verdicts');
  if (!Array.isArray(value.verdicts)) return fail('verdicts must be an array');

  const expected = new Set(constraintIds);
  const seen = new Set<string>();
  const verdicts: ModelVerdictItem[] = [];
  for (const item of value.verdicts as unknown[]) {
    if (
      !isPlainObject(item) ||
      !hasExactKeys(item, ['constraintId', 'verdict', 'evidence', 'reason'])
    )
      return fail(
        'each verdict must have exactly constraintId, verdict, evidence and reason',
      );
    const { constraintId, verdict, evidence, reason } = item;
    if (typeof constraintId !== 'string' || !expected.has(constraintId))
      return fail('verdict refers to an unknown constraint');
    if (seen.has(constraintId))
      return fail('duplicate verdict for a constraint');
    seen.add(constraintId);
    if (typeof verdict !== 'string' || !VERDICTS.has(verdict))
      return fail('verdict must be pass, violation or unsure');
    if (!Array.isArray(evidence)) return fail('evidence must be an array');
    const parsedEvidence: Evidence[] = [];
    for (const entry of evidence as unknown[]) {
      const parsed = parseEvidence(entry);
      if (typeof parsed === 'string') return fail(parsed);
      parsedEvidence.push(parsed);
    }
    if (reason !== null && typeof reason !== 'string')
      return fail('reason must be a string or null');
    if (verdict === 'violation' && parsedEvidence.length === 0)
      return fail('a violation needs at least one evidence line');
    verdicts.push({
      constraintId,
      verdict: verdict as VerdictValue,
      evidence: parsedEvidence,
      reason,
    });
  }
  if (seen.size !== expected.size)
    return fail('every requested constraint needs exactly one verdict');
  return { ok: true, verdicts };
}
