import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Node runner giữ nguyên isolation/process và assertion reporting; không tạo framework riêng.
const files = globSync('tests/**/*.test.{mjs,js,ts}').sort();
if (files.length === 0) {
  console.error('No test files discovered under tests/**/*.test.{mjs,js,ts}');
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-reporter=tap', ...files],
  {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  },
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) console.error(result.error);
if (/^# tests 0\s*$/m.test(result.stdout ?? '')) {
  console.error('No tests executed');
  process.exit(1);
}
process.exit(result.status ?? 1);
