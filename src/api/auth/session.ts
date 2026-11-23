import { createHash, randomBytes } from 'node:crypto';
import type { AuthStore } from '../../db/auth-store.js';
import type { User } from '../../shared/domain/index.js';
import type {
  IdentityResolution,
  IncomingHeaders,
  Principal,
  PublishIdentityResolver,
} from './types.js';

export const generateSessionToken = (): string =>
  randomBytes(32).toString('base64url');
export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export function readSessionToken(headers: IncomingHeaders): string | undefined {
  const value = headers.authorization;
  if (typeof value !== 'string') return undefined;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(value);
  if (!match) return undefined;
  const token = match[1]!;
  return Buffer.from(token, 'base64url').toString('base64url') === token
    ? token
    : undefined;
}

export interface SessionIdentityResolver {
  resolve(headers: IncomingHeaders): Promise<User | undefined>;
}

export function createSessionIdentityResolver(
  store: AuthStore,
): SessionIdentityResolver {
  return {
    async resolve(headers) {
      const token = readSessionToken(headers);
      return token ? store.getSessionUser(hashSessionToken(token)) : undefined;
    },
  };
}

// Session identity for the Publish route (contract v1 keeps its three 401
// reasons): no header -> missing, not "Bearer <token>" -> malformed, unknown,
// expired or wrongly shaped token -> invalid.
export function createSessionPublishIdentityResolver(
  store: AuthStore,
): PublishIdentityResolver {
  return {
    async resolve(headers): Promise<IdentityResolution> {
      const raw = headers.authorization;
      if (raw === undefined)
        return { kind: 'unauthenticated', reason: 'missing_credentials' };
      if (
        typeof raw !== 'string' ||
        raw.length === 0 ||
        raw.trim() !== raw ||
        !/^Bearer\s+\S+$/i.test(raw)
      )
        return { kind: 'unauthenticated', reason: 'malformed_credentials' };
      const token = readSessionToken(headers);
      const user = token
        ? await store.getSessionUser(hashSessionToken(token))
        : undefined;
      if (!user)
        return { kind: 'unauthenticated', reason: 'invalid_credentials' };
      return {
        kind: 'authenticated',
        principal: { id: user.id, role: user.role },
      };
    },
  };
}

export async function hasClassRole(
  store: AuthStore,
  principal: Principal,
  classId: string,
  role: 'TA' | 'student',
): Promise<boolean> {
  return (
    principal.role === role &&
    (await store.getMembership(principal.id, classId))?.role === role
  );
}

export function ownsStudentData(
  principal: Principal,
  studentId: string,
): boolean {
  return principal.role === 'student' && principal.id === studentId;
}
