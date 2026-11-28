// PA04-T08: chạy checker image như người chấm sẽ chạy lần held-out, rồi chấm bằng eval.mjs.
//
// - Container checker nằm trong một mạng Docker `--internal`: không ra được Internet.
// - Một container proxy (scripts/held-out-proxy.mjs, chạy bằng base image của checker) nối cả mạng
//   đó và mạng thường, chỉ cho CONNECT tới api.anthropic.com:443.
// - Checker nhận key qua `--env-file` và proxy qua `HTTPS_PROXY`; script KHÔNG truyền
//   NODE_USE_ENV_PROXY, để kiểm đúng cấu hình nằm trong image.
//
// Trước khi chạy checker, script kiểm môi trường thử là đúng: từ mạng internal không gọi thẳng được
// model host, và proxy từ chối host khác. Sau đó checker phải ghi file hợp lệ (eval.mjs exit 0
// hoặc 1) và mọi model call trong call log phải `ok` với request id của provider.
//
// Cần Docker và một model key. Mặc định lấy MODEL_API_KEY và MODEL_TIMEOUT_MS từ `.env` vào một
// file env tạm (xoá khi xong); `--env-file <file>` dùng đúng file đó (ví dụ marking.env). Không in
// giá trị key. Gọi model thật nên tốn tiền (khoảng $0.006 cho eval-cases).
//
//   node scripts/test-held-out-proxy.mjs [--data eval-cases] [--out out/held-out-proxy] [--env-file <file>]
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const MODEL_HOST = 'api.anthropic.com:443';
const BASE_IMAGE = 'node:24.22.3-bookworm-slim';
const IMAGE = 'leetkob-checker:held-out-proxy';
const id = `${process.pid}`;
const NETWORK = `leetkob-heldout-${id}`;
const PROXY = `leetkob-heldout-proxy-${id}`;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const data = resolve(arg('--data', 'eval-cases'));
const out = resolve(arg('--out', join('out', 'held-out-proxy')));
const envFileArg = arg('--env-file', null);

const docker = (args, options = {}) => {
  const run = spawnSync('docker', args, { encoding: 'utf8', ...options });
  return {
    status: run.status,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? '',
  };
};
const must = (args, what) => {
  const run = docker(args);
  if (run.status !== 0) {
    throw new Error(
      `${what} failed (exit ${run.status}): ${run.stderr.trim()}`,
    );
  }
  return run;
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const makeEnvFile = () => {
  if (envFileArg !== null) return { path: resolve(envFileArg), temp: false };
  const lines = readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^(MODEL_API_KEY|MODEL_TIMEOUT_MS)=/.test(l));
  if (!lines.some((l) => l.startsWith('MODEL_API_KEY='))) {
    throw new Error('.env has no MODEL_API_KEY; pass --env-file <file>');
  }
  const path = join(tmpdir(), `leetkob-heldout-${id}.env`);
  writeFileSync(path, `${lines.join('\n')}\n`, { mode: 0o600 });
  return { path, temp: true };
};

// Một lệnh node trong container trên mạng internal; exit 0 nếu fetch tới url thành công.
const fetchFromNetwork = (url, env = []) =>
  docker([
    'run',
    '--rm',
    '--network',
    NETWORK,
    ...env.flatMap((e) => ['-e', e]),
    '--entrypoint',
    'node',
    IMAGE,
    '-e',
    `fetch(${JSON.stringify(url)},{signal:AbortSignal.timeout(10000)}).then(()=>process.exit(0),e=>{console.error([e.message,e.cause?.code,e.cause?.message].filter(Boolean).join(': '));process.exit(1)})`,
  ]);

let envFile = null;
let exitCode = 1;
try {
  if (!existsSync(join(data, 'problems')))
    throw new Error(`no dataset at ${data}`);
  mkdirSync(out, { recursive: true });
  envFile = makeEnvFile();

  must(
    ['build', '-f', 'docker/checker.Dockerfile', '-t', IMAGE, '.'],
    'docker build',
  );
  const nodeEnvProxy = docker([
    'image',
    'inspect',
    IMAGE,
    '--format',
    '{{json .Config.Env}}',
  ]).stdout.includes('NODE_USE_ENV_PROXY=1');
  console.log(
    `image ${IMAGE}: NODE_USE_ENV_PROXY=1 ${nodeEnvProxy ? 'set' : 'NOT set'}`,
  );

  must(['network', 'create', '--internal', NETWORK], 'network create');
  must(
    [
      'run',
      '-d',
      '--name',
      PROXY,
      '-e',
      `ALLOW_HOSTS=${MODEL_HOST}`,
      '-v',
      `${resolve('scripts/held-out-proxy.mjs')}:/proxy.mjs:ro`,
      BASE_IMAGE,
      'node',
      '/proxy.mjs',
    ],
    'proxy start',
  );
  must(['network', 'connect', NETWORK, PROXY], 'proxy network connect');
  const proxyUrl = `http://${PROXY}:3128`;

  // Môi trường thử đúng như người chấm mô tả.
  const direct = fetchFromNetwork(`https://${MODEL_HOST.split(':')[0]}/`);
  check(
    'internal network cannot reach the model host without the proxy',
    direct.status !== 0,
    direct.stderr.trim(),
  );
  const other = fetchFromNetwork('https://example.com/', [
    `HTTPS_PROXY=${proxyUrl}`,
    'NODE_USE_ENV_PROXY=1',
  ]);
  check(
    'proxy refuses a host other than the model host',
    other.status !== 0,
    other.stderr.trim(),
  );

  // Lần chạy checker: chỉ key (env file) và HTTPS_PROXY, như lệnh trong README.
  const started = Date.now();
  const run = docker([
    'run',
    '--rm',
    '--network',
    NETWORK,
    '--env-file',
    envFile.path,
    '-e',
    `HTTPS_PROXY=${proxyUrl}`,
    '-v',
    `${data}:/data:ro`,
    '-v',
    `${out}:/out`,
    IMAGE,
    '/data',
    '--out',
    '/out/predictions.jsonl',
    '--call-log',
    '/out/call-log.jsonl',
  ]);
  const seconds = Math.round((Date.now() - started) / 1000);
  writeFileSync(join(out, 'checker-stderr.txt'), run.stderr);
  check(
    'checker exits 0',
    run.status === 0,
    `exit ${run.status}, ${seconds} s`,
  );

  const evalRun = spawnSync(
    process.execPath,
    [
      'leetkob-eval/eval.mjs',
      '--data',
      data,
      '--predictions',
      join(out, 'predictions.jsonl'),
      '--json',
      join(out, 'eval-summary.json'),
    ],
    { encoding: 'utf8' },
  );
  writeFileSync(join(out, 'eval-report.txt'), evalRun.stdout + evalRun.stderr);
  check(
    'eval.mjs accepts the file (exit 0 or 1)',
    evalRun.status === 0 || evalRun.status === 1,
    `exit ${evalRun.status}; ${evalRun.stdout.trim().split('\n').at(-1)}`,
  );

  const calls = existsSync(join(out, 'call-log.jsonl'))
    ? readFileSync(join(out, 'call-log.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => JSON.parse(l))
        .filter((e) => e.type === 'model_call')
    : [];
  const notOk = calls.filter(
    (c) => c.outcome !== 'ok' || !(c.requestId ?? '').startsWith('req_'),
  );
  check(
    'every model call went through the proxy (outcome ok, provider request id)',
    calls.length > 0 && notOk.length === 0,
    `${calls.length} calls, ${notOk.length} not ok (${[...new Set(notOk.map((c) => c.outcome))].join(', ')})`,
  );

  const proxyLog = docker(['logs', PROXY]).stdout;
  writeFileSync(join(out, 'proxy-log.jsonl'), proxyLog);
  const connects = proxyLog
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l))
    .filter((e) => e.method !== undefined);
  const allowedTargets = [
    ...new Set(connects.filter((e) => e.allowed).map((e) => e.target)),
  ];
  check(
    'the proxy only let traffic through to the model host',
    allowedTargets.every((t) => t === MODEL_HOST),
    `allowed: ${allowedTargets.join(', ') || 'none'}; refused: ${connects.filter((e) => !e.allowed).length}`,
  );

  exitCode = results.every((r) => r.ok) ? 0 : 1;
} catch (error) {
  console.error(`error: ${error.message}`);
  exitCode = 2;
} finally {
  docker(['rm', '-f', PROXY]);
  docker(['network', 'rm', NETWORK]);
  if (envFile?.temp) rmSync(envFile.path, { force: true });
}
console.log(
  exitCode === 0 ? 'held-out proxy run: PASS' : 'held-out proxy run: FAIL',
);
process.exit(exitCode);
