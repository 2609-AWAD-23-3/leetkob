import type {
  ConstraintVerdict,
  ModelCallLog,
  NewModelCallLog,
} from '../shared/domain/index.js';

// Used by PA03-T08 and PA03-T11. Verdicts are written through JobQueue.complete.
export interface VerdictStore {
  listVerdicts(submissionId: string): Promise<ConstraintVerdict[]>;
  recordModelCall(log: NewModelCallLog): Promise<ModelCallLog>;
  listModelCalls(submissionId: string): Promise<ModelCallLog[]>;
}
