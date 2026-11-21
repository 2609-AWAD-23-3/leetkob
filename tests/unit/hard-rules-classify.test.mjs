import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyConstraint } from '../../dist/pipeline/hard-rules/index.js';

const banList = (names) => ({ kind: 'ban_list', names });
const semantic = { kind: 'semantic' };

test('"Do not use" followed by backticked names is a ban list', () => {
  assert.deepEqual(
    classifyConstraint('Do not use a sorting helper: `std::sort`, `qsort`.'),
    banList(['std::sort', 'qsort']),
  );
});

test('"Do not call" is a ban list too', () => {
  assert.deepEqual(
    classifyConstraint('Do not call `std::gcd` or `__gcd`.'),
    banList(['std::gcd', '__gcd']),
  );
});

test('the prefix is matched after trimming whitespace', () => {
  assert.deepEqual(
    classifyConstraint('  \n\tDo not use `goto`.  '),
    banList(['goto']),
  );
});

test('text that does not start with the prefix is semantic', () => {
  assert.deepEqual(
    classifyConstraint('Sort with a merge sort you wrote, not `std::sort`.'),
    semantic,
  );
  assert.deepEqual(
    classifyConstraint('Please do not use `std::sort`.'),
    semantic,
  );
  assert.deepEqual(
    classifyConstraint('Free every block you allocate.'),
    semantic,
  );
  assert.deepEqual(classifyConstraint(''), semantic);
});

test('the prefix must be a whole phrase, not the start of another word', () => {
  assert.deepEqual(classifyConstraint('Do not user `x`.'), semantic);
  assert.deepEqual(classifyConstraint('Do not callback `x`.'), semantic);
});

test('a "Do not use" text without any backticked name stays semantic', () => {
  assert.deepEqual(classifyConstraint('Do not use recursion.'), semantic);
});

test('`do`-`while` yields both keywords, in order', () => {
  assert.deepEqual(
    classifyConstraint('Do not use `for`, `while`, `do`-`while`, or `goto`.'),
    banList(['for', 'while', 'do', 'goto']),
  );
});

test('a single backtick span "do-while" yields do and while', () => {
  assert.deepEqual(
    classifyConstraint('Do not use `do-while` loops.'),
    banList(['do', 'while']),
  );
});

test('plain words around the names are not names', () => {
  assert.deepEqual(
    classifyConstraint(
      'Do not use loop statements: `for`, range-based `for`, or `goto`.',
    ),
    banList(['for', 'goto']),
  );
});

test('names are deduplicated and keep their first-seen order', () => {
  assert.deepEqual(
    classifyConstraint('Do not use `rbegin`, `rend`, `rbegin` or `crbegin`.'),
    banList(['rbegin', 'rend', 'crbegin']),
  );
});

test('a leading :: is dropped; nested namespaces are kept', () => {
  assert.deepEqual(
    classifyConstraint('Do not use `::qsort` or `boost::integer::gcd`.'),
    banList(['qsort', 'boost::integer::gcd']),
  );
});

test('backtick spans that are not C++ names are ignored', () => {
  assert.deepEqual(
    classifyConstraint('Do not use `new[]`, `a b`, `1x` or `std::sort`.'),
    banList(['std::sort']),
  );
});

test('a ban list whose spans are all invalid falls back to semantic', () => {
  assert.deepEqual(classifyConstraint('Do not use `new[]`.'), semantic);
});
