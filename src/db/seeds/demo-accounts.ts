import type { Pool } from 'pg';
import { validateAccount } from '../../shared/accounts.js';
import { passwords } from '../../shared/passwords.js';
import type { Role, ClassMembership } from '../../shared/domain/index.js';
import { transaction } from '../postgres/client.js';
import { NORMALIZED_USERNAME_SQL } from '../postgres/account-sql.js';

export interface DemoAccount {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  password: string;
}

// Public credential for fictional development accounts, never real users.
export const DEMO_PASSWORD = 'password123';

/** Prevents accidentally running the public-password development seed in production. */
export function assertDevSeedAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const leetkobEnv = env.LEETKOB_ENV?.trim().toLowerCase();
  const allowDevSeed = env.ALLOW_DEV_SEED?.trim().toLowerCase();
  if (
    nodeEnv === 'production' ||
    leetkobEnv === 'production' ||
    allowDevSeed === '0' ||
    allowDevSeed === 'false'
  ) {
    throw new Error(
      'Development seed is blocked in production environments. Use npm run db:seed:deploy with explicit deploy passwords instead.',
    );
  }
}

export const demoClasses = [
  { id: 'demo-class-1', name: 'Demo Class 1' },
  { id: 'demo-class-2', name: 'Demo Class 2' },
];

export function createDemoAccounts(
  password: () => string = () => DEMO_PASSWORD,
): DemoAccount[] {
  const users: DemoAccount[] = ['vuong', 'phuc', 'vy'].map((name) => ({
    id: `demo-admin-${name}`,
    username: `admin.${name}`,
    displayName: `Admin ${name}`,
    role: 'admin',
    password: password(),
  }));
  for (let index = 1; index <= 10; index++) {
    const username = `ta${String(index).padStart(2, '0')}`;
    users.push({
      id: `demo-${username}`,
      username,
      displayName: `TA ${index}`,
      role: 'TA',
      password: password(),
    });
  }
  for (let index = 1; index <= 100; index++) {
    const username = `student${String(index).padStart(3, '0')}`;
    users.push({
      id: `demo-${username}`,
      username,
      displayName: `Student ${index}`,
      role: 'student',
      password: password(),
    });
  }
  return users;
}

export function demoMemberships(): ClassMembership[] {
  const memberships: ClassMembership[] = [];
  for (let index = 1; index <= 10; index++)
    memberships.push({
      userId: `demo-ta${String(index).padStart(2, '0')}`,
      classId: `demo-class-${index <= 5 ? 1 : 2}`,
      role: 'TA',
    });
  for (let index = 1; index <= 100; index++) {
    const userId = `demo-student${String(index).padStart(3, '0')}`;
    if (index <= 80)
      memberships.push({ userId, classId: 'demo-class-1', role: 'student' });
    if (index <= 60 || index > 80)
      memberships.push({ userId, classId: 'demo-class-2', role: 'student' });
  }
  return memberships;
}

export function validateDemoAccounts(value: unknown): DemoAccount[] {
  const expected = createDemoAccounts(() => '');
  if (!Array.isArray(value) || value.length !== expected.length)
    throw new Error('Seed must contain exactly 113 demo accounts');
  const byId = new Map(expected.map((user) => [user.id, user]));
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object')
      throw new Error('Invalid seed account');
    const user = item as DemoAccount;
    const reference = byId.get(user.id);
    if (
      !reference ||
      seen.has(user.id) ||
      Object.keys(user).sort().join(',') !==
        'displayName,id,password,role,username' ||
      user.username !== reference.username ||
      user.role !== reference.role ||
      user.displayName !== reference.displayName ||
      typeof user.password !== 'string' ||
      (user.password !== DEMO_PASSWORD && [...user.password].length < 15) ||
      [...user.password].length > 128
    )
      throw new Error(
        'Seed metadata or password does not match the demo schema',
      );
    validateAccount({ ...user, passwordHash: 'validated-before-hashing' });
    seen.add(user.id);
  }
  return structuredClone(value) as DemoAccount[];
}

// Explicit administrative command only. Never mounted as HTTP or called on startup.
export async function seedDemoAccounts(
  pool: Pool,
  value: unknown,
  options: { resetPasswords?: boolean } = {},
): Promise<{ added: number; skipped: number; updated: number }> {
  const accounts = validateDemoAccounts(value);
  return transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(1279608148, 4)');
    // Also serialize against registration; inspect collisions before writing anything.
    await db.query(
      'LOCK TABLE users, classes, class_memberships IN SHARE ROW EXCLUSIVE MODE',
    );
    let added = 0;
    let skipped = 0;
    let updated = 0;
    for (const user of accounts) {
      const { rows } = await db.query(
        'SELECT id, username, role, password_hash FROM users WHERE id = $1 OR ' +
          NORMALIZED_USERNAME_SQL +
          ' = $2',
        [user.id, user.username],
      );
      if (rows.length) {
        if (
          rows.length !== 1 ||
          rows[0].id !== user.id ||
          rows[0].username !== user.username ||
          rows[0].role !== user.role
        )
          throw new Error(
            'Seed account conflicts with an existing ID, username or role; transaction rolled back',
          );
        if (
          options.resetPasswords &&
          !(await passwords.verify(user.password, rows[0].password_hash))
        ) {
          const hash = await passwords.hash(user.password);
          await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [
            hash,
            user.id,
          ]);
          await db.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
          updated++;
        } else skipped++;
        continue;
      }
      const hash = await passwords.hash(user.password);
      await db.query(
        'INSERT INTO users (id, username, display_name, role, password_hash) VALUES ($1,$2,$3,$4,$5)',
        [user.id, user.username, user.displayName, user.role, hash],
      );
      added++;
    }
    for (const classroom of demoClasses) {
      const existing = await db.query(
        'SELECT name FROM classes WHERE id = $1',
        [classroom.id],
      );
      if (existing.rows.length && existing.rows[0].name !== classroom.name)
        throw new Error('Seed class conflicts with existing data');
      await db.query(
        'INSERT INTO classes (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING',
        [classroom.id, classroom.name],
      );
    }
    for (const member of demoMemberships()) {
      const existing = await db.query(
        'SELECT role FROM class_memberships WHERE user_id=$1 AND class_id=$2',
        [member.userId, member.classId],
      );
      if (existing.rows.length && existing.rows[0].role !== member.role)
        throw new Error('Seed membership conflicts with existing data');
      await db.query(
        'INSERT INTO class_memberships (user_id,class_id,role) VALUES ($1,$2,$3) ON CONFLICT (user_id,class_id) DO NOTHING',
        [member.userId, member.classId, member.role],
      );
    }
    return { added, skipped, updated };
  });
}
