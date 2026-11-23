// Chuẩn hoá danh tính cần che khỏi prompt (PA03-T10, B3). Mọi hình dạng không rõ ràng đều bị
// từ chối (fail-closed), để tên thật không bao giờ lọt vào model vì một giá trị sai kiểu.
import { ModelConfigError } from './errors.js';
import { hasUsableIdentity } from './sanitize.js';
import type { PromptIdentity, PromptIdentityLabel } from './types.js';

/**
 * Checker chạy trên dataset (dev set, eval-cases, held-out): không có sinh viên nào nên không
 * có gì để che. Worker không bao giờ dùng hằng này; nó lấy danh tính sinh viên từ DB.
 */
export const NO_STUDENT_IDENTITY_DATASET: PromptIdentity = Object.freeze({
  kind: 'none',
  reason: 'dataset',
} as const);

export interface ResolvedIdentity {
  /** Chuỗi cần thay bằng placeholder; rỗng khi không có sinh viên. */
  readonly parts: readonly string[];
  readonly label: PromptIdentityLabel;
}

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const hasExactKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    [...keys].sort().every((key, i) => key === actual[i])
  );
};

const reject = (detail: string): never => {
  throw new ModelConfigError(
    `getIdentity returned ${detail}; refusing to build a prompt that cannot hide who wrote the code`,
  );
};

const studentParts = (parts: readonly string[]): ResolvedIdentity => {
  if (!hasUsableIdentity(parts)) {
    reject(
      'no usable student identity (an empty list or only strings shorter than the minimum length)',
    );
  }
  return { parts, label: 'student' };
};

/** Đổi giá trị của `getIdentity` thành danh sách cần che và nhãn ghi vào PromptRecord. */
export const resolvePromptIdentity = (value: unknown): ResolvedIdentity => {
  if (isStringList(value)) return studentParts(value);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return reject('a value that is neither a string list nor a PromptIdentity');
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate['kind'] === 'student' &&
    hasExactKeys(value, ['kind', 'parts'])
  ) {
    if (!isStringList(candidate['parts'])) {
      return reject('a student identity whose parts are not strings');
    }
    return studentParts(candidate['parts']);
  }
  if (
    candidate['kind'] === 'none' &&
    candidate['reason'] === 'dataset' &&
    hasExactKeys(value, ['kind', 'reason'])
  ) {
    return { parts: [], label: 'none:dataset' };
  }
  return reject('an unsupported identity shape');
};
