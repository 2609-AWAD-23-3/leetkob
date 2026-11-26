import type { Lab } from '../../shared/domain/index.js';
import type { LabStore } from '../lab-store.js';
import {
  copyNewLab,
  requireOpensBeforeDeadline,
  validateNewLab,
} from '../validation.js';
import { clone, type Context } from './state.js';
import {
  normalizeLabKey,
  normalizeNewLab,
  labFingerprint,
  summarizeLab,
  compareLabSummaries,
  LAB_CREATION_TTL_MS,
} from '../lab-creation.js';

export function createLabStore(ctx: Context): LabStore {
  const build = (
    input: Parameters<LabStore['createLab']>[0],
    createdAt = ctx.now(),
  ): Lab => {
    validateNewLab(input);
    if (!ctx.state.classes.has(input.classId))
      throw new TypeError('lab.classId is unknown');
    if (!ctx.state.users.has(input.createdBy))
      throw new TypeError('lab.createdBy is unknown');
    const opensAt = input.opensAt ?? createdAt;
    requireOpensBeforeDeadline(opensAt, input.deadline);
    const lab: Lab = {
      id: ctx.newId(),
      ...copyNewLab(input),
      opensAt,
      createdAt,
    };
    if (ctx.state.labs.has(lab.id))
      throw new Error('Duplicate generated lab ID');
    return lab;
  };
  return {
    async getLabSummary(labId) {
      const lab = ctx.state.labs.get(labId);
      return lab ? summarizeLab(lab) : undefined;
    },
    async createLabIdempotently(value, key) {
      const input = normalizeNewLab(value);
      const scope = JSON.stringify([
        input.createdBy,
        input.classId,
        normalizeLabKey(key),
      ]);
      const fingerprint = labFingerprint(input);
      const now = ctx.nowMs();
      const existing = ctx.state.labCreationRequests.get(scope);
      if (existing && existing.expiresAt > now) {
        if (existing.fingerprint !== fingerprint) return { kind: 'conflict' };
        const lab = ctx.state.labs.get(existing.labId);
        if (!lab) throw new Error('Missing idempotent lab');
        return { kind: 'replayed', lab: clone(lab) };
      }
      if (
        Date.parse(input.deadline) <= now ||
        Date.parse(input.opensAt ?? new Date(now).toISOString()) >=
          Date.parse(input.deadline)
      )
        return { kind: 'invalid-time' };
      const lab = build(input, new Date(now).toISOString());
      ctx.state.labs.set(lab.id, lab);
      ctx.state.labCreationRequests.set(scope, {
        fingerprint,
        labId: lab.id,
        expiresAt: now + LAB_CREATION_TTL_MS,
      });
      return { kind: 'created', lab: clone(lab) };
    },
    async listLabSummariesForClass(classId) {
      return [...ctx.state.labs.values()]
        .filter((lab) => lab.classId === classId)
        .map(summarizeLab)
        .sort(compareLabSummaries);
    },
    async createLab(input) {
      const lab = build(input);
      ctx.state.labs.set(lab.id, lab);
      return clone(lab);
    },

    async getLab(labId) {
      const lab = ctx.state.labs.get(labId);
      return lab ? clone(lab) : undefined;
    },

    async listLabsForUser(userId) {
      const classIds = new Set(
        [...ctx.state.memberships.values()]
          .filter((membership) => membership.userId === userId)
          .map((membership) => membership.classId),
      );
      return [...ctx.state.labs.values()]
        .filter((lab) => classIds.has(lab.classId))
        .map(clone);
    },
  };
}
