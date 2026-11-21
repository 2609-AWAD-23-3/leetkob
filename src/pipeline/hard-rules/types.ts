// Kiểu kết quả của hard rules. Hình dạng khớp kiểu dùng chung của T03
// (`Evidence` = { line, text }, verdict `pass` | `violation`). PR T03 chưa merge nên
// định nghĩa cục bộ ở đây để không phụ thuộc file của task khác; nối lại sau khi T03 merge.

/** Một dòng chứng cứ: `line` đánh từ 1, `text` là nguyên dòng gốc của file nguồn. */
export interface Evidence {
  line: number;
  text: string;
}

export type HardRuleVerdictValue = 'pass' | 'violation';

/** Kết quả phân loại text ràng buộc. */
export type ConstraintClass =
  { kind: 'ban_list'; names: string[] } | { kind: 'semantic' };

export interface BanListResult {
  verdict: HardRuleVerdictValue;
  evidence: Evidence[];
}

export interface HardRuleConstraint {
  id: string;
  text: string;
}

export interface HardRuleVerdict {
  constraintId: string;
  verdict: HardRuleVerdictValue;
  source: 'hard_rule';
  evidence: Evidence[];
}

/**
 * Bản ghi quyết định cho từng constraint. T08 và T11 đưa bản ghi này vào call log:
 * `route: 'hard_rule'` nghĩa là hard rule đã quyết và model KHÔNG được gọi cho constraint đó.
 */
export type DecisionLogEntry =
  | {
      constraintId: string;
      route: 'hard_rule';
      kind: 'ban_list';
      names: string[];
      verdict: HardRuleVerdictValue;
      evidenceLines: number[];
      modelCalled: false;
    }
  | { constraintId: string; route: 'model'; kind: 'semantic' };

export interface HardRulesInput {
  code: string;
  constraints: readonly HardRuleConstraint[];
}

export interface HardRulesResult {
  /** Các verdict đã quyết, theo thứ tự constraint đầu vào. */
  verdicts: HardRuleVerdict[];
  /** Constraint semantic còn lại, chuyển cho T08. */
  modelConstraintIds: string[];
  /** Mỗi constraint đầu vào đúng một bản ghi. */
  decisionLog: DecisionLogEntry[];
}
