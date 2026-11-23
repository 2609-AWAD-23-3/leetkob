// PA03-T10: checker với model tắt trên dev set, chấm bằng `leetkob-eval/eval.mjs` (bản gốc).
// Rubric: eval.mjs phải exit 0 hoặc 1, không bao giờ 2; lần chạy model-off có 0 khấu trừ sai
// và quyết định mọi cặp ban-list. Offline: không network, không Docker.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const NO_NETWORK = new URL('../support/no-network.mjs', import.meta.url).href;

const offEnv = () => {
  const env = { ...process.env, MODEL_OFF: '1' };
  delete env.MODEL_API_KEY;
  return env;
};

const checkAndScore = (t, data) => {
  const dir = mkdtempSync(join(tmpdir(), 'leetkob-eval-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const predictions = join(dir, 'predictions.jsonl');
  const checker = spawnSync(
    process.execPath,
    ['--import', NO_NETWORK, 'dist/cli/checker.js', data, '--out', predictions],
    { encoding: 'utf8', env: offEnv() },
  );
  assert.equal(checker.status, 0, checker.stderr);
  const summaryPath = join(dir, 'summary.json');
  const evalRun = spawnSync(
    process.execPath,
    [
      'leetkob-eval/eval.mjs',
      '--data',
      data,
      '--predictions',
      predictions,
      '--json',
      summaryPath,
    ],
    { encoding: 'utf8' },
  );
  return {
    evalRun,
    summary:
      evalRun.status === 2
        ? null
        : JSON.parse(readFileSync(summaryPath, 'utf8')),
    predictions: readFileSync(predictions, 'utf8')
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line)),
  };
};

const banListPairs = (data) => {
  const pairs = new Set();
  const labels = readFileSync(join(data, 'labels.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  for (const { solution, constraint } of labels) {
    const [pid] = solution.split('/');
    const constraints = JSON.parse(
      readFileSync(join(data, 'problems', pid, 'constraints.json'), 'utf8'),
    );
    const text = constraints.find((c) => c.id === constraint).text;
    if (/^Do not (use|call)\b/.test(text))
      pairs.add(`${solution} ${constraint}`);
  }
  return pairs;
};

test('dev set, MODEL_OFF=1: eval.mjs accepts the file (exit 0 or 1), 0 wrongful, every ban-list pair decided', (t) => {
  const { evalRun, summary, predictions } = checkAndScore(t, 'leetkob-eval');
  assert.ok([0, 1].includes(evalRun.status), evalRun.stdout + evalRun.stderr);
  assert.equal(summary.pairs, 102);
  assert.equal(summary.missing, 0);
  assert.equal(summary.wrongful, 0, summary.wrongfulPairs.join('\n'));
  const ban = banListPairs('leetkob-eval');
  const undecided = predictions.filter(
    (p) => ban.has(`${p.solution} ${p.constraint}`) && p.verdict === 'unsure',
  );
  assert.deepEqual(undecided, []);
  const semanticDecided = predictions.filter(
    (p) => !ban.has(`${p.solution} ${p.constraint}`) && p.verdict !== 'unsure',
  );
  assert.deepEqual(semanticDecided, []);
});

test('eval-cases, MODEL_OFF=1: eval.mjs accepts the file (exit 0 or 1) with 0 wrongful deductions', (t) => {
  const { evalRun, summary } = checkAndScore(t, 'eval-cases');
  assert.ok([0, 1].includes(evalRun.status), evalRun.stdout + evalRun.stderr);
  assert.equal(summary.missing, 0);
  assert.equal(summary.wrongful, 0, summary.wrongfulPairs.join('\n'));
});
