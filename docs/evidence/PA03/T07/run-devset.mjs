// Script kiểm chứng model-off cho T07. KHÔNG phải checker của T10 và không nằm trong src/.
// Cách dùng (sau `npm run build`):
//   node docs/evidence/PA03/T07/run-devset.mjs <thư mục dev set> <file prediction .jsonl>
// Với mỗi cặp (solution, constraint): ban list → verdict của hard rules; semantic → `unsure`
// (T08 sẽ đảm nhiệm). Chỉ đọc dev set, không sửa gì trong đó.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [devset, output] = process.argv.slice(2);
if (!devset || !output) {
  console.error('usage: node run-devset.mjs <devset-dir> <predictions.jsonl>');
  process.exit(2);
}
const { runHardRules } = await import(
  pathToFileURL(join(process.cwd(), 'dist/pipeline/hard-rules/index.js')).href
);

const lines = [];
const counts = { banPairs: 0, semanticPairs: 0, modelCalls: 0 };
for (const problem of readdirSync(join(devset, 'problems')).sort()) {
  const constraints = JSON.parse(
    readFileSync(join(devset, 'problems', problem, 'constraints.json'), 'utf8'),
  );
  for (const file of readdirSync(join(devset, 'solutions', problem)).sort()) {
    if (!file.endsWith('.cpp')) continue;
    const solution = `${problem}/${file.slice(0, -4)}`;
    const code = readFileSync(join(devset, 'solutions', problem, file), 'utf8');
    const result = runHardRules({ code, constraints });
    for (const verdict of result.verdicts) {
      counts.banPairs += 1;
      lines.push({
        solution,
        constraint: verdict.constraintId,
        verdict: verdict.verdict,
        evidence: verdict.evidence,
      });
    }
    // model-off: ràng buộc semantic không được quyết, ghi `unsure`; không gọi model nào.
    for (const id of result.modelConstraintIds) {
      counts.semanticPairs += 1;
      lines.push({ solution, constraint: id, verdict: 'unsure', evidence: [] });
    }
  }
}
writeFileSync(output, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
console.log(JSON.stringify({ pairs: lines.length, ...counts }));
