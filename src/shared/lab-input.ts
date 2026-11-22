export const LAB_INPUT_LIMITS = {
  requestBytes: 20 * 1024 * 1024,
  titleCodePoints: 200,
  statementBytes: 256 * 1024,
  tests: 100,
  testPartBytes: 1024 * 1024,
  totalTestBytes: 16 * 1024 * 1024,
  constraints: 50,
  constraintBytes: 4 * 1024,
} as const;

export class LabSizeError extends TypeError {}

export function requireLabText(
  value: unknown,
  field: string,
  maxBytes: number,
  allowEmpty = false,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value.isWellFormed() ||
    value.includes('\u0000') ||
    (!allowEmpty && value.trim().length === 0)
  )
    throw new TypeError(`${field} must be valid Unicode text without NUL`);
  if (Buffer.byteLength(value, 'utf8') > maxBytes)
    throw new LabSizeError(`${field} exceeds its byte limit`);
}
