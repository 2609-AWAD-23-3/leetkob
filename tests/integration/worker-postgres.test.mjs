import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import pg from 'pg';
import { createStoreSeed } from '../../dist/db/index.js';
import { createPostgresStore } from '../../dist/db/postgres/index.js';

const url = process.env.TEST_DATABASE_URL;
const workerEntry = new URL('../../dist/worker/index.js', import.meta.url)
  .pathname;

if (!url) {
  test(
    'worker postgres integration tests',
    { skip: 'TEST_DATABASE_URL is not set' },
    () => {},
  );
} else {
  const run = `tw_${process.pid}_${Date.now().toString(36)}`;
  const schemas = [];
  const fixtures = [];
  let counter = 0;

  const makeFixture = (options = {}, schema = `${run}_${++counter}`) => {
    if (!schemas.includes(schema)) {
      schemas.push(schema);
    }
    const fixture = createPostgresStore({
      connectionString: url,
      schema,
      ...options,
    });
    fixtures.push(fixture);
    return { schema, fixture };
  };

  after(async () => {
    await Promise.allSettled(fixtures.map((f) => f.store.close()));
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    for (const schema of schemas) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
    await admin.end();
  });

  function getWorkerScriptPath() {
    // Use file path resolved from URL on all platforms (strip leading slash before drive letter on Windows).
    return process.platform === 'win32' && /^\/[A-Za-z]:/.test(workerEntry)
      ? workerEntry.slice(1)
      : workerEntry;
  }

  function spawnWorkerProcess(extraEnv) {
    return spawnSync(process.execPath, [getWorkerScriptPath()], {
      env: {
        ...process.env,
        DATABASE_URL: url,
        ...extraEnv,
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
  }

  const SIMULATED_AC_ENV = {
    WORKER_ALLOW_SIMULATED_JUDGE: '1',
    WORKER_SIMULATE_JUDGE_VERDICT: 'AC',
  };

  const OPEN = '2026-11-09T10:00:00.000Z';
  const at = (iso) => () => new Date(iso);

  test('fail-closed: default runtime worker process refuses to run without judge adapter and leaves submission queued', async () => {
    const { schema, fixture } = makeFixture({
      seed: createStoreSeed(),
      clock: at(OPEN),
    });
    await fixture.ready;

    const invalidSub = await fixture.store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: 'this is deliberately not valid C++',
    });

    const proc = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-fail-closed',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: OPEN,
    });
    assert.notEqual(proc.status, 0);
    // PA03-T11 wired real sandbox + semantic model into default worker mode, so
    // starting without MODEL_API_KEY fails closed with ModelConfigError.
    assert.match(proc.stderr, /MODEL_API_KEY|requires a real judge adapter/i);

    const saved = await fixture.store.getSubmission(invalidSub.id);
    assert.equal(saved?.status, 'queued');
    assert.equal(saved?.judgeResult, null);
    assert.equal((await fixture.store.listVerdicts(invalidSub.id)).length, 0);
  });

  test('separate worker process: stop, submit, start and restart stores exactly one verdict set in Postgres', async () => {
    const { schema, fixture } = makeFixture({
      seed: createStoreSeed(),
      clock: at(OPEN),
    });
    await fixture.ready;

    // 1. Start and stop separate worker process before submissions arrive.
    const w1 = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-stop',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: OPEN,
      ...SIMULATED_AC_ENV,
    });
    assert.equal(w1.status, 0, w1.stderr);

    // 2. Submit while no worker is running.
    const submission = await fixture.store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: [
        '#include <algorithm>',
        '#include <vector>',
        'int main() {',
        '  std::vector<int> v = {3, 1, 2};',
        '  std::sort(v.begin(), v.end());',
        '  return 0;',
        '}',
        '',
      ].join('\n'),
    });
    assert.equal(
      (await fixture.store.getSubmission(submission.id))?.status,
      'queued',
    );

    // 3. Start separate worker process to process queued submission.
    const w2 = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-start',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: '2026-11-09T10:00:05.000Z',
      ...SIMULATED_AC_ENV,
    });
    assert.equal(w2.status, 0, w2.stderr);

    const judged = await fixture.store.getSubmission(submission.id);
    assert.equal(judged?.status, 'judged');
    assert.equal(judged?.judgeResult?.verdict, 'AC');

    const db = new pg.Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await db.connect();
    try {
      const verdictCountRes = await db.query(
        'SELECT COUNT(*)::int AS cnt FROM verdicts WHERE submission_id = $1',
        [submission.id],
      );
      assert.equal(verdictCountRes.rows[0]?.cnt, 2);

      const verdicts = await fixture.store.listVerdicts(submission.id);
      const c1 = verdicts.find((v) => v.constraintId === 'c1');
      assert.equal(c1?.verdict, 'violation');
      assert.equal(c1?.source, 'hard_rule');
      assert.equal(c1?.evidence[0]?.line, 5);

      // 4. Restart separate worker process again: still exactly one verdict set and job done.
      const w3 = spawnWorkerProcess({
        DATABASE_SCHEMA: schema,
        WORKER_ID: 'proc-restart',
        WORKER_EXIT_WHEN_IDLE: '1',
        WORKER_CLOCK_ISO: '2026-11-09T10:00:10.000Z',
        ...SIMULATED_AC_ENV,
      });
      assert.equal(w3.status, 0, w3.stderr);

      const afterRestartCount = await db.query(
        'SELECT COUNT(*)::int AS cnt FROM verdicts WHERE submission_id = $1',
        [submission.id],
      );
      assert.equal(afterRestartCount.rows[0]?.cnt, 2);

      const jobsRes = await db.query(
        'SELECT done, attempts FROM jobs WHERE submission_id = $1',
        [submission.id],
      );
      assert.equal(jobsRes.rows[0]?.done, true);
      assert.equal(jobsRes.rows[0]?.attempts, 1);
    } finally {
      await db.end();
    }
  });

  test('separate worker process stays alive across empty-queue idle timeout and processes later submission', async () => {
    const { schema, fixture } = makeFixture({
      seed: createStoreSeed(),
      clock: at(OPEN),
    });
    await fixture.ready;

    // Poll interval (1800ms) is longer than pg.Pool's idleTimeoutMillis (1000ms).
    const daemon = spawn(process.execPath, [getWorkerScriptPath()], {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DATABASE_SCHEMA: schema,
        WORKER_ID: 'proc-daemon',
        WORKER_POLL_INTERVAL_MS: '1800',
        WORKER_EXIT_WHEN_IDLE: '0',
        WORKER_CLOCK_ISO: OPEN,
        ...SIMULATED_AC_ENV,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stderrChunks = [];
    daemon.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    try {
      // Wait well past Postgres pool idleTimeoutMillis (1000ms) and one full poll cycle (1800ms).
      await new Promise((resolve) => setTimeout(resolve, 2500));
      assert.equal(
        daemon.exitCode,
        null,
        `Worker exited unexpectedly: ${Buffer.concat(stderrChunks).toString('utf8')}`,
      );

      // Submit a new job while the background daemon worker is idling.
      const submission = await fixture.store.submit({
        labId: 'lab-sort',
        studentId: 'student-1',
        code: 'int main() { return 0; }\n',
      });

      let saved;
      for (let i = 0; i < 60; i += 1) {
        saved = await fixture.store.getSubmission(submission.id);
        if (saved?.status === 'judged') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      assert.equal(
        saved?.status,
        'judged',
        `Background worker did not claim submission within timeout; stderr=${Buffer.concat(stderrChunks).toString('utf8')}`,
      );
      assert.equal((await fixture.store.listVerdicts(submission.id)).length, 2);
      assert.equal(daemon.exitCode, null);
    } finally {
      if (daemon.exitCode === null) {
        const closed = new Promise((resolve) => {
          daemon.once('close', resolve);
        });
        daemon.kill('SIGTERM');
        const timeout = new Promise((resolve) => {
          setTimeout(() => {
            if (daemon.exitCode === null) {
              daemon.kill('SIGKILL');
            }
            resolve();
          }, 1500);
        });
        await Promise.race([closed, timeout]);
      }
    }
  });

  test('separate worker process crash mid-job is recovered after lease expiry without duplicate verdicts', async () => {
    const { schema, fixture } = makeFixture({
      seed: createStoreSeed(),
      clock: at(OPEN),
    });
    await fixture.ready;

    const submission = await fixture.store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: 'int main() { return 0; }\n',
    });

    // Worker 1 claims and crashes abruptly (exit 137) without complete/fail.
    const crashed = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-crash',
      WORKER_LEASE_MS: '30000',
      WORKER_MAX_ATTEMPTS: '3',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: OPEN,
      WORKER_SIMULATE_CRASH_AFTER_CLAIM: '1',
    });
    assert.equal(crashed.status, 137, crashed.stderr);
    const crashEvent = JSON.parse(crashed.stdout.trim());
    assert.equal(crashEvent.event, 'crash_after_claim');
    assert.equal(crashEvent.attempts, 1);

    assert.equal(
      (await fixture.store.getSubmission(submission.id))?.status,
      'judging',
    );
    assert.equal((await fixture.store.listVerdicts(submission.id)).length, 0);

    // Worker 2 starts before lease expiry: job stays leased to crashed worker.
    const early = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-early',
      WORKER_LEASE_MS: '30000',
      WORKER_MAX_ATTEMPTS: '3',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: '2026-11-09T10:00:15.000Z',
      ...SIMULATED_AC_ENV,
    });
    assert.equal(early.status, 0, early.stderr);
    assert.equal(
      (await fixture.store.getSubmission(submission.id))?.status,
      'judging',
    );

    // Worker 3 starts after 30s lease expiry: recovers job and writes exactly one verdict set.
    const recovered = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-recover',
      WORKER_LEASE_MS: '30000',
      WORKER_MAX_ATTEMPTS: '3',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: '2026-11-09T10:00:31.000Z',
      ...SIMULATED_AC_ENV,
    });
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.equal(
      (await fixture.store.getSubmission(submission.id))?.status,
      'judged',
    );
    assert.equal((await fixture.store.listVerdicts(submission.id)).length, 2);

    const db = new pg.Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await db.connect();
    try {
      const jobsRes = await db.query(
        'SELECT done, attempts FROM jobs WHERE submission_id = $1',
        [submission.id],
      );
      assert.equal(jobsRes.rows[0]?.done, true);
      assert.equal(jobsRes.rows[0]?.attempts, 2);
    } finally {
      await db.end();
    }
  });

  test('separate worker process retries failed attempt and stores zero verdicts for non-AC (FAQ-04)', async () => {
    const { schema, fixture } = makeFixture({
      seed: createStoreSeed(),
      clock: at(OPEN),
    });
    await fixture.ready;

    const submission = await fixture.store.submit({
      labId: 'lab-sort',
      studentId: 'student-1',
      code: 'int main() { return 0; }\n',
    });

    // Attempt 1 throws transient error via fail(), returning submission to queued.
    const wFail = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-fail-once',
      WORKER_MAX_ATTEMPTS: '3',
      WORKER_MAX_JOBS: '1',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: OPEN,
      WORKER_SIMULATE_FAIL_ERROR: 'transient sandbox error',
    });
    assert.equal(wFail.status, 0, wFail.stderr);
    assert.equal(
      (await fixture.store.getSubmission(submission.id))?.status,
      'queued',
    );

    const db = new pg.Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await db.connect();
    try {
      const midJob = await db.query(
        'SELECT attempts, done, last_error FROM jobs WHERE submission_id = $1',
        [submission.id],
      );
      assert.equal(midJob.rows[0]?.attempts, 1);
      assert.equal(midJob.rows[0]?.done, false);
      assert.equal(midJob.rows[0]?.last_error, 'transient sandbox error');
    } finally {
      await db.end();
    }

    // Attempt 2 completes submission as AC.
    const wRecover = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-retry-ok',
      WORKER_MAX_ATTEMPTS: '3',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: '2026-11-09T10:00:05.000Z',
      ...SIMULATED_AC_ENV,
    });
    assert.equal(wRecover.status, 0, wRecover.stderr);
    assert.equal(
      (await fixture.store.getSubmission(submission.id))?.status,
      'judged',
    );
    assert.equal((await fixture.store.listVerdicts(submission.id)).length, 2);

    // Submit non-AC submission and process in separate worker process -> 0 verdicts stored.
    const subWa = await fixture.store.submit({
      labId: 'lab-sort',
      studentId: 'student-2',
      code: 'int main() { return 1; }\n',
    });
    const wWa = spawnWorkerProcess({
      DATABASE_SCHEMA: schema,
      WORKER_ID: 'proc-wa',
      WORKER_EXIT_WHEN_IDLE: '1',
      WORKER_CLOCK_ISO: '2026-11-09T10:00:10.000Z',
      WORKER_ALLOW_SIMULATED_JUDGE: '1',
      WORKER_SIMULATE_JUDGE_VERDICT: 'WA',
    });
    assert.equal(wWa.status, 0, wWa.stderr);
    const savedWa = await fixture.store.getSubmission(subWa.id);
    assert.equal(savedWa?.status, 'judged');
    assert.equal(savedWa?.judgeResult?.verdict, 'WA');
    assert.equal((await fixture.store.listVerdicts(subWa.id)).length, 0);
  });
}
