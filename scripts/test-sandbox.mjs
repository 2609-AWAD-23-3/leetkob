import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['--test', '--test-reporter=tap', 'tests/sandbox/sandbox-attacks.mjs'],
  {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  },
);

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) {
  console.error(result.error);
}
if (/^# tests 0\s*$/m.test(result.stdout ?? '')) {
  console.error('No sandbox tests executed');
  process.exit(1);
}
process.exit(result.status ?? 1);
