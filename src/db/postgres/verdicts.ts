import type {
  ConstraintVerdict,
  ModelCallLog,
} from '../../shared/domain/index.js';
import type { VerdictStore } from '../verdict-store.js';
import { validateModelCallMetrics } from '../validation.js';
import { isoRequired, type PostgresContext } from './client.js';

export interface VerdictRow {
  id: string;
  submission_id: string;
  constraint_id: string;
  verdict: ConstraintVerdict['verdict'];
  evidence: ConstraintVerdict['evidence'];
  unsure_cause: ConstraintVerdict['unsureCause'];
  reason: string | null;
  source: ConstraintVerdict['source'];
  created_at: Date;
  ta_decision: 'pass' | 'violation' | null;
  ta_evidence: ConstraintVerdict['evidence'];
  reviewed_by: string | null;
  reviewed_at: Date | null;
}

export function toVerdict(row: VerdictRow): ConstraintVerdict {
  return {
    submissionId: row.submission_id,
    constraintId: row.constraint_id,
    verdict: row.verdict,
    evidence: row.evidence,
    unsureCause: row.unsure_cause,
    reason: row.reason,
    source: row.source,
    createdAt: isoRequired(row.created_at),
  };
}

function toModelCall(row: Record<string, unknown>): ModelCallLog {
  return {
    id: row.id as string,
    submissionId: row.submission_id as string,
    constraintIds: row.constraint_ids as string[],
    provider: row.provider as string,
    model: row.model as string,
    requestId: row.request_id as string | null,
    inputTokens: row.input_tokens as number,
    outputTokens: row.output_tokens as number,
    latencyMs: row.latency_ms as number,
    costUsd: row.cost_usd as number,
    outcome: row.outcome as ModelCallLog['outcome'],
    createdAt: isoRequired(row.created_at as Date),
  };
}

export function createVerdictStore(ctx: PostgresContext): VerdictStore {
  const { pool } = ctx;
  return {
    async listVerdicts(submissionId) {
      await ctx.ready;
      const { rows } = await pool.query<VerdictRow>(
        'SELECT * FROM verdicts WHERE submission_id = $1 ORDER BY seq',
        [submissionId],
      );
      return rows.map(toVerdict);
    },

    async recordModelCall(log) {
      await ctx.ready;
      validateModelCallMetrics(log);
      const exists = await pool.query(
        'SELECT 1 FROM submissions WHERE id = $1',
        [log.submissionId],
      );
      if (!exists.rowCount)
        throw new TypeError('Model call refers to an unknown submission');
      const { rows } = await pool.query(
        `INSERT INTO model_calls (id, submission_id, constraint_ids, provider,
           model, request_id, input_tokens, output_tokens, latency_ms, cost_usd,
           outcome, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          ctx.newId(),
          log.submissionId,
          JSON.stringify(log.constraintIds),
          log.provider,
          log.model,
          log.requestId,
          log.inputTokens,
          log.outputTokens,
          log.latencyMs,
          log.costUsd,
          log.outcome,
          ctx.now(),
        ],
      );
      return toModelCall(rows[0]);
    },

    async listModelCalls(submissionId) {
      await ctx.ready;
      const { rows } = await pool.query(
        'SELECT * FROM model_calls WHERE submission_id = $1 ORDER BY seq',
        [submissionId],
      );
      return rows.map(toModelCall);
    },
  };
}
