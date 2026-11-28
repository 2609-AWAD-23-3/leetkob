// Chẩn đoán (không thuộc code sản phẩm): gọi model nhiều lần với đúng prompt của eval-cases digit-sum/s06,
// in nguyên văn text model trích cho mỗi dòng evidence ở dạng JSON.stringify, so với dòng code
// model thấy. Mục đích: xác nhận evidence_mismatch ở dòng 9 có phải do escape '\n' hay không.
//   node --env-file=.env <this> <repo> <n>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.argv[2];
const n = Number(process.argv[3] ?? 10);
const mod = await import(
  pathToFileURL(join(repo, 'dist/pipeline/model/index.js')).href
);
const ds = join(repo, 'eval-cases');
const statement = readFileSync(
  join(ds, 'problems/digit-sum/statement.md'),
  'utf8',
);
const constraints = JSON.parse(
  readFileSync(join(ds, 'problems/digit-sum/constraints.json'), 'utf8'),
).filter((c) => c.id === 'C2');
const code = readFileSync(join(ds, 'solutions/digit-sum/s06.cpp'), 'utf8');
const sanitized = mod.sanitizeCode(code, []);
const seen = mod.splitLines(sanitized);
const prompt = mod.buildPrompt({
  statement,
  constraints,
  sanitizedCode: sanitized,
});
const config = mod.readModelConfig(process.env);
const client = mod.createAnthropicModelClient({
  apiKey: config.apiKey,
  timeoutMs: config.timeoutMs,
});
let cost = 0;
for (let i = 1; i <= n; i += 1) {
  const out = await client.complete({
    system: prompt.system,
    user: prompt.user,
    schema: mod.buildResultSchema(['C2']),
    signal: new AbortController().signal,
    timeoutMs: config.timeoutMs,
  });
  cost += mod.computeCostUsd(out.inputTokens, out.outputTokens);
  const parsed = JSON.parse(out.text);
  for (const r of parsed.results) {
    for (const e of r.evidence) {
      const want = (seen[e.line - 1] ?? '').trim();
      const ok = e.text.trim() === want;
      console.log(
        JSON.stringify({
          call: i,
          requestId: out.requestId,
          verdict: r.verdict,
          line: e.line,
          match: ok,
          quoted: e.text,
          ...(ok ? {} : { expected: want }),
        }),
      );
    }
  }
}
console.log(JSON.stringify({ calls: n, costUsd: Number(cost.toFixed(6)) }));
