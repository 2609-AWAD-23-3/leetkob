// PA03-T10: chạy image checker giống người chấm trên Linux (rubric PA03, "Những gì chúng tôi
// chạy", bước 3): `--network none`, giới hạn memory/process, `MODEL_OFF=1`, entrypoint gốc.
// Kiểm cả hai cách lấy file prediction:
// - stdout (lệnh chính trong README): container không ghi file nào, shell của người chấm tạo
//   file; thử với `--cap-drop ALL`, `--read-only`, `--user` một uid bất kỳ.
// - mount `/out` + `--out`: thư mục thuộc root (Docker tự tạo `out/` trên Linux) và thư mục
//   thuộc một user khác.
// Mọi cấu hình phải cho checker exit 0, cùng một file prediction, và `eval.mjs` exit 0 hoặc 1.
// Cần Docker; không chạy trong `npm test`.
//
//   node scripts/test-checker-image.mjs [dataset-dir]   (mặc định leetkob-eval)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const IMAGE = 'leetkob-checker';
const data = resolve(process.argv[2] ?? 'leetkob-eval');
const LIMITS = ['--network', 'none', '--memory', '512m', '--pids-limit', '64'];

const run = (cmd, args, options = {}) => {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (res.error) throw res.error;
  return res;
};
const docker = (...args) =>
  run('docker', args, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });

let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failed = true;
};

const build = docker(
  'build',
  '-q',
  '-f',
  'docker/checker.Dockerfile',
  '-t',
  IMAGE,
  '.',
);
check(build.status === 0, `docker build exit ${build.status}`);
if (build.status !== 0) process.exit(1);

const user = docker('image', 'inspect', '-f', '{{.Config.User}}', IMAGE);
console.log(`image user: ${user.stdout.trim() || '(root)'}`);

// Đọc file trong một volume bằng container phụ.
const readVolume = (volume) =>
  docker(
    'run',
    '--rm',
    '-v',
    `${volume}:/out`,
    '--entrypoint',
    'cat',
    IMAGE,
    '/out/predictions.jsonl',
  );

const scenarios = [
  {
    name: 'stdout, --cap-drop ALL --read-only --user 12345:12345',
    args: [
      '--cap-drop',
      'ALL',
      '--read-only',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '12345:12345',
    ],
    checkerArgs: ['/data'],
  },
  {
    name: 'stdout, --out -',
    args: [],
    checkerArgs: ['/data', '--out', '-'],
  },
  {
    name: 'mount /out owned by root:root 755 (Docker-created out/)',
    owner: null,
    checkerArgs: ['/data', '--out', '/out/predictions.jsonl'],
  },
  {
    name: 'mount /out owned by another user (4242:4242 755)',
    owner: '4242:4242',
    checkerArgs: ['/data', '--out', '/out/predictions.jsonl'],
  },
];

const dir = mkdtempSync(join(tmpdir(), 'leetkob-image-'));
const outputs = [];
try {
  for (const [index, scenario] of scenarios.entries()) {
    console.log(`\n== ${scenario.name}`);
    const mounted = 'owner' in scenario;
    const volume = `leetkob-checker-out-${process.pid}-${index}`;
    let output = '';
    try {
      const extra = [...(scenario.args ?? [])];
      if (mounted) {
        docker('volume', 'create', volume);
        if (scenario.owner) {
          docker(
            'run',
            '--rm',
            '-v',
            `${volume}:/out`,
            '--user',
            '0:0',
            '--entrypoint',
            'sh',
            IMAGE,
            '-c',
            `chown ${scenario.owner} /out && chmod 755 /out`,
          );
        }
        const owner = docker(
          'run',
          '--rm',
          '-v',
          `${volume}:/out`,
          '--entrypoint',
          'stat',
          IMAGE,
          '-c',
          '%u:%g %a',
          '/out',
        );
        console.log(`output folder: ${owner.stdout.trim()}`);
        extra.push('-v', `${volume}:/out`);
      }
      const checker = docker(
        'run',
        '--rm',
        ...LIMITS,
        ...extra,
        '-e',
        'MODEL_OFF=1',
        '-v',
        `${data}:/data:ro`,
        IMAGE,
        ...scenario.checkerArgs,
      );
      process.stdout.write(checker.stderr);
      check(checker.status === 0, `checker exit ${checker.status}`);
      if (mounted) {
        check(checker.stdout === '', 'stdout is empty when --out is a file');
        const read = readVolume(volume);
        output = read.status === 0 ? read.stdout : '';
      } else {
        output = checker.stdout;
      }
    } finally {
      if (mounted) docker('volume', 'rm', '-f', volume);
    }

    const lines = output === '' ? [] : output.trimEnd().split('\n');
    check(lines.length > 0, `prediction file has ${lines.length} lines`);
    if (lines.length === 0) continue;
    outputs.push(output);
    const predictions = join(dir, `predictions-${index}.jsonl`);
    writeFileSync(predictions, output);
    const evalRun = run(process.execPath, [
      'leetkob-eval/eval.mjs',
      '--data',
      data,
      '--predictions',
      predictions,
    ]);
    const last = evalRun.stdout.trimEnd().split('\n').at(-1);
    check(
      evalRun.status === 0 || evalRun.status === 1,
      `eval.mjs exit ${evalRun.status} (must be 0 or 1): ${last}`,
    );
  }
  console.log('');
  check(
    outputs.length === scenarios.length &&
      outputs.every((output) => output === outputs[0]),
    'every way of running gives the same prediction file',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
