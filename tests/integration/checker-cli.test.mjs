// PA03-T10: lệnh checker chạy như người chấm chạy (process riêng, dist/cli/checker.js).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writeDataset } from '../support/checker-dataset.mjs';

const CHECKER = 'dist/cli/checker.js';
const NO_NETWORK = new URL('../support/no-network.mjs', import.meta.url).href;

const cleanEnv = (extra = {}) => {
  const env = { ...process.env };
  delete env.MODEL_API_KEY;
  delete env.ANTHROPIC_API_KEY;
  delete env.MODEL_OFF;
  return { ...env, ...extra };
};

const runChecker = (args, env) =>
  spawnSync(process.execPath, ['--import', NO_NETWORK, CHECKER, ...args], {
    encoding: 'utf8',
    env,
  });

const tempDir = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'leetkob-checker-out-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const dataset = (t, options) => {
  const ds = writeDataset(options);
  t.after(ds.cleanup);
  return ds.root;
};

test('MODEL_OFF=1 writes predictions without a key and without opening the network', async (t) => {
  const root = dataset(t);
  const out = join(tempDir(t), 'predictions.jsonl');
  const res = runChecker([root, '--out', out], cleanEnv({ MODEL_OFF: '1' }));
  assert.equal(res.status, 0, res.stderr);
  assert.doesNotMatch(res.stderr, /NETWORK BLOCKED/);
  const lines = readFileSync(out, 'utf8').trimEnd().split('\n');
  assert.equal(lines.length, 5);
  assert.match(res.stderr, /MODEL_OFF=1/);
});

test('the checker needs only statement.md, constraints.json and solutions/', async (t) => {
  const full = dataset(t);
  const bare = dataset(t, { withLabels: false, withTests: false });
  const dir = tempDir(t);
  const env = cleanEnv({ MODEL_OFF: '1' });
  assert.equal(
    runChecker([full, '--out', join(dir, 'a.jsonl')], env).status,
    0,
  );
  assert.equal(
    runChecker([bare, '--out', join(dir, 'b.jsonl')], env).status,
    0,
  );
  assert.equal(
    readFileSync(join(dir, 'a.jsonl'), 'utf8'),
    readFileSync(join(dir, 'b.jsonl'), 'utf8'),
  );
});

test('--data is accepted as well as a positional dataset folder', async (t) => {
  const root = dataset(t);
  const out = join(tempDir(t), 'p.jsonl');
  const res = runChecker(
    ['--data', root, '--out', out],
    cleanEnv({ MODEL_OFF: '1' }),
  );
  assert.equal(res.status, 0, res.stderr);
  assert.ok(existsSync(out));
});

test('--call-log writes one decision per pair and records model_off', async (t) => {
  const root = dataset(t);
  const dir = tempDir(t);
  const res = runChecker(
    [
      root,
      '--out',
      join(dir, 'p.jsonl'),
      '--call-log',
      join(dir, 'calls.jsonl'),
    ],
    cleanEnv({ MODEL_OFF: '1' }),
  );
  assert.equal(res.status, 0, res.stderr);
  const log = readFileSync(join(dir, 'calls.jsonl'), 'utf8')
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line));
  const decisions = log.filter((e) => e.type === 'decision');
  assert.equal(decisions.length, 5);
  assert.equal(
    decisions.filter((e) => e.unsureCause === 'model_off').length,
    2,
  );
  assert.equal(log.filter((e) => e.type === 'model_call').length, 0);
});

test('without MODEL_OFF=1 and without MODEL_API_KEY the checker stops with exit 2 and writes nothing', async (t) => {
  const root = dataset(t);
  const out = join(tempDir(t), 'p.jsonl');
  const res = runChecker([root, '--out', out], cleanEnv());
  assert.equal(res.status, 2);
  assert.match(res.stderr, /MODEL_API_KEY/);
  assert.match(res.stderr, /MODEL_OFF=1/);
  assert.equal(existsSync(out), false);
});

// Vượng chốt 23/11: mặc định ghi prediction ra stdout để người chấm lấy file bằng redirect
// của shell, không cần mount thư mục output (không phụ thuộc uid, capability hay quyền thư mục).
// Vì vậy thiếu `--out` không còn là lỗi tham số.
test('without --out (or with --out -) predictions go to stdout and logs stay on stderr', async (t) => {
  const root = dataset(t);
  const file = join(tempDir(t), 'p.jsonl');
  const env = cleanEnv({ MODEL_OFF: '1' });
  const toFile = runChecker([root, '--out', file], env);
  assert.equal(toFile.status, 0, toFile.stderr);
  assert.equal(toFile.stdout, '');
  const expected = readFileSync(file, 'utf8');
  for (const args of [[root], [root, '--out', '-']]) {
    const res = runChecker(args, env);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout, expected, args.join(' '));
    for (const line of res.stdout.trimEnd().split('\n')) JSON.parse(line);
    assert.match(res.stderr, /MODEL_OFF=1/);
    assert.match(res.stderr, /wrote predictions to stdout/);
  }
});

test('a failed run writes nothing to stdout', async (t) => {
  const root = dataset(t);
  const res = runChecker([join(root, 'missing')], cleanEnv({ MODEL_OFF: '1' }));
  assert.equal(res.status, 2);
  assert.equal(res.stdout, '');
});

test('usage errors exit 2: no dataset, unknown flag, missing folder, bad MODEL_OFF or concurrency', async (t) => {
  const root = dataset(t);
  const out = join(tempDir(t), 'p.jsonl');
  const off = cleanEnv({ MODEL_OFF: '1' });
  for (const [args, env] of [
    [['--out', out], off],
    [[root, '--out', out, '--fast'], off],
    [[join(root, 'missing'), '--out', out], off],
    [[root, '--out', out], cleanEnv({ MODEL_OFF: 'maybe' })],
    [[root, '--out', out, '--concurrency', '0'], off],
  ]) {
    const res = runChecker(args, env);
    assert.equal(res.status, 2, `${args.join(' ')}\n${res.stderr}`);
    assert.match(res.stderr, /usage|MODEL_OFF|dataset|concurrency/i);
  }
  assert.equal(existsSync(out), false);
});
