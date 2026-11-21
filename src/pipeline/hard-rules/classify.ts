import type { ConstraintClass } from './types.js';

// Quy tắc đề bài: ràng buộc có text bắt đầu bằng "Do not use" hoặc "Do not call"
// là ban list, mọi tên bị cấm nằm trong backticks. Ràng buộc khác là semantic.
const BAN_PREFIX = /^do not (?:use|call)(?![A-Za-z0-9_])/i;
const BACKTICK_SPAN = /`([^`\n]+)`/g;
const NAME = /^(?:::)?[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*$/;

/** Chuẩn hóa một đoạn trong backticks thành 0, 1 hoặc 2 tên. */
const namesFromSpan = (raw: string): string[] => {
  const span = raw.trim();
  // `do-while` viết trong một cặp backticks → hai từ khóa.
  if (/^do\s*-\s*while$/i.test(span)) return ['do', 'while'];
  // "range-based for" chính là từ khóa `for`.
  if (/^range-based\s+for$/i.test(span)) return ['for'];
  if (!NAME.test(span)) return [];
  return [span.startsWith('::') ? span.slice(2) : span];
};

export const classifyConstraint = (text: string): ConstraintClass => {
  const trimmed = text.trim();
  if (!BAN_PREFIX.test(trimmed)) return { kind: 'semantic' };
  const names: string[] = [];
  for (const match of trimmed.matchAll(BACKTICK_SPAN)) {
    for (const name of namesFromSpan(match[1] ?? '')) {
      if (!names.includes(name)) names.push(name);
    }
  }
  // Không rút được tên hợp lệ nào thì không có gì để quyết bằng code: để cho model.
  return names.length > 0 ? { kind: 'ban_list', names } : { kind: 'semantic' };
};
