import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PasswordService,
  PasswordBusyError,
} from '../../dist/shared/passwords.js';
import { AuthLimiter, AuthLimitError } from '../../dist/api/auth/rate-limit.js';
import { validateAuthBody } from '../../dist/api/modules/auth/index.js';
import {
  createDemoAccounts,
  demoMemberships,
  validateDemoAccounts,
} from '../../dist/db/seeds/demo-accounts.js';
import { createInMemoryStore } from '../../dist/db/index.js';
import {
  hasClassRole,
  ownsStudentData,
  readSessionToken,
} from '../../dist/api/auth/session.js';

test('password hashing is salted, preserves whitespace and rejects invalid hashes', async () => {
  const service = new PasswordService();
  const password = '  password with spaces  ';
  const first = await service.hash(password);
  assert.notEqual(await service.hash(password), first);
  assert.equal(await service.verify(password, first), true);
  assert.equal(await service.verify(password.trim(), first), false);
  await assert.rejects(
    service.verify(password, first.replace('$16384$', '$999999999$')),
    /Invalid stored/,
  );
});

test('password service rejects unpaired surrogates without changing valid Unicode', async () => {
  const service = new PasswordService();
  const valid = 'Mật khẩu 😀 dành cho test';
  const hash = await service.hash(valid);
  assert.equal(await service.verify(valid, hash), true);
  for (const value of [
    'a'.repeat(14) + '\ud800',
    'a'.repeat(14) + '\ud801',
    '\udfff',
  ]) {
    await assert.rejects(service.hash(value), TypeError);
    await assert.rejects(service.verify(value, hash), TypeError);
  }
});

test('password scheduler caps running and waiting work and recovers after errors', async () => {
  const work = [];
  let active = 0;
  let maximum = 0;
  const service = new PasswordService(
    () =>
      new Promise((resolve) => {
        maximum = Math.max(maximum, ++active);
        work.push(() => {
          active--;
          resolve(Buffer.alloc(64));
        });
      }),
  );
  const tasks = Array.from({ length: 34 }, () =>
    service.hash('not-a-real-credential'),
  );
  await assert.rejects(service.hash('overflow'), PasswordBusyError);
  for (let index = 0; index < 34; index++) {
    assert.ok(work[index]);
    work[index]();
    await new Promise((resolve) => setImmediate(resolve));
  }
  await Promise.all(tasks);
  assert.equal(maximum, 2);
  const rejecting = new PasswordService(async () => {
    throw new Error('derive failed');
  });
  await assert.rejects(rejecting.hash('a'), /derive failed/);
  await assert.rejects(rejecting.hash('b'), /derive failed/);
});

test('validation counts Unicode code points without transforming passwords', () => {
  const input = {
    username: '\u00a0 USER_1\t',
    password: '😀'.repeat(15),
    displayName: '  Student  ',
  };
  assert.deepEqual(validateAuthBody(input, true), {
    username: 'user_1',
    password: input.password,
    displayName: 'Student',
  });
  for (const body of [
    null,
    [],
    { ...input, role: 'admin' },
    { ...input, password: '😀'.repeat(14) },
    { ...input, password: '😀'.repeat(129) },
    { ...input, displayName: ' ' },
    { ...input, username: 'sinh viên' },
  ])
    assert.throws(() => validateAuthBody(body, true));
});

test('rate limiter uses fixed windows, bounded capacity and instance isolation', () => {
  let now = 0;
  const limiter = new AuthLimiter(() => now, 2);
  for (let index = 0; index < 120; index++) limiter.request('login', 'ip');
  assert.throws(
    () => limiter.request('login', 'ip'),
    (error) =>
      error instanceof AuthLimitError &&
      error.status === 429 &&
      error.retryAfter === 60,
  );
  for (let index = 0; index < 10; index++) limiter.reserveLogin('ip', 'user');
  assert.throws(
    () => limiter.reserveLogin('ip', 'user'),
    (error) => error.status === 429,
  );
  assert.throws(
    () => limiter.request('register', 'other'),
    (error) => error.status === 503,
  );
  new AuthLimiter(() => now).request('login', 'ip');
  now = 900_000;
  const success = limiter.reserveLogin('ip', 'user');
  success.succeed();
  for (let index = 0; index < 10; index++) limiter.reserveLogin('ip', 'user');
  assert.throws(() => limiter.reserveLogin('ip', 'user'));
  now = 3_600_000;
  for (let index = 0; index < 20; index++) limiter.request('register', 'ip');
  assert.throws(
    () => limiter.request('register', 'ip'),
    (error) => error.status === 429,
  );
});

test('demo seed covers 100 students and exactly 80 students per class', () => {
  const defaults = createDemoAccounts();
  assert.equal(validateDemoAccounts(defaults).length, 113);
  assert.ok(defaults.every((account) => account.password === 'password123'));
  assert.throws(() =>
    validateAuthBody(
      {
        username: 'new.student',
        password: 'password123',
        displayName: 'Student',
      },
      true,
    ),
  );
  const accounts = createDemoAccounts(() => 'test-only-password-value');
  assert.equal(validateDemoAccounts(accounts).length, 113);
  const memberships = demoMemberships();
  assert.equal(memberships.length, 170);
  for (const classId of ['demo-class-1', 'demo-class-2']) {
    assert.equal(
      memberships.filter((m) => m.classId === classId && m.role === 'student')
        .length,
      80,
    );
    assert.equal(
      memberships.filter((m) => m.classId === classId && m.role === 'TA')
        .length,
      5,
    );
  }
  assert.throws(() =>
    validateDemoAccounts([...accounts.slice(1), accounts[1]]),
  );
});

test('authorization checks class role and student ownership without admin bypass', async () => {
  const accounts = createDemoAccounts(() => 'test-only-password-value');
  const { store } = createInMemoryStore({
    seed: {
      users: accounts.map(({ password: _password, ...user }) => ({
        ...user,
        passwordHash: 'test-hash',
      })),
      classes: [
        { id: 'demo-class-1', name: 'One' },
        { id: 'demo-class-2', name: 'Two' },
      ],
      memberships: demoMemberships(),
      labs: [],
    },
  });
  for (const classId of ['demo-class-1', 'demo-class-2'])
    assert.equal(
      await hasClassRole(
        store,
        { id: 'demo-student001', role: 'student' },
        classId,
        'student',
      ),
      true,
    );
  assert.equal(
    await hasClassRole(
      store,
      { id: 'demo-ta01', role: 'TA' },
      'demo-class-2',
      'TA',
    ),
    false,
  );
  assert.equal(
    await hasClassRole(
      store,
      { id: 'demo-admin-vuong', role: 'admin' },
      'demo-class-1',
      'TA',
    ),
    false,
  );
  assert.equal(ownsStudentData({ id: 'one', role: 'student' }, 'one'), true);
  assert.equal(ownsStudentData({ id: 'two', role: 'student' }, 'one'), false);
  assert.equal(
    readSessionToken({ authorization: 'Bearer ' + 'A'.repeat(42) + 'B' }),
    undefined,
  );
});
