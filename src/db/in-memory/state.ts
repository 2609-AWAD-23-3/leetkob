import type {
  ClassMembership,
  ClassRoom,
  ConstraintVerdict,
  Evidence,
  Job,
  Lab,
  ModelCallLog,
  ReviewDecisionLog,
  Submission,
  TaDecision,
  User,
} from '../../shared/domain/index.js';
import { normalizeUsername } from '../../shared/accounts.js';
import type { Publication } from '../types.js';
import {
  copyNewLab,
  requireId,
  requireText,
  requireTimestamp,
  validateNewLab,
} from '../validation.js';

export interface SeedUser extends User {
  passwordHash: string;
}

// Accounts, classes and labs to start from. Submissions, jobs and verdicts
// are created through the store so tests exercise the real code paths.
export interface StoreSeed {
  users: readonly SeedUser[];
  classes: readonly ClassRoom[];
  memberships: readonly ClassMembership[];
  labs: readonly Lab[];
}

export interface StoredSubmission extends Submission {
  seq: number; // insertion order, breaks ties between equal timestamps
}

export interface StoredJob extends Job {
  done: boolean;
}

export interface StoredVerdict extends ConstraintVerdict {
  id: string;
  taDecision: TaDecision | null;
  taEvidence: Evidence[];
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface State {
  users: Map<string, SeedUser>;
  userIdsByUsername: Map<string, string>;
  classes: Map<string, ClassRoom>;
  memberships: Map<string, ClassMembership>;
  sessions: Map<string, { userId: string; expiresAt: string }>;
  labs: Map<string, Lab>;
  submissions: Map<string, StoredSubmission>;
  jobs: Map<string, StoredJob>;
  verdicts: Map<string, StoredVerdict>;
  verdictIdsByPair: Map<string, string>;
  decisionLog: ReviewDecisionLog[];
  modelCalls: ModelCallLog[];
  publications: Map<string, Publication>;
  nextSeq: number;
}

export interface Context {
  state: State;
  now(): string;
  nowMs(): number;
  newId(): string;
}

// Tuple encoding avoids collisions when IDs contain separators.
export function key(...ids: string[]): string {
  return JSON.stringify(ids);
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export { requireId, requireTimestamp };

// Validates a stored lab (with id and createdAt) and its class reference.
// Field rules are shared with every Store in ../validation.ts. Throws TypeError.
export function validateLab(lab: Lab, classes: Map<string, ClassRoom>): void {
  const { id, createdAt, ...rest } = lab;
  requireId(id, 'lab.id');
  requireTimestamp(createdAt, 'lab.createdAt');
  // A stored lab always has opensAt; validateNewLab checks it is before deadline.
  requireTimestamp(lab.opensAt, 'lab.opensAt');
  validateNewLab(rest);
  if (!classes.has(lab.classId)) throw new TypeError('lab.classId is unknown');
}

// Copies only the documented lab fields.
export function copyLab(lab: Lab): Lab {
  return {
    id: lab.id,
    ...copyNewLab(lab),
    opensAt: lab.opensAt,
    createdAt: lab.createdAt,
  };
}

export function emptyState(): State {
  return {
    users: new Map(),
    userIdsByUsername: new Map(),
    classes: new Map(),
    memberships: new Map(),
    sessions: new Map(),
    labs: new Map(),
    submissions: new Map(),
    jobs: new Map(),
    verdicts: new Map(),
    verdictIdsByPair: new Map(),
    decisionLog: [],
    modelCalls: [],
    publications: new Map(),
    nextSeq: 0,
  };
}

// Builds a fresh state from a seed; throws TypeError and builds nothing on bad input.
export function buildState(seed: StoreSeed): State {
  const state = emptyState();
  for (const field of ['users', 'classes', 'memberships', 'labs'] as const) {
    if (!Array.isArray(seed[field]))
      throw new TypeError(`seed.${field} must be an array`);
  }
  for (const user of seed.users) {
    requireId(user.id, 'user.id');
    requireText(user.username, 'user.username');
    requireText(user.displayName, 'user.displayName');
    requireText(user.passwordHash, 'user.passwordHash');
    if (!['admin', 'TA', 'student'].includes(user.role))
      throw new TypeError('user.role is not supported');
    if (
      state.users.has(user.id) ||
      state.userIdsByUsername.has(normalizeUsername(user.username))
    )
      throw new TypeError('Duplicate user id or username');
    state.users.set(user.id, clone(user));
    state.userIdsByUsername.set(normalizeUsername(user.username), user.id);
  }
  for (const classRoom of seed.classes) {
    requireId(classRoom.id, 'class.id');
    requireText(classRoom.name, 'class.name');
    if (state.classes.has(classRoom.id))
      throw new TypeError('Duplicate class.id');
    state.classes.set(classRoom.id, clone(classRoom));
  }
  for (const membership of seed.memberships) {
    const user = state.users.get(membership.userId);
    if (!user || !state.classes.has(membership.classId))
      throw new TypeError('Membership refers to an unknown user or class');
    if (membership.role !== user.role)
      throw new TypeError('Membership role must match the user role');
    const membershipKey = key(membership.userId, membership.classId);
    if (state.memberships.has(membershipKey))
      throw new TypeError('Duplicate membership');
    state.memberships.set(membershipKey, clone(membership));
  }
  for (const lab of seed.labs) {
    validateLab(lab, state.classes);
    if (!state.users.has(lab.createdBy))
      throw new TypeError('lab.createdBy is unknown');
    if (state.labs.has(lab.id)) throw new TypeError('Duplicate lab.id');
    state.labs.set(lab.id, copyLab(lab));
  }
  return state;
}

export function toPublicUser(user: SeedUser): User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

export function toSubmission(stored: StoredSubmission): Submission {
  const { seq: _seq, ...submission } = stored;
  return clone(submission);
}

export function toJob(stored: StoredJob): Job {
  const { done: _done, ...job } = stored;
  return clone(job);
}

export function toVerdict(stored: StoredVerdict): ConstraintVerdict {
  return {
    submissionId: stored.submissionId,
    constraintId: stored.constraintId,
    verdict: stored.verdict,
    evidence: clone(stored.evidence),
    unsureCause: stored.unsureCause,
    reason: stored.reason,
    source: stored.source,
    createdAt: stored.createdAt,
  };
}
