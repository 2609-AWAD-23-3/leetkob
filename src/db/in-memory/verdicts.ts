import type { ModelCallLog } from '../../shared/domain/index.js';
import type { VerdictStore } from '../verdict-store.js';
import { validateModelCallMetrics } from '../validation.js';
import { clone, toVerdict, type Context } from './state.js';

export function createVerdictStore(ctx: Context): VerdictStore {
  return {
    async listVerdicts(submissionId) {
      return [...ctx.state.verdicts.values()]
        .filter((verdict) => verdict.submissionId === submissionId)
        .map(toVerdict);
    },

    async recordModelCall(log) {
      validateModelCallMetrics(log);
      if (!ctx.state.submissions.has(log.submissionId))
        throw new TypeError('Model call refers to an unknown submission');
      const stored: ModelCallLog = {
        ...clone(log),
        id: ctx.newId(),
        createdAt: ctx.now(),
      };
      ctx.state.modelCalls.push(stored);
      return clone(stored);
    },

    async listModelCalls(submissionId) {
      return ctx.state.modelCalls
        .filter((log) => log.submissionId === submissionId)
        .map(clone);
    },
  };
}
