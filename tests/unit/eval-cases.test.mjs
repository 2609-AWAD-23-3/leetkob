// PA03-T10, PA04-T04: case riêng của nhóm trong `eval-cases/`, cùng layout với dev set.
// Rubric PA04 tiêu chí 1: ít nhất 10 case (đếm theo solution), mỗi case có label và tag, bao phủ
// `trap`, `injection` và `disguised`. Case phải là bài mới (không chép bài hay code của dev set).
// Việc compile + khớp mọi `.out` được kiểm bằng sandbox thật: scripts/verify-eval-cases.mjs.
import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import test from 'node:test';

const ROOT = 'eval-cases';
const TAGS = new Set(['obvious', 'disguised', 'trap', 'injection', 'style']);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const posix = (p) => p.replaceAll('\\', '/');

const labels = () =>
  readFileSync(join(ROOT, 'labels.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));

const problemIds = (root) =>
  globSync(`${root}/problems/*/constraints.json`).map((p) =>
    basename(posix(p).replace(/\/constraints\.json$/, '')),
  );

test('eval-cases has the dev set layout', () => {
  assert.ok(existsSync(join(ROOT, 'labels.jsonl')));
  const ids = problemIds(ROOT);
  assert.ok(ids.length >= 1);
  for (const id of ids) {
    const dir = join(ROOT, 'problems', id);
    assert.ok(existsSync(join(dir, 'statement.md')), id);
    const constraints = readJson(join(dir, 'constraints.json'));
    assert.ok(constraints.length >= 1, id);
    for (const c of constraints) {
      assert.equal(typeof c.id, 'string');
      assert.equal(typeof c.text, 'string');
      assert.ok(Number.isInteger(c.deduction) && c.deduction > 0);
    }
    const ins = globSync(`${dir}/tests/*.in`).map(posix).sort();
    assert.ok(ins.length >= 2, `${id} needs tests`);
    for (const input of ins) {
      assert.ok(existsSync(input.replace(/\.in$/, '.out')), input);
    }
  }
});

test('eval-cases: at least ten labelled solutions, with trap, injection and disguised tags', () => {
  const rows = labels();
  const solutions = new Set(rows.map((r) => r.solution));
  assert.ok(solutions.size >= 10, `only ${solutions.size} solutions`);
  const tags = new Set(rows.flatMap((r) => r.tags));
  for (const tag of ['trap', 'injection', 'disguised']) {
    assert.ok(tags.has(tag), `needs a ${tag} case`);
  }
  // Mỗi case (solution) có ít nhất một tag; một cặp pass bình thường được để `tags: []`
  // như trong dev set.
  for (const solution of solutions) {
    const own = rows
      .filter((r) => r.solution === solution)
      .flatMap((r) => r.tags);
    assert.ok(own.length >= 1, `${solution} needs a tag`);
  }
  for (const r of rows) {
    for (const tag of r.tags) assert.ok(TAGS.has(tag), tag);
  }
});

test('eval-cases: every (solution, constraint) pair has exactly one valid label', () => {
  const rows = labels();
  const seen = new Set();
  for (const r of rows) {
    const key = `${r.solution} ${r.constraint}`;
    assert.equal(seen.has(key), false, `duplicate ${key}`);
    seen.add(key);
    assert.ok(['pass', 'violation'].includes(r.label), key);
    const path = join(ROOT, 'solutions', `${r.solution}.cpp`);
    assert.ok(existsSync(path), path);
    const lines = readFileSync(path, 'utf8').split('\n');
    if (r.label === 'pass') assert.deepEqual(r.evidence, [], key);
    else assert.ok(r.evidence.length >= 1, key);
    for (const line of r.evidence) {
      assert.ok(Number.isInteger(line) && line >= 1, key);
      assert.notEqual(
        (lines[line - 1] ?? '').trim(),
        '',
        `${key} line ${line}`,
      );
    }
  }
  for (const pid of problemIds(ROOT)) {
    const constraints = readJson(
      join(ROOT, 'problems', pid, 'constraints.json'),
    );
    for (const file of globSync(`${ROOT}/solutions/${pid}/*.cpp`)) {
      const sid = `${pid}/${basename(posix(file), '.cpp')}`;
      for (const c of constraints) {
        assert.ok(seen.has(`${sid} ${c.id}`), `missing label ${sid} ${c.id}`);
      }
    }
  }
});

test('eval-cases are new problems, not copies of the dev set', () => {
  const dev = new Set(problemIds('leetkob-eval'));
  for (const id of problemIds(ROOT)) assert.equal(dev.has(id), false, id);
  const devCode = new Set(
    globSync('leetkob-eval/solutions/*/*.cpp').map((f) =>
      readFileSync(f, 'utf8').replace(/\s+/g, ''),
    ),
  );
  for (const f of globSync(`${ROOT}/solutions/*/*.cpp`)) {
    assert.equal(
      devCode.has(readFileSync(f, 'utf8').replace(/\s+/g, '')),
      false,
      f,
    );
  }
});
