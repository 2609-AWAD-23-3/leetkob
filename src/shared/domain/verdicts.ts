export type VerdictValue = 'pass' | 'violation' | 'unsure';
export type TaDecision = 'pass' | 'violation';
export type VerdictSource = 'hard_rule' | 'model';

// FAQ-09: the TA sees why a verdict is unsure.
export type UnsureCause =
  | 'model_unsure'
  | 'schema_error'
  | 'evidence_mismatch'
  | 'timeout'
  | 'cost_cap';

export interface Evidence {
  line: number; // 1-based line in the student's original code
  text: string;
}

export interface ConstraintVerdict {
  submissionId: string;
  constraintId: string;
  verdict: VerdictValue;
  evidence: Evidence[];
  unsureCause: UnsureCause | null; // required when verdict is 'unsure'
  reason: string | null; // explanation from the model or hard rule, if any
  source: VerdictSource;
  createdAt: string;
}

export type NewConstraintVerdict = Omit<ConstraintVerdict, 'createdAt'>;

// One review item per (counted submission, constraint) pair (FAQ-10).
export interface ReviewItem extends ConstraintVerdict {
  id: string;
  labId: string;
  studentId: string;
  constraintText: string;
  deduction: number;
  taDecision: TaDecision | null; // null = not reviewed yet
  taEvidence: Evidence[]; // lines the TA pointed at; the API requires them for violation (FAQ-09, PA03-T09)
  reviewedBy: string | null;
  reviewedAt: string | null;
}

// Every change of a TA decision, its evidence or its reviewer is logged (FAQ-10).
export interface ReviewDecisionLog {
  itemId: string;
  changedBy: string;
  changedAt: string;
  previous: TaDecision | null;
  next: TaDecision;
  evidence: Evidence[]; // TA evidence after the change
}

export type ModelCallOutcome =
  'ok' | 'schema_error' | 'timeout' | 'provider_error';

export interface ModelCallLog {
  id: string;
  submissionId: string;
  constraintIds: string[];
  provider: string;
  model: string;
  requestId: string | null; // provider request id; a real run must have one
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  outcome: ModelCallOutcome;
  createdAt: string;
}

export type NewModelCallLog = Omit<ModelCallLog, 'id' | 'createdAt'>;
