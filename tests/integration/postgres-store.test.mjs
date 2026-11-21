import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import pg from 'pg';
import { createStoreSeed } from '../../dist/db/index.js';
import { createPostgresStore } from '../../dist/db/postgres/index.js';
import { createJobQueue } from '../../dist/db/postgres/job-queue.js';
import { MIGRATIONS } from '../../dist/db/migrations/index.js';
import { createReviewStore } from '../../dist/db/postgres/reviews.js';
import { createSubmissionStore } from '../../dist/db/postgres/submissions.js';
import { defineStoreConformance } from '../support/store-conformance.mjs';
import { assertAuthFlow } from '../support/auth-flow.mjs';
import {
  createDemoAccounts,
  seedDemoAccounts,
} from '../../dist/db/seeds/demo-accounts.js';
import { createPool, migrate } from '../../dist/db/postgres/client.js';
import { createApp } from '../../dist/api/app.js';

// Runs only when TEST_DATABASE_URL points at a disposable Postgres, for
// example the one from docker/compose.postgres.yml. `npm test` stays free of
// Postgres; `npm run test:db` and the CI postgres-store job set the variable.
const url = process.env.TEST_DATABASE_URL;

if (!url) {
  test(
    'postgres store tests',
    { skip: 'TEST_DATABASE_URL is not set' },
    () => {},
  );
} else {
  const run = `t${process.pid}_${Date.now().toString(36)}`;
  const schemas = [];
  const fixtures = [];
  let counter = 0;

  // Every fixture gets its own schema, so tests never share state.
  const makeFixture = (options, schema = `${run}_${++counter}`) => {
    if (!schemas.includes(schema)) schemas.push(schema);
    const fixture = createPostgresStore({
      connectionString: url,
      schema,
      ...options,
    });
    fixtures.push(fixture);
    return fixture;
  };

  after(async () => {
    // Drop the schemas even when closing a pool fails.
    await Promise.allSettled(fixtures.map((fixture) => fixture.store.close()));
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    for (const schema of schemas)
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  defineStoreConformance('postgres store', (options) => makeFixture(options));

  test('postgres auth: invalid text returns 400 and valid Unicode still logs in', async (t) => {
    const fixture = makeFixture({});
    const app = createApp({ auth: { store: fixture.store } });
    t.after(() => app.close());
    const input = {
      username: 'unicode.test',
      password: 'test-only-password-value',
      displayName: 'Unicode Test',
    };
    for (const payload of [
      { ...input, displayName: 'A\u0000B' },
      { ...input, displayName: '\ud800' },
      { ...input, password: 'a'.repeat(14) + '\ud800' },
      { ...input, password: 'a'.repeat(14) + '\ud801' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload,
      });
      assert.equal(response.statusCode, 400, response.body);
    }
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: {
            username: input.username,
            password: 'a'.repeat(14) + '\ud801',
          },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      await fixture.store.findUserByUsername(input.username),
      undefined,
    );
    const valid = {
      ...input,
      displayName: 'Nguyễn Văn 😀',
      password: 'Mật khẩu 😀 dành cho test',
    };
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: valid,
        })
      ).statusCode,
      201,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { username: valid.username, password: valid.password },
        })
      ).statusCode,
      200,
    );
  });

  test('postgres pool: losing an idle connection keeps the process alive and reconnects', () => {
    const source = `
      import assert from 'node:assert/strict';
      import pg from 'pg';
      import { createPool } from './dist/db/postgres/client.js';
      const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
      const pool = createPool(process.env.TEST_DATABASE_URL);
      await admin.connect();
      try {
        const client = await pool.connect();
        const { rows } = await client.query('SELECT pg_backend_pid() AS pid');
        const ended = new Promise((resolve) => client.once('end', resolve));
        client.release();
        await admin.query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
        await ended;
        const next = await pool.query('SELECT pg_backend_pid() AS pid');
        assert.notEqual(next.rows[0].pid, rows[0].pid);
        console.log('idle-connection-recovered');
      } finally { await pool.end(); await admin.end(); }
    `;
    const child = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', source],
      {
        cwd: new URL('../../', import.meta.url),
        env: process.env,
        encoding: 'utf8',
        timeout: 10_000,
      },
    );
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /idle-connection-recovered/);
    assert.doesNotMatch(child.stderr, /Unhandled 'error' event/);
    assert.match(child.stderr, /idle PostgreSQL connection was lost/);
  });

  test('postgres auth: real HTTP flow stores only token hash', async (t) => {
    const fixture = makeFixture({});
    const { userId, token } = await assertAuthFlow(fixture.store, t);
    const schema = schemas.at(-1);
    const pool = createPool(url, schema);
    try {
      const { rows } = await pool.query(
        'SELECT token_hash FROM sessions WHERE user_id=$1',
        [userId],
      );
      assert.equal(rows.length, 1);
      assert.notEqual(rows[0].token_hash, token);
      assert.match(rows[0].token_hash, /^[a-f0-9]{64}$/);
    } finally {
      await pool.end();
    }
  });

  test('postgres auth: seed is repeatable, concurrent-safe and preserves credentials', async (t) => {
    const fixture = makeFixture({});
    await fixture.ready;
    const pool = createPool(url, schemas.at(-1));
    t.after(() => pool.end());
    const accounts = createDemoAccounts(() => 'test-only-demo-password');
    const results = await Promise.all([
      seedDemoAccounts(pool, accounts),
      seedDemoAccounts(pool, accounts),
    ]);
    assert.deepEqual(
      results.map((result) => result.added).sort((a, b) => a - b),
      [0, 113],
    );
    const before = (
      await pool.query('SELECT id,password_hash FROM users ORDER BY id')
    ).rows;
    assert.equal(
      (await pool.query('SELECT * FROM class_memberships')).rowCount,
      170,
    );
    assert.equal((await pool.query('SELECT * FROM labs')).rowCount, 0);
    const changed = accounts.map((user) => ({
      ...user,
      password: 'a-different-test-password',
    }));
    assert.deepEqual(await seedDemoAccounts(pool, changed), {
      added: 0,
      skipped: 113,
      updated: 0,
    });
    assert.deepEqual(
      (await pool.query('SELECT id,password_hash FROM users ORDER BY id')).rows,
      before,
    );
    const app = createApp({ auth: { store: fixture.store } });
    t.after(() => app.close());
    for (const username of ['admin.vuong', 'ta01', 'student001']) {
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username, password: 'test-only-demo-password' },
      });
      assert.equal(login.statusCode, 200, login.body);
    }
    await fixture.store.createSession({
      tokenHash: 'test-demo-session',
      userId: 'demo-admin-vuong',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    const outsider = await fixture.store.createStudent({
      username: 'outside.seed',
      displayName: 'Outside',
      passwordHash: before[0].password_hash,
    });
    const outsideBefore =
      await fixture.store.findUserByUsername('outside.seed');
    const reset = accounts.map((user, index) =>
      index === 0 ? { ...user, password: 'password123' } : user,
    );
    assert.deepEqual(
      await seedDemoAccounts(pool, reset, { resetPasswords: true }),
      { added: 0, updated: 1, skipped: 112 },
    );
    assert.equal(
      await fixture.store.getSessionUser('test-demo-session'),
      undefined,
    );
    assert.deepEqual(
      await fixture.store.findUserByUsername('outside.seed'),
      outsideBefore,
    );
    assert.equal(outsider.kind, 'created');
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { username: 'admin.vuong', password: 'password123' },
        })
      ).statusCode,
      200,
    );
    await pool.query(
      "UPDATE users SET role='student' WHERE id='demo-admin-vy'",
    );
    await assert.rejects(seedDemoAccounts(pool, accounts), /conflicts/);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS count FROM users')).rows[0]
        .count,
      114,
    );
  });

  test('postgres auth: normalized migration refuses collisions without deleting users', async (t) => {
    const schema = `${run}_username_conflict`;
    schemas.push(schema);
    const pool = createPool(url, schema);
    t.after(() => pool.end());
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(MIGRATIONS[0].sql);
    await pool.query(MIGRATIONS[1].sql);
    await pool.query(
      'CREATE TABLE schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    await pool.query(
      "INSERT INTO schema_migrations (id) VALUES ('0001_init'), ('0002_model_call_metrics')",
    );
    await pool.query(
      "INSERT INTO users (id,username,display_name,role,password_hash) VALUES ('one','Alice','One','student','fake'), ('two',' alice ','Two','student','fake')",
    );
    await assert.rejects(
      migrate(pool, schema),
      /Username normalization conflicts/,
    );
    assert.equal((await pool.query('SELECT * FROM users')).rowCount, 2);
    assert.equal(
      (await pool.query('SELECT * FROM schema_migrations')).rowCount,
      2,
    );
  });

  const at = (iso) => () => new Date(iso);
  const OPEN = '2026-11-09T10:00:00.000Z';

  test('postgres store: data survives closing and reopening the store', async () => {
    const schema = `${run}_reopen`;
    const first = makeFixture(
      { seed: createStoreSeed(), clock: at(OPEN) },
      schema,
    );
    const submission = await first.store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: 'int main() {}',
    });
    await first.store.close();
    // A new store on the same schema: no seed, migrations already applied.
    const second = makeFixture({ clock: at(OPEN) }, schema);
    assert.deepEqual(
      await second.store.getSubmission(submission.id),
      submission,
    );
    const job = await second.store.claim({
      workerId: 'worker-after-reopen',
      leaseMs: 1000,
      maxAttempts: 3,
    });
    assert.equal(job.submissionId, submission.id);
  });

  const AC = {
    verdict: 'AC',
    tests: [
      { testId: 't1', verdict: 'AC' },
      { testId: 't2', verdict: 'AC' },
    ],
  };
  const passVerdict = (submissionId, constraintId) => ({
    submissionId,
    constraintId,
    verdict: 'pass',
    evidence: [],
    unsureCause: null,
    reason: null,
    source: 'model',
  });

  test('postgres store: concurrent first starts create schema and apply migrations once', async () => {
    const schema = `${run}_first_start`;
    const starts = Array.from({ length: 4 }, () => makeFixture({}, schema));
    await Promise.all(starts.map((fixture) => fixture.ready));
    const db = new pg.Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await db.connect();
    try {
      const expected = [
        '0001_init',
        '0002_model_call_metrics',
        '0003_normalized_username',
      ];
      const applied = await db.query(
        'SELECT id FROM schema_migrations ORDER BY id',
      );
      assert.deepEqual(
        applied.rows.map((row) => row.id),
        expected,
      );
      const reopened = makeFixture({}, schema);
      await reopened.ready;
      assert.equal(
        (await db.query('SELECT * FROM schema_migrations')).rowCount,
        3,
      );
    } finally {
      await db.end();
    }
  });

  test('postgres store: upgrading an existing initial schema preserves its data', async () => {
    const schema = `${run}_upgrade`;
    schemas.push(schema);
    const db = new pg.Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await db.connect();
    try {
      await db.query(`CREATE SCHEMA ${schema}`);
      await db.query(MIGRATIONS[0].sql);
      await db.query(`CREATE TABLE schema_migrations (
        id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      await db.query("INSERT INTO schema_migrations (id) VALUES ('0001_init')");
      await db.query(`INSERT INTO users (id, username, display_name, role, password_hash)
        VALUES ('existing-user', 'existing', 'Existing User', 'student', 'fake-hash')`);
      const fixture = makeFixture({}, schema);
      await fixture.ready;
      assert.equal(
        (await fixture.store.getUser('existing-user')).username,
        'existing',
      );
      const applied = await db.query(
        'SELECT id FROM schema_migrations ORDER BY id',
      );
      assert.deepEqual(
        applied.rows.map((row) => row.id),
        ['0001_init', '0002_model_call_metrics', '0003_normalized_username'],
      );
    } finally {
      await db.end();
    }
  });

  test('postgres store: Publish sees one snapshot when a worker completes during its reads', async () => {
    const schema = `${run}_publish_snapshot`;
    let time = Date.parse(OPEN);
    const { store } = makeFixture(
      { seed: createStoreSeed(), clock: () => new Date(time) },
      schema,
    );
    const submission = await store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: '',
    });
    const job = await store.claim({
      workerId: 'worker-a',
      leaseMs: 36_000_000,
      maxAttempts: 3,
    });
    time = Date.parse('2026-11-09T15:00:00.000Z');
    const pool = new pg.Pool({
      connectionString: url,
      options: `-c search_path=${schema}`,
      max: 1,
    });
    let completed = false;
    // Complete on a separate connection after the first queue/state read.
    // This reproduces the old gap between reading queue items and unfinished
    // submissions without relying on sleep or scheduler timing.
    const publishingPool = {
      async connect() {
        const client = await pool.connect();
        return {
          release: () => client.release(),
          async query(sql, params) {
            const result = await client.query(sql, params);
            if (
              !completed &&
              (sql.includes('SELECT v.*, s.lab_id') ||
                sql.includes('WITH counted AS'))
            ) {
              completed = true;
              assert.equal(
                await store.complete({
                  jobId: job.id,
                  leaseToken: job.leaseToken,
                  judgeResult: AC,
                  verdicts: ['c1', 'c2'].map((id) =>
                    passVerdict(submission.id, id),
                  ),
                }),
                true,
              );
            }
            return result;
          },
        };
      },
    };
    try {
      const publisher = createReviewStore({
        pool: publishingPool,
        ready: Promise.resolve(),
        now: () => new Date(time).toISOString(),
        nowMs: () => time,
      });
      const result = await publisher.publishLab({
        labId: 'lab-sort',
        publishedBy: 'ta-1',
      });
      assert.equal(completed, true);
      assert.equal(result.kind, 'pending_reviews');
      assert.ok(result.pendingCount > 0);
      assert.equal(await store.getPublication('lab-sort'), undefined);
      assert.equal((await store.getReviewState('lab-sort')).pendingCount, 2);
    } finally {
      await pool.end();
    }
  });

  const waitFor = async (predicate) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (await predicate()) return;
      await new Promise(setImmediate);
    }
    assert.fail('the operation did not reach the expected wait');
  };

  test('postgres store: submit keeps receive time across a connection wait at the deadline', async () => {
    const schema = `${run}_receive_time`;
    const deadline = Date.parse('2026-11-09T15:00:00.000Z');
    let time = deadline - 1;
    const receivedAt = new Date(time).toISOString();
    const { store, ready } = makeFixture(
      {
        seed: createStoreSeed(),
        clock: () => new Date(time),
      },
      schema,
    );
    await ready;
    const pool = new pg.Pool({
      connectionString: url,
      max: 1,
      options: `-c search_path=${schema}`,
    });
    let held = await pool.connect();
    let pending;
    try {
      const submissions = createSubmissionStore({
        pool,
        ready: Promise.resolve(),
        nowMs: () => time,
        now: () => new Date(time).toISOString(),
        newId: (() => {
          let id = 0;
          return () => `received-${++id}`;
        })(),
      });
      pending = submissions.submit({
        labId: 'lab-sort',
        studentId: 'student-1',
        code: '',
      });
      pending.catch(() => {});
      await waitFor(() => pool.waitingCount === 1);
      time = deadline + 1;
      held.release();
      held = undefined;
      const submission = await pending;
      assert.equal(submission.submittedAt, receivedAt);
      assert.deepEqual(await store.getSubmission(submission.id), submission);
      assert.deepEqual(
        (await store.listCountedSubmissions('lab-sort')).map((item) => item.id),
        [submission.id],
      );
      const jobs = await pool.query(
        'SELECT id FROM jobs WHERE submission_id = $1',
        [submission.id],
      );
      assert.equal(jobs.rowCount, 1);
      // The fix preserves the receive time; it does not move the deadline.
      time = deadline;
      const late = await submissions.submit({
        labId: 'lab-sort',
        studentId: 'student-2',
        code: '',
      });
      assert.equal(late.submittedAt, '2026-11-09T15:00:00.000Z');
      assert.deepEqual(
        (await store.listCountedSubmissions('lab-sort')).map((item) => item.id),
        [submission.id],
      );
    } finally {
      if (held) held.release();
      await pending?.catch(() => {});
      await pool.end();
    }
  });

  for (const operation of ['extendLease', 'complete', 'fail']) {
    for (const wait of [
      'connection',
      'job lock',
      ...(operation === 'complete' ? ['submission lock'] : []),
    ]) {
      test(`postgres store: ${operation} rejects a lease expiring during a ${wait} wait`, async () => {
        const schema = `${run}_lease_${++counter}`;
        let time = Date.parse(OPEN);
        const { store } = makeFixture(
          { seed: createStoreSeed(), clock: () => new Date(time) },
          schema,
        );
        const submission = await store.submit({
          labId: 'lab-sort',
          studentId: 'student-1',
          code: '',
        });
        const job = await store.claim({
          workerId: 'worker-a',
          leaseMs: 1000,
          maxAttempts: 3,
        });
        const pool = new pg.Pool({
          connectionString: url,
          max: 1,
          options: `-c search_path=${schema}`,
          application_name: schema,
        });
        const control = new pg.Client({
          connectionString: url,
          options: `-c search_path=${schema}`,
        });
        await control.connect();
        let held;
        let locked = false;
        let pending;
        try {
          if (wait === 'connection') held = await pool.connect();
          else {
            await control.query('BEGIN');
            locked = true;
            if (wait === 'job lock')
              await control.query(
                'SELECT 1 FROM jobs WHERE id = $1 FOR UPDATE',
                [job.id],
              );
            else
              await control.query(
                'SELECT 1 FROM submissions WHERE id = $1 FOR UPDATE',
                [submission.id],
              );
          }
          const queue = createJobQueue({
            pool,
            ready: Promise.resolve(),
            nowMs: () => time,
            now: () => new Date(time).toISOString(),
          });
          const lease = { jobId: job.id, leaseToken: job.leaseToken };
          if (operation === 'extendLease')
            pending = queue.extendLease({ ...lease, leaseMs: 1000 });
          else if (operation === 'fail')
            pending = queue.fail({
              ...lease,
              error: 'late failure',
              maxAttempts: 3,
            });
          else
            pending = queue.complete({
              ...lease,
              judgeResult: AC,
              verdicts: ['c1', 'c2'].map((id) =>
                passVerdict(submission.id, id),
              ),
            });
          pending.catch(() => {});
          await waitFor(async () => {
            if (wait === 'connection') return pool.waitingCount === 1;
            // The controlling transaction holds the row lock. Refresh its
            // statistics snapshot before observing another backend's wait.
            await control.query('SELECT pg_stat_clear_snapshot()');
            const result = await control.query(
              `SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'`,
              [schema],
            );
            return result.rowCount === 1;
          });
          time += 1001;
          if (held) {
            held.release();
            held = undefined;
          }
          if (locked) {
            await control.query('COMMIT');
            locked = false;
          }
          assert.equal(await pending, false);
          assert.equal(
            (await store.getSubmission(submission.id)).status,
            'judging',
          );
          assert.deepEqual(await store.listVerdicts(submission.id), []);
          const persisted = await control.query(
            'SELECT lease_token, lease_expires_at FROM jobs WHERE id = $1',
            [job.id],
          );
          assert.equal(persisted.rows[0].lease_token, job.leaseToken);
          assert.equal(
            persisted.rows[0].lease_expires_at.toISOString(),
            job.leaseExpiresAt,
          );
        } finally {
          if (held) held.release();
          if (locked) await control.query('ROLLBACK');
          await pending?.catch(() => {});
          await control.end();
          await pool.end();
        }
      });
    }
  }

  test('postgres store: database constraints reject invalid model call metrics', async () => {
    const schema = `${run}_metrics`;
    const { store } = makeFixture(
      { seed: createStoreSeed(), clock: at(OPEN) },
      schema,
    );
    const submission = await store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: '',
    });
    const db = new pg.Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await db.connect();
    try {
      const invalid = [
        [-1, 0, 0, 0],
        [0, -1, 0, 0],
        [0, 0, -1, 0],
        [0, 0, 0, -1],
        [0, 0, 0, 'NaN'],
        [0, 0, 0, 'Infinity'],
        [0, 0, 0, '-Infinity'],
      ];
      for (const metrics of invalid)
        await assert.rejects(
          db.query(
            `INSERT INTO model_calls (id, submission_id, constraint_ids, provider, model,
            request_id, input_tokens, output_tokens, latency_ms, cost_usd, outcome, created_at)
           VALUES ('invalid-log', $1, '[]', 'fake', 'fake', NULL, $2, $3, $4, $5, 'timeout', $6)`,
            [submission.id, ...metrics, OPEN],
          ),
          { code: '23514' },
        );
      assert.equal((await db.query('SELECT * FROM model_calls')).rowCount, 0);
    } finally {
      await db.end();
    }
  });

  // A worker in another process claims a job and dies without completing or
  // failing it. After the lease expires another store recovers the job and
  // exactly one set of verdicts is stored. Wiring the real worker is PA03-T06.
  test('postgres store: a job held by a crashed process is recovered once', async () => {
    const schema = `${run}_crash`;
    const { store } = makeFixture(
      { seed: createStoreSeed(), clock: at(OPEN) },
      schema,
    );
    const submission = await store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: 'int main() {}',
    });
    const storeModule = new URL(
      '../../dist/db/postgres/index.js',
      import.meta.url,
    ).href;
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          const { createPostgresStore } = await import(${JSON.stringify(storeModule)});
          const { store } = createPostgresStore({
            connectionString: process.env.TEST_DATABASE_URL,
            schema: ${JSON.stringify(schema)},
            clock: () => new Date(${JSON.stringify(OPEN)}),
          });
          const job = await store.claim({ workerId: 'worker-crashed', leaseMs: 30000, maxAttempts: 3 });
          process.stdout.write(JSON.stringify(job));
          process.exit(137); // crash: no complete, no fail, no close
        `,
      ],
      { env: process.env, encoding: 'utf8' },
    );
    assert.equal(child.status, 137, child.stderr);
    const crashed = JSON.parse(child.stdout);
    assert.equal(crashed.submissionId, submission.id);
    assert.equal((await store.getSubmission(submission.id)).status, 'judging');

    // Still leased: nobody else can take it.
    assert.equal(
      await store.claim({
        workerId: 'worker-new',
        leaseMs: 30_000,
        maxAttempts: 3,
      }),
      undefined,
    );
    // After the lease, a new store in this test process recovers it.
    const recovered = makeFixture(
      { clock: at('2026-11-09T10:00:31.000Z') },
      schema,
    );
    const job = await recovered.store.claim({
      workerId: 'worker-new',
      leaseMs: 30_000,
      maxAttempts: 3,
    });
    assert.equal(job.id, crashed.id);
    assert.equal(job.attempts, 2);
    const verdicts = [
      passVerdict(submission.id, 'c1'),
      passVerdict(submission.id, 'c2'),
    ];
    assert.equal(
      await recovered.store.complete({
        jobId: crashed.id,
        leaseToken: crashed.leaseToken,
        judgeResult: AC,
        verdicts,
      }),
      false,
    );
    assert.equal(
      await recovered.store.complete({
        jobId: job.id,
        leaseToken: job.leaseToken,
        judgeResult: AC,
        verdicts,
      }),
      true,
    );
    assert.equal((await recovered.store.listVerdicts(submission.id)).length, 2);
  });

  // Holds the lab row lock the way publishLab does, publishes, then commits.
  // A review that started meanwhile must wait and then see the publication.
  const reviewRacesPublish = (name, review) =>
    test(`postgres store: ${name} waits for a concurrent Publish`, async () => {
      const schema = `${run}_race_${name.toLowerCase().replace(/\W+/g, '_')}`;
      const { store } = makeFixture(
        { seed: createStoreSeed(), clock: at(OPEN) },
        schema,
      );
      const submission = await store.submit({
        labId: 'lab-sort',
        studentId: 'student-1',
        code: 'int main() {}',
      });
      const job = await store.claim({
        workerId: 'worker-a',
        leaseMs: 60_000,
        maxAttempts: 3,
      });
      await store.complete({
        jobId: job.id,
        leaseToken: job.leaseToken,
        judgeResult: AC,
        verdicts: [
          passVerdict(submission.id, 'c1'),
          passVerdict(submission.id, 'c2'),
        ],
      });
      const [item] = await store.listReviewQueue('lab-sort');

      const publisher = new pg.Client({
        connectionString: url,
        options: `-c search_path=${schema}`,
      });
      await publisher.connect();
      let pending;
      let committed = false;
      try {
        await publisher.query('BEGIN');
        await publisher.query('SELECT 1 FROM labs WHERE id = $1 FOR UPDATE', [
          'lab-sort',
        ]);
        let settled = false;
        pending = review(store, item).finally(() => {
          settled = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        assert.equal(settled, false, 'the review must wait for the lab lock');
        await publisher.query(
          `INSERT INTO publications (lab_id, published_at, published_by,
             queue_item_count, pass_decision_count, violation_decision_count)
           VALUES ($1, $2, $3, 2, 0, 0)`,
          ['lab-sort', '2026-11-09T15:00:00.000Z', 'ta-1'],
        );
        await publisher.query('COMMIT');
        committed = true;
      } finally {
        // Never leave the lab locked, even when an assertion above fails.
        if (!committed) await publisher.query('ROLLBACK').catch(() => {});
        await publisher.end().catch(() => {});
        if (!committed) await pending?.catch(() => {});
      }

      const result = await pending;
      assert.ok(result === undefined || result === 0);
      assert.equal((await store.getReviewItem(item.id)).taDecision, null);
      assert.deepEqual(await store.listDecisionLog(item.id), []);
    });

  reviewRacesPublish('decide', (store, item) =>
    store.decide({ itemId: item.id, decision: 'violation', taId: 'ta-1' }),
  );
  reviewRacesPublish('confirmPasses', (store) =>
    store.confirmPasses({ labId: 'lab-sort', taId: 'ta-1' }),
  );

  test('postgres store: concurrent workers claim different jobs', async () => {
    const { store } = makeFixture({ seed: createStoreSeed(), clock: at(OPEN) });
    for (const studentId of ['student-1', 'student-2'])
      await store.submit({ labId: 'lab-sort', studentId, code: '' });
    const claims = await Promise.all(
      ['worker-a', 'worker-b', 'worker-c'].map((workerId) =>
        store.claim({ workerId, leaseMs: 60_000, maxAttempts: 3 }),
      ),
    );
    const claimed = claims.filter(Boolean).map((job) => job.id);
    assert.equal(claimed.length, 2);
    assert.equal(new Set(claimed).size, 2);
  });

  test('postgres store: a concurrent publish creates one publication', async () => {
    const { store } = makeFixture({
      seed: createStoreSeed(),
      clock: at('2026-11-09T15:00:00.000Z'),
    });
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        store.publishLab({ labId: 'lab-sort', publishedBy: 'ta-1' }),
      ),
    );
    assert.deepEqual(results.map((r) => r.kind).sort(), [
      'already_published',
      'already_published',
      'published',
    ]);
  });
}
