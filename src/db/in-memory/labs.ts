import type { Lab } from '../../shared/domain/index.js';
import type { LabStore } from '../lab-store.js';
import {
  copyNewLab,
  requireOpensBeforeDeadline,
  validateNewLab,
} from '../validation.js';
import { clone, type Context } from './state.js';

export function createLabStore(ctx: Context): LabStore {
  return {
    async createLab(input) {
      // Exactly the documented fields; an unknown field (or an `id`) is rejected.
      validateNewLab(input);
      if (!ctx.state.classes.has(input.classId))
        throw new TypeError('lab.classId is unknown');
      if (!ctx.state.users.has(input.createdBy))
        throw new TypeError('lab.createdBy is unknown');
      const createdAt = ctx.now();
      // Without opensAt the lab opens for submissions when it is created.
      const opensAt = input.opensAt ?? createdAt;
      requireOpensBeforeDeadline(opensAt, input.deadline);
      const lab: Lab = {
        id: ctx.newId(),
        ...copyNewLab(input),
        opensAt,
        createdAt,
      };
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
