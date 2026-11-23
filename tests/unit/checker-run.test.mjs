// PA03-T10: lõi checker (đọc dataset, hard rules, model tắt/bật, call log). Model giả, không network.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DatasetError, readDataset } from '../../dist/cli/dataset.js';
import { formatJsonl, runChecker } from '../../dist/cli/run.js';
import { ModelProviderError } from '../../dist/pipeline/model/index.js';
import { writeDataset } from '../support/checker-dataset.mjs';
import {
  createFakeModel,
  okCompletion,
  result,
} from '../support/model-fakes.mjs';

const withDataset = async (t, options) => {
  const ds = writeDataset(options);
  t.after(ds.cleanup);
  return { root: ds.root, problems: await readDataset(ds.root) };
};

const pairs = (predictions) =>
  predictions.map((p) => `${p.solution} ${p.constraint}`);

test('dataset: problems and .cpp solutions are read in a fixed order with problem/sNN ids', async (t) => {
  const { problems } = await withDataset(t);
  assert.deepEqual(
    problems.map((p) => p.id),
    ['abs-max', 'odd-sum'],
  );
  const odd = problems[1];
  assert.match(odd.statement, /sum of the odd ones/);
  assert.deepEqual(
    odd.constraints.map((c) => c.id),
    ['C1', 'C2'],
  );
  assert.deepEqual(
    odd.solutions.map((s) => s.id),
    ['odd-sum/s01', 'odd-sum/s02'],
  );
  assert.match(odd.solutions[0].code, /std::accumulate/);
});

test('dataset: a broken constraints.json or a missing problems folder is a DatasetError', async (t) => {
  const { root } = await withDataset(t);
  writeFileSync(join(root, 'problems', 'odd-sum', 'constraints.json'), '{oops');
  await assert.rejects(readDataset(root), (error) => {
    assert.ok(error instanceof DatasetError);
    assert.match(error.message, /odd-sum[\\/]constraints\.json/);
    return true;
  });
  await assert.rejects(readDataset(join(root, 'nope')), DatasetError);
});

test('dataset: a constraint without a string id and text is a DatasetError', async (t) => {
  const { root } = await withDataset(t);
  writeFileSync(
    join(root, 'problems', 'abs-max', 'constraints.json'),
    JSON.stringify([{ id: 'C1' }]),
  );
  await assert.rejects(readDataset(root), DatasetError);
});

test('model off: ban lists are decided by hard rules with original lines; semantic pairs are unsure', async (t) => {
  const { problems } = await withDataset(t);
  const { predictions, callLog } = await runChecker({
    problems,
    modelOff: true,
  });
  assert.deepEqual(pairs(predictions), [
    'abs-max/s01 C1',
    'odd-sum/s01 C1',
    'odd-sum/s01 C2',
    'odd-sum/s02 C1',
    'odd-sum/s02 C2',
  ]);
  const by = Object.fromEntries(
    predictions.map((p) => [`${p.solution} ${p.constraint}`, p]),
  );
  assert.deepEqual(by['odd-sum/s01 C1'], {
    solution: 'odd-sum/s01',
    constraint: 'C1',
    verdict: 'violation',
    evidence: [
      {
        line: 7,
        text: '    std::cout << std::accumulate(v.begin(), v.end(), 0LL) << "\\n";',
      },
    ],
  });
  // Trap: tên cấm chỉ trong comment và string.
  assert.equal(by['odd-sum/s02 C1'].verdict, 'pass');
  assert.equal(by['abs-max/s01 C1'].verdict, 'pass');
  for (const key of ['odd-sum/s01 C2', 'odd-sum/s02 C2']) {
    assert.deepEqual(by[key].evidence, []);
    assert.equal(by[key].verdict, 'unsure');
  }
  assert.equal(callLog.filter((e) => e.type === 'model_call').length, 0);
  const off = callLog.filter((e) => e.route === 'model_off');
  assert.deepEqual(
    off.map((e) => [e.solution, e.constraint, e.unsureCause, e.modelCalled]),
    [
      ['odd-sum/s01', 'C2', 'model_off', false],
      ['odd-sum/s02', 'C2', 'model_off', false],
    ],
  );
  const hard = callLog.filter((e) => e.route === 'hard_rule');
  assert.equal(hard.length, 3);
  assert.ok(hard.every((e) => e.modelCalled === false));
});

test('model off wins: a model passed in is never called', async (t) => {
  const { problems } = await withDataset(t);
  const fake = createFakeModel(() => {
    throw new Error('the model must not be called when MODEL_OFF=1');
  });
  const out = await runChecker({
    problems,
    modelOff: true,
    model: { client: fake, timeoutMs: 1_000 },
  });
  assert.equal(fake.calls.length, 0);
  assert.equal(out.predictions.length, 5);
});

test('model on: one call per solution with semantic constraints, prompt logged with dataset identity', async (t) => {
  const { problems } = await withDataset(t);
  const fake = createFakeModel((request) =>
    /s \+= x/.test(request.user)
      ? okCompletion([result('C2', 'pass')], { requestId: 'req_pass' })
      : okCompletion([result('C2', 'violation', [5])], {
          requestId: 'req_viol',
        }),
  );
  const { predictions, callLog } = await runChecker({
    problems,
    modelOff: false,
    model: { client: fake, timeoutMs: 1_000 },
  });
  // abs-max chỉ có ban list: không gọi model.
  assert.equal(fake.calls.length, 2);
  for (const call of fake.calls) {
    assert.doesNotMatch(call.user, /not std::accumulate: a plain loop/);
    assert.doesNotMatch(call.user, /"id":"C1"/);
  }
  const by = Object.fromEntries(
    predictions.map((p) => [`${p.solution} ${p.constraint}`, p]),
  );
  assert.deepEqual(by['odd-sum/s01 C2'].evidence, [
    {
      line: 5,
      text: '  int n; std::cin >> n; std::vector<long long> v(n);',
    },
  ]);
  assert.equal(by['odd-sum/s01 C2'].verdict, 'violation');
  assert.equal(by['odd-sum/s02 C2'].verdict, 'pass');
  const calls = callLog.filter((e) => e.type === 'model_call');
  assert.deepEqual(
    calls.map((c) => [c.solution, c.requestId, c.outcome, c.identity]),
    [
      ['odd-sum/s01', 'req_viol', 'ok', 'none:dataset'],
      ['odd-sum/s02', 'req_pass', 'ok', 'none:dataset'],
    ],
  );
  for (const call of calls) {
    for (const field of [
      'provider',
      'model',
      'inputTokens',
      'outputTokens',
      'latencyMs',
      'costUsd',
      'promptSha256',
      'system',
      'user',
    ]) {
      assert.ok(field in call, field);
    }
    assert.deepEqual(call.constraintIds, ['C2']);
  }
});

test('model on: a provider error makes that solution unsure, is logged, and the run continues', async (t) => {
  const { problems } = await withDataset(t);
  const fake = createFakeModel((request) => {
    if (/s \+= x/.test(request.user)) {
      throw new ModelProviderError('overloaded', {
        status: 529,
        requestId: 'req_err',
      });
    }
    return okCompletion([result('C2', 'violation', [5])]);
  });
  const { predictions, callLog } = await runChecker({
    problems,
    modelOff: false,
    model: { client: fake, timeoutMs: 1_000 },
  });
  const s02 = predictions.find(
    (p) => p.solution === 'odd-sum/s02' && p.constraint === 'C2',
  );
  assert.deepEqual(
    { verdict: s02.verdict, evidence: s02.evidence },
    { verdict: 'unsure', evidence: [] },
  );
  const s01 = predictions.find(
    (p) => p.solution === 'odd-sum/s01' && p.constraint === 'C2',
  );
  assert.equal(s01.verdict, 'violation');
  const failed = callLog.find(
    (e) => e.type === 'model_call' && e.solution === 'odd-sum/s02',
  );
  assert.equal(failed.outcome, 'provider_error');
  assert.equal(failed.requestId, 'req_err');
  const decision = callLog.find(
    (e) =>
      e.type === 'decision' &&
      e.solution === 'odd-sum/s02' &&
      e.constraint === 'C2',
  );
  // Hướng A (Vượng chốt 23/11): lý do nằm ở `unsureCause` như mọi `unsure` khác,
  // giá trị `provider_error` chỉ có trong call log của checker; không còn trường `cause`.
  assert.equal(decision.unsureCause, 'provider_error');
  assert.equal('cause' in decision, false);
  assert.equal(decision.verdict, 'unsure');
  for (const entry of callLog) {
    if (entry.type === 'decision' && entry.verdict === 'unsure') {
      assert.notEqual(entry.unsureCause, null, JSON.stringify(entry));
    }
  }
});

test('output order does not depend on concurrency or model latency', async (t) => {
  const { problems } = await withDataset(t);
  const run = async (concurrency) => {
    let n = 0;
    const fake = createFakeModel(async () => {
      n += 1;
      await new Promise((resolve) => setTimeout(resolve, n % 2 ? 15 : 1));
      return okCompletion([result('C2', 'pass')]);
    });
    const out = await runChecker({
      problems,
      modelOff: false,
      concurrency,
      model: { client: fake, timeoutMs: 1_000 },
    });
    return formatJsonl(out.predictions);
  };
  assert.equal(await run(1), await run(4));
});

test('formatJsonl writes one JSON object per line with exactly the prediction fields', async (t) => {
  const { problems } = await withDataset(t);
  const { predictions } = await runChecker({ problems, modelOff: true });
  const text = formatJsonl(predictions);
  assert.ok(text.endsWith('\n'));
  const lines = text.trimEnd().split('\n');
  assert.equal(lines.length, 5);
  for (const line of lines) {
    assert.deepEqual(Object.keys(JSON.parse(line)), [
      'solution',
      'constraint',
      'verdict',
      'evidence',
    ]);
  }
});
