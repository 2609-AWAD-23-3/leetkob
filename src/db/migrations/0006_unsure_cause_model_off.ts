import type { Migration } from './types.js';

// PA03-T10: `model_off` marks a semantic constraint that was not sent to the
// model because the model was switched off (MODEL_OFF=1). Mirrors
// UNSURE_CAUSES in src/db/validation.ts.
export const migration0006: Migration = {
  id: '0006_unsure_cause_model_off',
  sql: `
ALTER TABLE verdicts DROP CONSTRAINT verdicts_unsure_cause_check;
ALTER TABLE verdicts ADD CONSTRAINT verdicts_unsure_cause_check
  CHECK (unsure_cause IN
    ('model_unsure', 'schema_error', 'evidence_mismatch', 'timeout', 'cost_cap', 'model_off'));
`,
};
