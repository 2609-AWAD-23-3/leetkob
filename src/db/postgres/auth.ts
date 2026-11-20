import type { ClassMembership, User } from '../../shared/domain/index.js';
import type { AuthStore } from '../auth-store.js';
import { requireId, requireTimestamp } from '../validation.js';
import type { PostgresContext } from './client.js';

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: User['role'];
  password_hash: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

function toMembership(row: {
  user_id: string;
  class_id: string;
  role: ClassMembership['role'];
}): ClassMembership {
  return { userId: row.user_id, classId: row.class_id, role: row.role };
}

export function createAuthStore(ctx: PostgresContext): AuthStore {
  const { pool } = ctx;
  return {
    async findUserByUsername(username) {
      await ctx.ready;
      const { rows } = await pool.query<UserRow>(
        'SELECT * FROM users WHERE username = $1',
        [username],
      );
      const row = rows[0];
      return row
        ? { user: toUser(row), passwordHash: row.password_hash }
        : undefined;
    },

    async getUser(userId) {
      await ctx.ready;
      const { rows } = await pool.query<UserRow>(
        'SELECT * FROM users WHERE id = $1',
        [userId],
      );
      return rows[0] ? toUser(rows[0]) : undefined;
    },

    async createSession({ tokenHash, userId, expiresAt }) {
      await ctx.ready;
      if (typeof tokenHash !== 'string' || tokenHash.length === 0)
        throw new TypeError('tokenHash must be a nonempty string');
      requireId(userId, 'userId');
      requireTimestamp(expiresAt, 'expiresAt');
      const user = await pool.query('SELECT 1 FROM users WHERE id = $1', [
        userId,
      ]);
      if (!user.rowCount) throw new TypeError('Unknown user');
      await pool.query(
        `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (token_hash) DO UPDATE SET user_id = $2, expires_at = $3`,
        [tokenHash, userId, expiresAt],
      );
    },

    async getSessionUser(tokenHash) {
      await ctx.ready;
      const { rows } = await pool.query<UserRow & { expires_at: Date }>(
        `SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1`,
        [tokenHash],
      );
      const row = rows[0];
      if (!row) return undefined;
      if (row.expires_at.getTime() <= ctx.nowMs()) {
        await pool.query('DELETE FROM sessions WHERE token_hash = $1', [
          tokenHash,
        ]);
        return undefined;
      }
      return toUser(row);
    },

    async deleteSession(tokenHash) {
      await ctx.ready;
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [
        tokenHash,
      ]);
    },

    async getMembership(userId, classId) {
      await ctx.ready;
      const { rows } = await pool.query(
        'SELECT * FROM class_memberships WHERE user_id = $1 AND class_id = $2',
        [userId, classId],
      );
      return rows[0] ? toMembership(rows[0]) : undefined;
    },

    async listMemberships(userId) {
      await ctx.ready;
      const { rows } = await pool.query(
        'SELECT * FROM class_memberships WHERE user_id = $1 ORDER BY seq',
        [userId],
      );
      return rows.map(toMembership);
    },
  };
}
