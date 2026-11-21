import { checkBanList } from './ban-list.js';
import { classifyConstraint } from './classify.js';
import type {
  DecisionLogEntry,
  HardRulesInput,
  HardRulesResult,
  HardRuleVerdict,
} from './types.js';

/**
 * Chạy hard rules cho mọi constraint. Ban list được quyết ngay tại đây (`source: 'hard_rule'`);
 * constraint semantic được trả trong `modelConstraintIds` để T08 gọi model. Một constraint
 * hoặc nằm trong `verdicts` hoặc nằm trong `modelConstraintIds`, không bao giờ cả hai.
 */
export const runHardRules = ({
  code,
  constraints,
}: HardRulesInput): HardRulesResult => {
  const verdicts: HardRuleVerdict[] = [];
  const modelConstraintIds: string[] = [];
  const decisionLog: DecisionLogEntry[] = [];

  for (const constraint of constraints) {
    const classification = classifyConstraint(constraint.text);
    if (classification.kind === 'semantic') {
      modelConstraintIds.push(constraint.id);
      decisionLog.push({
        constraintId: constraint.id,
        route: 'model',
        kind: 'semantic',
      });
      continue;
    }
    const result = checkBanList(code, classification.names);
    verdicts.push({
      constraintId: constraint.id,
      verdict: result.verdict,
      source: 'hard_rule',
      evidence: result.evidence,
    });
    decisionLog.push({
      constraintId: constraint.id,
      route: 'hard_rule',
      kind: 'ban_list',
      names: classification.names,
      verdict: result.verdict,
      evidenceLines: result.evidence.map((item) => item.line),
      modelCalled: false,
    });
  }
  return { verdicts, modelConstraintIds, decisionLog };
};
