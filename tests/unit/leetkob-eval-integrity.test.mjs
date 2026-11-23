// PA03-T10: dev set trong `leetkob-eval/` phải giống bản công bố từng byte
// (fithcmus/awad-leetkob-eval commit 552c811db2d35a23d641bc4fdffc1ac120be1a28).
// Manifest `tests/support/leetkob-eval.sha256` sinh từ git blob của commit đó, không qua chuyển eol.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const manifest = readFileSync('tests/support/leetkob-eval.sha256', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [sha, path] = line.split(/ {2}/);
    return { sha, path };
  });

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

test('manifest covers the published dev set (6 problems, 47 solutions)', () => {
  const paths = manifest.map((entry) => entry.path);
  assert.equal(paths.filter((p) => p.endsWith('.cpp')).length, 47);
  assert.equal(paths.filter((p) => p.endsWith('constraints.json')).length, 6);
  // SHA-256 công bố trong rubric PA03.
  const bySha = Object.fromEntries(manifest.map((e) => [e.path, e.sha]));
  assert.match(bySha['eval.mjs'], /^c836edd8713521bb/);
  assert.match(bySha['labels.jsonl'], /^262cda7b0ef5612e/);
});

test('every dev set file in leetkob-eval/ matches the published bytes', () => {
  for (const { sha, path } of manifest) {
    assert.equal(sha256(`leetkob-eval/${path}`), sha, path);
  }
});

test('leetkob-eval/ holds no file outside the published dev set', () => {
  const expected = new Set(manifest.map((entry) => entry.path));
  const actual = globSync('leetkob-eval/**/*', { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      `${entry.parentPath}/${entry.name}`
        .replaceAll('\\', '/')
        .replace(/^.*?leetkob-eval\//, ''),
    );
  assert.deepEqual(actual.filter((p) => !expected.has(p)).sort(), []);
});
