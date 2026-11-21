import type { ClassMembership, User } from '../shared/domain/index.js';

export interface UserCredentials {
  user: User;
  passwordHash: string;
}

// Used by PA03-T04 (login, sessions, membership checks).
// The store never decides access; the API checks role and membership first.
export interface AuthStore {
  findUserByUsername(username: string): Promise<UserCredentials | undefined>;
  getUser(userId: string): Promise<User | undefined>;
  // tokenHash is a hash of the random token; the raw token is never stored.
  createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: string;
  }): Promise<void>;
  // undefined when the session is unknown or expired.
  getSessionUser(tokenHash: string): Promise<User | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
  getMembership(
    userId: string,
    classId: string,
  ): Promise<ClassMembership | undefined>;
  listMemberships(userId: string): Promise<ClassMembership[]>;
}
