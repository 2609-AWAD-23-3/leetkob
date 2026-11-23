// PA03-T10: kiểm mọi solution của một dataset là Accepted trong sandbox thật của sản phẩm
// (compile `g++ -std=c++17 -O2`, chạy mọi tests/*.in, so với .out như judge).
// Cần Docker; không chạy trong `npm test`.
//
//   npm run build && node scripts/verify-eval-cases.mjs [dataset-dir]   (mặc định eval-cases)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createDockerSandboxRunner,
  ensureSandboxImage,
} from '../dist/sandbox/index.js';

const root = process.argv[2] ?? 'eval-cases';
const problemsDir = join(root, 'problems');
const sorted = (items) => [...items].sort();

await ensureSandboxImage();
const runner = createDockerSandboxRunner();

let failures = 0;
let checked = 0;
for (const pid of sorted(readdirSync(problemsDir))) {
  const testsDir = join(problemsDir, pid, 'tests');
  const testCases = sorted(readdirSync(testsDir))
    .filter((name) => name.endsWith('.in'))
    .map((name) => ({
      id: name.slice(0, -3),
      input: readFileSync(join(testsDir, name), 'utf8'),
      expectedOutput: readFileSync(
        join(testsDir, name.replace(/\.in$/, '.out')),
        'utf8',
      ),
    }));
  const solutionsDir = join(root, 'solutions', pid);
  for (const file of sorted(readdirSync(solutionsDir))) {
    if (!file.endsWith('.cpp')) continue;
    const code = readFileSync(join(solutionsDir, file), 'utf8');
    const result = await runner.compileAndRun(code, testCases);
    const statuses = result.testResults
      .map((r) => `${r.testCaseId}:${r.status}`)
      .join(' ');
    console.log(
      `${pid}/${file.slice(0, -4)} ${result.verdict} (${testCases.length} tests) ${statuses}`,
    );
    if (result.verdict !== 'Accepted') {
      failures += 1;
      if (!result.compileResult.success) {
        console.log(result.compileResult.stderr.slice(0, 2000));
      }
    }
    checked += 1;
  }
}
console.log(`${checked} solutions checked, ${failures} not Accepted`);
process.exit(failures === 0 && checked > 0 ? 0 : 1);
