// PA04-T05: kiểm tra cấu hình job `eval-gate` trong `.github/workflows/ci.yml`:
// chạy checker bằng model thật tạo predictions ngay trong job trên cả `leetkob-eval` và
// `eval-cases`, kiểm SHA-256 của dev set, không dùng cờ bỏ qua lỗi, không đọc predictions
// có sẵn trong repo, và fail rõ ràng khi thiếu `MODEL_API_KEY` (PR từ fork).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const WORKFLOW_PATH = '.github/workflows/ci.yml';

const readWorkflow = () => readFileSync(WORKFLOW_PATH, 'utf8');

const extractJobBlock = (yaml, jobName) => {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^ {2}[a-zA-Z0-9_-]+:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
};

const extractTagsBlock = (yaml) => {
  const match = /\n\s+tags:\r?\n([\s\S]*?)(?=\r?\n\s{2}[a-zA-Z0-9_-]+:)/.exec(
    yaml,
  );
  return match ? match[1] : '';
};

test('ci.yml runs on pa4 and pa04* release tags', () => {
  const tagsBlock = extractTagsBlock(readWorkflow());
  assert.match(tagsBlock, /['"]pa4['"]/);
  assert.match(tagsBlock, /['"]pa04\*['"]/);
});

test('ci.yml defines an eval-gate job that requires MODEL_API_KEY and fails closed on forks', () => {
  const block = extractJobBlock(readWorkflow(), 'eval-gate');
  assert.ok(block !== null, 'eval-gate job must exist in ci.yml');
  assert.match(
    block,
    /MODEL_API_KEY:\s*\$\{\{\s*secrets\.MODEL_API_KEY\s*\}\}/,
  );
  assert.match(block, /-z\s+["']?\$\{?MODEL_API_KEY\}?["']?/);
  assert.match(block, /\bexit 1\b/);
});

test('eval-gate checks published dev set SHA-256 before running eval', () => {
  const block = extractJobBlock(readWorkflow(), 'eval-gate');
  assert.ok(block !== null, 'eval-gate job must exist in ci.yml');
  assert.match(block, /sha256sum\s+-c\s+.*leetkob-eval\.sha256/);
  assert.match(
    block,
    /node\s+--test\s+tests\/unit\/leetkob-eval-integrity\.test\.mjs/,
  );
});

test('eval-gate runs checker with real model and evaluates both leetkob-eval and eval-cases', () => {
  const block = extractJobBlock(readWorkflow(), 'eval-gate');
  assert.ok(block !== null, 'eval-gate job must exist in ci.yml');
  const joined = block.replace(/\\\r?\n\s*/g, ' ');
  assert.match(
    joined,
    /node\s+dist\/cli\/checker\.js\s+leetkob-eval\b[^\n]*--out\s+["']?\$RUNNER_TEMP\/eval-gate\//,
  );
  assert.match(
    joined,
    /node\s+dist\/cli\/checker\.js\s+eval-cases\b[^\n]*--out\s+["']?\$RUNNER_TEMP\/eval-gate\//,
  );
  assert.match(
    joined,
    /node\s+leetkob-eval\/eval\.mjs\s+--data\s+leetkob-eval\s+--predictions\s+["']?\$RUNNER_TEMP\/eval-gate\//,
  );
  assert.match(
    joined,
    /node\s+leetkob-eval\/eval\.mjs\s+--data\s+eval-cases\s+--predictions\s+["']?\$RUNNER_TEMP\/eval-gate\//,
  );
});

test('eval-gate never bypasses exit codes, never disables the model, and never reads stored predictions', () => {
  const block = extractJobBlock(readWorkflow(), 'eval-gate');
  assert.ok(block !== null, 'eval-gate job must exist in ci.yml');
  assert.equal(/continue-on-error/i.test(block), false);
  assert.equal(/\|\|\s*true\b/.test(block), false);
  assert.equal(/\bset\s+\+e\b/.test(block), false);
  assert.equal(/MODEL_OFF\s*[:=]\s*['"]?(?:1|true)['"]?/i.test(block), false);
  assert.equal(/docs\/.*predictions\.jsonl/i.test(block), false);
});
