import type { Pool } from 'pg';
import { validateAccount } from '../../shared/accounts.js';
import type { ClassMembership, Role } from '../../shared/domain/index.js';
import { passwords } from '../../shared/passwords.js';
import { NORMALIZED_USERNAME_SQL } from '../postgres/account-sql.js';
import { transaction } from '../postgres/client.js';
import { DEMO_PASSWORD } from './demo-accounts.js';

export interface DeployAccount {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  password: string;
}

export const DEPLOY_CLASSES = [
  { id: 'pa3-class-1', name: 'PA03 Primary Class' },
  { id: 'pa3-class-2', name: 'PA03 Other Class' },
] as const;

const DEPLOY_ACCOUNT_SPECS: ReadonlyArray<{
  id: string;
  username: string;
  displayName: string;
  role: Role;
  envKey: string;
}> = [
  {
    id: 'pa3-admin',
    username: 'pa3.admin',
    displayName: 'PA03 Admin',
    role: 'admin',
    envKey: 'DEPLOY_ADMIN_PASSWORD',
  },
  {
    id: 'pa3-ta1',
    username: 'pa3.ta1',
    displayName: 'PA03 TA One',
    role: 'TA',
    envKey: 'DEPLOY_TA1_PASSWORD',
  },
  {
    id: 'pa3-ta2',
    username: 'pa3.ta2',
    displayName: 'PA03 TA Two',
    role: 'TA',
    envKey: 'DEPLOY_TA2_PASSWORD',
  },
  {
    id: 'pa3-student1',
    username: 'pa3.student1',
    displayName: 'PA03 Student One',
    role: 'student',
    envKey: 'DEPLOY_STUDENT1_PASSWORD',
  },
  {
    id: 'pa3-student2',
    username: 'pa3.student2',
    displayName: 'PA03 Student Two',
    role: 'student',
    envKey: 'DEPLOY_STUDENT2_PASSWORD',
  },
];

export function deployMemberships(): ClassMembership[] {
  return [
    { userId: 'pa3-ta1', classId: 'pa3-class-1', role: 'TA' },
    { userId: 'pa3-ta2', classId: 'pa3-class-2', role: 'TA' },
    { userId: 'pa3-student1', classId: 'pa3-class-1', role: 'student' },
    { userId: 'pa3-student2', classId: 'pa3-class-1', role: 'student' },
  ];
}

function readDeployPassword(env: NodeJS.ProcessEnv, envKey: string): string {
  const value = env[envKey];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${envKey} is required for deployment seed`);
  }
  if (value === DEMO_PASSWORD) {
    throw new Error(`${envKey} must not reuse the public dev password`);
  }
  const length = [...value].length;
  if (!value.isWellFormed() || length < 15 || length > 128) {
    throw new Error(`${envKey} must be a valid 15-128 character password`);
  }
  return value;
}

/** Loads the 5 isolated PA03 deployment accounts from explicit environment variables. */
export function loadDeploySeedAccounts(
  env: NodeJS.ProcessEnv = process.env,
): DeployAccount[] {
  const accounts = DEPLOY_ACCOUNT_SPECS.map((spec) => ({
    id: spec.id,
    username: spec.username,
    displayName: spec.displayName,
    role: spec.role,
    password: readDeployPassword(env, spec.envKey),
  }));
  for (const account of accounts) {
    validateAccount({ ...account, passwordHash: 'validated-before-hashing' });
  }
  return accounts;
}

/** Seeds the 5 isolated PA03 deployment accounts inside a serialized transaction. */
export async function seedDeployAccounts(
  pool: Pool,
  accounts: readonly DeployAccount[],
  options: { resetPasswords?: boolean } = {},
): Promise<{ added: number; skipped: number; updated: number }> {
  if (accounts.length !== DEPLOY_ACCOUNT_SPECS.length) {
    throw new Error('Deployment seed must contain exactly 5 accounts');
  }
  return transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(1279608148, 5)');
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
        ) {
          throw new Error(
            'Deploy seed account conflicts with existing ID, username or role; rolled back',
          );
        }
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
        } else {
          skipped++;
        }
        continue;
      }
      const hash = await passwords.hash(user.password);
      await db.query(
        'INSERT INTO users (id, username, display_name, role, password_hash) VALUES ($1,$2,$3,$4,$5)',
        [user.id, user.username, user.displayName, user.role, hash],
      );
      added++;
    }
    for (const classroom of DEPLOY_CLASSES) {
      const existing = await db.query(
        'SELECT name FROM classes WHERE id = $1',
        [classroom.id],
      );
      if (existing.rows.length && existing.rows[0].name !== classroom.name) {
        throw new Error('Deploy seed class conflicts with existing data');
      }
      await db.query(
        'INSERT INTO classes (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [classroom.id, classroom.name],
      );
    }
    for (const member of deployMemberships()) {
      const existing = await db.query(
        'SELECT role FROM class_memberships WHERE user_id=$1 AND class_id=$2',
        [member.userId, member.classId],
      );
      if (existing.rows.length && existing.rows[0].role !== member.role) {
        throw new Error('Deploy seed membership conflicts with existing data');
      }
      await db.query(
        'INSERT INTO class_memberships (user_id, class_id, role) VALUES ($1,$2,$3) ON CONFLICT (user_id, class_id) DO NOTHING',
        [member.userId, member.classId, member.role],
      );
    }
    return { added, skipped, updated };
  });
}
