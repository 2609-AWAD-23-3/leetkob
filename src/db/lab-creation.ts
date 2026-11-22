import { createHash } from 'node:crypto';
import type { Lab, LabSummary, NewLab } from '../shared/domain/index.js';
import { copyNewLab, validateNewLab } from './validation.js';

export const LAB_CREATION_TTL_MS = 86_400_000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function normalizeLabKey(key: string): string {
  if (typeof key !== 'string' || !UUID_V4.test(key))
    throw new TypeError('Idempotency-Key must be a UUID v4');
  return key.toLowerCase();
}

export function normalizeNewLab(input: NewLab): NewLab {
  validateNewLab(input);
  const result = copyNewLab(input);
  result.title = result.title.trim();
  return result;
}

// Explicit ordered projection: JSON object property order and multipart source
// are irrelevant; array order and text bytes are significant. No clock in hash.
export function labFingerprint(input: NewLab): string {
  const value = copyNewLab(input);
  return createHash('sha256')
    .update(JSON.stringify({ ...value, opensAt: value.opensAt ?? null }))
    .digest('hex');
}

export function summarizeLab(lab: Lab): LabSummary {
  const { id, classId, title, opensAt, deadline, createdAt } = lab;
  return { id, classId, title, opensAt, deadline, createdAt };
}

export function compareLabSummaries(a: LabSummary, b: LabSummary): number {
  return (
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
