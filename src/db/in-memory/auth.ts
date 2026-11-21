import type { AuthStore } from '../auth-store.js';
import { normalizeUsername, validateAccount } from '../../shared/accounts.js';
import {
  clone,
  key,
  requireId,
  requireTimestamp,
  toPublicUser,
  type Context,
} from './state.js';

export function createAuthStore(ctx: Context): AuthStore {
  return {
    async createStudent(input) {
      const account = { ...input, username: normalizeUsername(input.username) };
      validateAccount(account);
      if (ctx.state.userIdsByUsername.has(account.username))
        return { kind: 'username-conflict' };
      const id = ctx.newId();
      if (ctx.state.users.has(id))
        throw new Error('Duplicate generated user ID');
      const user = { ...account, id, role: 'student' as const };
      ctx.state.users.set(id, user);
      ctx.state.userIdsByUsername.set(account.username, id);
      return { kind: 'created', user: toPublicUser(user) };
    },
    async findUserByUsername(username) {
      const userId = ctx.state.userIdsByUsername.get(
        normalizeUsername(username),
      );
      const user =
        userId === undefined ? undefined : ctx.state.users.get(userId);
      if (!user) return undefined;
      return { user: toPublicUser(user), passwordHash: user.passwordHash };
    },

    async getUser(userId) {
      const user = ctx.state.users.get(userId);
      return user ? toPublicUser(user) : undefined;
    },

    async createSession({ tokenHash, userId, expiresAt }) {
      if (typeof tokenHash !== 'string' || tokenHash.length === 0)
        throw new TypeError('tokenHash must be a nonempty string');
      requireId(userId, 'userId');
      requireTimestamp(expiresAt, 'expiresAt');
      if (!ctx.state.users.has(userId)) throw new TypeError('Unknown user');
      ctx.state.sessions.set(tokenHash, { userId, expiresAt });
    },

    async getSessionUser(tokenHash) {
      const session = ctx.state.sessions.get(tokenHash);
      if (!session) return undefined;
      if (Date.parse(session.expiresAt) <= ctx.nowMs()) {
        ctx.state.sessions.delete(tokenHash);
        return undefined;
      }
      const user = ctx.state.users.get(session.userId);
      return user ? toPublicUser(user) : undefined;
    },

    async deleteSession(tokenHash) {
      ctx.state.sessions.delete(tokenHash);
    },

    async getMembership(userId, classId) {
      const membership = ctx.state.memberships.get(key(userId, classId));
      return membership ? clone(membership) : undefined;
    },

    async listMemberships(userId) {
      return [...ctx.state.memberships.values()]
        .filter((membership) => membership.userId === userId)
        .map(clone);
    },
  };
}
