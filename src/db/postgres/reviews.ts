import type {
  Evidence,
  ReviewDecisionLog,
  ReviewItem,
  TaDecision,
} from '../../shared/domain/index.js';
import type { PublicationStore } from '../publication-store.js';
import type { ReviewStore } from '../review-store.js';
import type { Publication, ReviewState } from '../types.js';
import {
  copyEvidence,
  requireId,
  sameEvidence,
  validateEvidenceList,
} from '../validation.js';
import {
  iso,
  isoRequired,
  transaction,
  type PostgresContext,
  type Queryable,
} from './client.js';
import { COUNTED_SUBMISSIONS_SQL } from './submissions.js';
import type { VerdictRow } from './verdicts.js';

interface QueueRow extends VerdictRow {
  lab_id: string;
  student_id: string;
  constraint_text: string;
  deduction: number;
}

// Verdicts of the counted, Accepted submissions of a lab, in submission then
// constraint order. $1 is the lab id; extra conditions go into `filter`.
function queueSql(filter = ''): string {
  return `
    SELECT v.*, s.lab_id, s.student_id, c.text AS constraint_text, c.deduction
    FROM (${COUNTED_SUBMISSIONS_SQL}) s
    JOIN lab_constraints c ON c.lab_id = s.lab_id
    JOIN verdicts v ON v.submission_id = s.id AND v.constraint_id = c.id
    WHERE s.status = 'judged' AND s.judge_result->>'verdict' = 'AC' ${filter}
    ORDER BY s.seq, c.position`;
}

function toReviewItem(row: QueueRow): ReviewItem {
  return {
    id: row.id,
    labId: row.lab_id,
    studentId: row.student_id,
    submissionId: row.submission_id,
    constraintId: row.constraint_id,
    constraintText: row.constraint_text,
    deduction: row.deduction,
    verdict: row.verdict,
    evidence: row.evidence,
    unsureCause: row.unsure_cause,
    reason: row.reason,
    source: row.source,
    createdAt: isoRequired(row.created_at),
    taDecision: row.ta_decision,
    taEvidence: row.ta_evidence,
    reviewedBy: row.reviewed_by,
    reviewedAt: iso(row.reviewed_at),
  };
}

async function labOfItem(
  db: Queryable,
  itemId: string,
): Promise<string | undefined> {
  const { rows } = await db.query<{ lab_id: string }>(
    `SELECT s.lab_id FROM verdicts v JOIN submissions s ON s.id = v.submission_id
     WHERE v.id = $1`,
    [itemId],
  );
  return rows[0]?.lab_id;
}

async function findQueueItem(
  db: Queryable,
  itemId: string,
  lock = false,
): Promise<QueueRow | undefined> {
  const labId = await labOfItem(db, itemId);
  if (labId === undefined) return undefined;
  const { rows } = await db.query<QueueRow>(
    queueSql('AND v.id = $2') + (lock ? ' FOR UPDATE OF v' : ''),
    [labId, itemId],
  );
  return rows[0];
}

// Review changes and publishLab all lock the lab row first, so a review can
// never commit after Publish has read the decisions (or the other way round).
async function lockLab(db: Queryable, labId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'SELECT 1 FROM labs WHERE id = $1 FOR UPDATE',
    [labId],
  );
  return rowCount === 1;
}

async function isPublished(db: Queryable, labId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'SELECT 1 FROM publications WHERE lab_id = $1',
    [labId],
  );
  return rowCount === 1;
}

async function requireReviewer(db: Queryable, taId: string): Promise<void> {
  requireId(taId, 'taId');
  const { rowCount } = await db.query('SELECT 1 FROM users WHERE id = $1', [
    taId,
  ]);
  if (!rowCount) throw new TypeError('Unknown reviewer');
}

async function applyDecision(
  db: Queryable,
  ctx: PostgresContext,
  item: QueueRow,
  decision: TaDecision,
  taId: string,
  evidence: Evidence[],
): Promise<void> {
  if (
    item.ta_decision === decision &&
    item.reviewed_by === taId &&
    sameEvidence(item.ta_evidence, evidence)
  )
    return; // identical repeat: nothing changes, nothing is logged
  const changedAt = ctx.now();
  const stored = JSON.stringify(copyEvidence(evidence));
  await db.query(
    `INSERT INTO review_decisions (item_id, changed_by, changed_at, previous, next, evidence)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [item.id, taId, changedAt, item.ta_decision, decision, stored],
  );
  await db.query(
    `UPDATE verdicts SET ta_decision = $2, ta_evidence = $3, reviewed_by = $4,
       reviewed_at = $5 WHERE id = $1`,
    [item.id, decision, stored, taId, changedAt],
  );
}

export async function reviewState(
  db: Queryable,
  labId: string,
): Promise<ReviewState | undefined> {
  // One statement gives every count the same snapshot, even when a worker
  // commits complete() while Publish is checking the pending gate.
  const { rows } = await db.query<{
    queue_item_count: number;
    pass_decision_count: number;
    violation_decision_count: number;
    pending_count: number;
  }>(
    `WITH counted AS (${COUNTED_SUBMISSIONS_SQL}),
     items AS (
       SELECT v.ta_decision FROM counted s
       JOIN lab_constraints c ON c.lab_id = s.lab_id
       JOIN verdicts v ON v.submission_id = s.id AND v.constraint_id = c.id
       WHERE s.status = 'judged' AND s.judge_result->>'verdict' = 'AC'
     ), summary AS (
       SELECT count(*)::int AS queue_item_count,
         count(*) FILTER (WHERE ta_decision = 'pass')::int AS pass_decision_count,
         count(*) FILTER (WHERE ta_decision = 'violation')::int AS violation_decision_count,
         count(*) FILTER (WHERE ta_decision IS NULL)::int AS pending_reviews
       FROM items
     ), unfinished AS (
       SELECT (SELECT count(*) FROM counted WHERE status <> 'judged')
     + (SELECT count(*) FROM counted s
          JOIN lab_constraints c ON c.lab_id = s.lab_id
          LEFT JOIN verdicts v ON v.submission_id = s.id AND v.constraint_id = c.id
        WHERE s.status = 'judged' AND s.judge_result->>'verdict' = 'AC'
          AND v.id IS NULL) AS n
     )
     SELECT summary.queue_item_count, summary.pass_decision_count,
       summary.violation_decision_count,
       (summary.pending_reviews + unfinished.n)::int AS pending_count
     FROM labs CROSS JOIN summary CROSS JOIN unfinished
     WHERE labs.id = $1`,
    [labId],
  );
  const state = rows[0];
  if (!state) return undefined;
  return {
    queueItemCount: state.queue_item_count,
    passDecisionCount: state.pass_decision_count,
    violationDecisionCount: state.violation_decision_count,
    pendingCount: state.pending_count,
  };
}

function toPublication(row: Record<string, unknown>): Publication {
  return {
    labId: row.lab_id as string,
    publishedAt: isoRequired(row.published_at as Date),
    publishedBy: row.published_by as string,
    summary: {
      queueItemCount: row.queue_item_count as number,
      passDecisionCount: row.pass_decision_count as number,
      violationDecisionCount: row.violation_decision_count as number,
    },
  };
}

export function createReviewStore(
  ctx: PostgresContext,
): ReviewStore & PublicationStore {
  const { pool } = ctx;
  return {
    async listReviewQueue(labId) {
      await ctx.ready;
      const { rows } = await pool.query<QueueRow>(queueSql(), [labId]);
      return rows.map(toReviewItem);
    },

    async getReviewItem(itemId) {
      await ctx.ready;
      const row = await findQueueItem(pool, itemId);
      return row ? toReviewItem(row) : undefined;
    },

    async getReviewState(labId) {
      await ctx.ready;
      return reviewState(pool, labId);
    },

    async decide({ itemId, decision, taId, evidence }) {
      await ctx.ready;
      return transaction(pool, async (client) => {
        await requireReviewer(client, taId);
        if (decision !== 'pass' && decision !== 'violation')
          throw new TypeError('decision must be pass or violation');
        if (evidence !== undefined) validateEvidenceList(evidence, 'evidence');
        const labId = await labOfItem(client, itemId);
        if (labId === undefined || !(await lockLab(client, labId)))
          return undefined;
        const item = await findQueueItem(client, itemId, true);
        if (!item || (await isPublished(client, item.lab_id))) return undefined;
        await applyDecision(client, ctx, item, decision, taId, evidence ?? []);
        const updated = await findQueueItem(client, itemId);
        return updated ? toReviewItem(updated) : undefined;
      });
    },

    async confirmPasses({ labId, taId }) {
      await ctx.ready;
      return transaction(pool, async (client) => {
        await requireReviewer(client, taId);
        if (!(await lockLab(client, labId))) return 0;
        if (await isPublished(client, labId)) return 0;
        const { rows } = await client.query<QueueRow>(
          queueSql("AND v.verdict = 'pass' AND v.ta_decision IS NULL") +
            ' FOR UPDATE OF v',
          [labId],
        );
        for (const item of rows)
          await applyDecision(client, ctx, item, 'pass', taId, []);
        return rows.length;
      });
    },

    async listDecisionLog(itemId) {
      await ctx.ready;
      const { rows } = await pool.query(
        'SELECT * FROM review_decisions WHERE item_id = $1 ORDER BY seq',
        [itemId],
      );
      return rows.map((row): ReviewDecisionLog => ({
        itemId: row.item_id,
        changedBy: row.changed_by,
        changedAt: isoRequired(row.changed_at),
        previous: row.previous,
        next: row.next,
        evidence: row.evidence,
      }));
    },

    async isTaAssignedToClass(taId, classId) {
      await ctx.ready;
      const { rowCount } = await pool.query(
        `SELECT 1 FROM class_memberships
         WHERE user_id = $1 AND class_id = $2 AND role = 'TA'`,
        [taId, classId],
      );
      return rowCount === 1;
    },

    async getPublication(labId) {
      await ctx.ready;
      const { rows } = await pool.query(
        'SELECT * FROM publications WHERE lab_id = $1',
        [labId],
      );
      return rows[0] ? toPublication(rows[0]) : undefined;
    },

    async publishLab({ labId, publishedBy }) {
      await ctx.ready;
      return transaction(pool, async (client) => {
        // Locking the lab row serialises publish with other publish calls
        // and with review changes (decide, confirmPasses).
        const lab = await client.query<{ deadline: Date }>(
          'SELECT deadline FROM labs WHERE id = $1 FOR UPDATE',
          [labId],
        );
        const deadline = lab.rows[0]?.deadline;
        if (!deadline) return { kind: 'lab_not_found' };
        const existing = await client.query(
          'SELECT * FROM publications WHERE lab_id = $1',
          [labId],
        );
        if (existing.rows[0])
          return {
            kind: 'already_published',
            publication: toPublication(existing.rows[0]),
          };
        await requireReviewer(client, publishedBy);
        const now = ctx.now(); // the clock is read once per new publication
        if (Date.parse(now) < deadline.getTime())
          return { kind: 'before_deadline', deadline: isoRequired(deadline) };
        const state = await reviewState(client, labId);
        if (!state) return { kind: 'lab_not_found' };
        if (state.pendingCount > 0)
          return { kind: 'pending_reviews', pendingCount: state.pendingCount };
        const { rows } = await client.query(
          `INSERT INTO publications (lab_id, published_at, published_by,
             queue_item_count, pass_decision_count, violation_decision_count)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            labId,
            now,
            publishedBy,
            state.queueItemCount,
            state.passDecisionCount,
            state.violationDecisionCount,
          ],
        );
        return { kind: 'published', publication: toPublication(rows[0]) };
      });
    },
  };
}
