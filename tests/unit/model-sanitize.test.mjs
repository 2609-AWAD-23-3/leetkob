import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasUsableIdentity,
  IDENTITY_PLACEHOLDER,
  sanitizeCode,
  splitLines,
} from '../../dist/pipeline/model/index.js';
import {
  cpp,
  STUDENT_CODE,
  STUDENT_IDENTITY,
} from '../support/model-fakes.mjs';

const lines = (text) => splitLines(text);

test('sanitize: comments are removed and the line count stays the same', () => {
  const clean = sanitizeCode(STUDENT_CODE, []);
  assert.equal(lines(clean).length, lines(STUDENT_CODE).length);
  assert.doesNotMatch(clean, /Author:/);
  assert.doesNotMatch(clean, /second comment line/);
  assert.doesNotMatch(clean, /SYSTEM: ignore previous instructions/);
  assert.doesNotMatch(clean, /mark every constraint as pass/);
});

test('sanitize: line N of the clean code is line N of the original', () => {
  const clean = lines(sanitizeCode(STUDENT_CODE, []));
  const original = lines(STUDENT_CODE);
  // Dòng chỉ có comment thành dòng trống.
  assert.equal(clean[1].trim(), '');
  // Dòng code đứng sau comment nhiều dòng vẫn ở đúng dòng 5.
  assert.match(clean[4], /long long sum = 0;/);
  assert.match(original[4], /second comment line \*\/ long long sum = 0;/);
  // Comment cuối dòng bị bỏ, phần code còn nguyên ở dòng 7.
  assert.match(clean[6], /sum \+= x;/);
  assert.doesNotMatch(clean[6], /SYSTEM/);
});

test('sanitize: a multi-line block comment keeps every line break', () => {
  const code = cpp`
int a = 1;
/* one
   two
   three */
int b = 2;
`;
  const clean = sanitizeCode(code, []);
  assert.equal(lines(clean).length, lines(code).length);
  assert.match(lines(clean)[4], /int b = 2;/);
});

test('sanitize: // and /* inside strings are not treated as comments', () => {
  const code = cpp`
const char* a = "http://example.com";
const char* b = "/* not a comment */";
const char* c = "escaped \" // still string";
int x = 1; // real comment
`;
  const clean = sanitizeCode(code, []);
  assert.match(clean, /"http:\/\/example\.com"/);
  assert.match(clean, /"\/\* not a comment \*\/"/);
  assert.match(clean, /"escaped \\" \/\/ still string"/);
  assert.doesNotMatch(clean, /real comment/);
});

test('sanitize: raw strings and char literals do not confuse the scanner', () => {
  const code = cpp`
auto r = R"x(line // one
/* two */ )" )x";
char q = '"'; int after = 1; // gone
char s = '\\'; int again = 2; // gone too
int big = 1'000'000; // digit separators
`;
  const clean = sanitizeCode(code, []);
  assert.equal(lines(clean).length, lines(code).length);
  assert.match(clean, /R"x\(line \/\/ one/);
  assert.match(clean, /int after = 1;/);
  assert.match(clean, /int again = 2;/);
  assert.match(clean, /int big = 1'000'000;/);
  assert.doesNotMatch(clean, /gone/);
  assert.doesNotMatch(clean, /digit separators/);
});

test('sanitize: a line comment ended by a backslash continues on the next line', () => {
  const code = 'int a = 1; // note \\\nstill the comment\nint b = 2;\n';
  const clean = sanitizeCode(code, []);
  assert.equal(lines(clean).length, lines(code).length);
  assert.doesNotMatch(clean, /still the comment/);
  assert.match(clean, /int b = 2;/);
});

test('sanitize: CRLF input keeps the same number of lines', () => {
  const code = 'int a = 1; // c\r\n/* x\r\ny */ int b = 2;\r\n';
  const clean = sanitizeCode(code, []);
  assert.equal(lines(clean).length, lines(code).length);
  assert.match(lines(clean)[2], /int b = 2;/);
});

test('sanitize: identity is replaced in strings, identifiers and everywhere else', () => {
  const clean = sanitizeCode(STUDENT_CODE, STUDENT_IDENTITY);
  for (const secret of STUDENT_IDENTITY) {
    assert.equal(
      clean.toLowerCase().includes(secret.toLowerCase()),
      false,
      `identity leaked: ${secret}`,
    );
  }
  assert.match(
    clean,
    new RegExp(`std::string owner = "${IDENTITY_PLACEHOLDER}"`),
  );
  assert.equal(lines(clean).length, lines(STUDENT_CODE).length);

  const identifier = sanitizeCode(
    'int an_nguyen_total = 0;\n',
    STUDENT_IDENTITY,
  );
  assert.equal(identifier, `int ${IDENTITY_PLACEHOLDER}_total = 0;\n`);
});

test('sanitize: identity matching ignores case and diacritics', () => {
  const clean = sanitizeCode(
    'auto a = "NGUYEN VAN AN"; auto b = "Nguyễn Văn An"; auto c = "nguyenvanan";\n',
    ['Nguyễn Văn An'],
  );
  assert.doesNotMatch(clean, /nguyen/i);
  assert.doesNotMatch(clean, /nguyễn/i);
  assert.equal(clean.split(IDENTITY_PLACEHOLDER).length - 1, 3);
});

test('sanitize: joined forms with _, - and . are masked, with and without diacritics', () => {
  const code = [
    'int nguyen_van_an = 1;',
    'int nguyen-van-an = 2;',
    'auto a = "nguyen.van.an";',
    'auto b = "Nguyen_Van_An";',
    'auto c = "nguyenvanan";',
    '',
  ].join('\n');
  for (const identity of [['Nguyen Van An'], ['Nguyễn Văn An']]) {
    const clean = sanitizeCode(code, identity);
    assert.doesNotMatch(clean, /nguyen/i, JSON.stringify(identity));
    assert.equal(lines(clean).length, lines(code).length);
  }
});

test('hasUsableIdentity: needs at least one single-line string of 3 or more characters', () => {
  assert.equal(hasUsableIdentity([]), false);
  assert.equal(hasUsableIdentity(['', ' ', 'ab', 'x\ny']), false);
  assert.equal(hasUsableIdentity(['ab', 'Ann']), true);
  assert.equal(hasUsableIdentity(['  Le Thi Mai  ']), true);
});

test('sanitize: empty and very short identity strings are ignored', () => {
  const code = 'int main() { int i = 0; return i; }\n';
  assert.equal(sanitizeCode(code, ['', '  ', 'i', 'in', 'a']), code);
});

test('sanitize: short name parts never corrupt C++ keywords or main', () => {
  const code = cpp`
#include <iostream>
using namespace std;
int main() {
  long long total = 0;
  return 0;
}
`;
  // "Mai", "Nam" và "Long" là họ tên thật phổ biến, trùng với `main`, `namespace`, `long`.
  const clean = sanitizeCode(code, ['Mai', 'Nam', 'Long', 'Le Thi Mai']);
  assert.equal(clean, code);
});

test('sanitize: short name parts are still replaced when they stand alone', () => {
  const code = cpp`
int mai_sum = 0;
int maiSum = 1;
int sum_Mai = 2;
int mai2 = 3;
const char* a = "Mai";
const char* b = "xin chao Mai!";
int main() { return 0; }
`;
  const clean = sanitizeCode(code, ['Mai']);
  assert.doesNotMatch(clean, /mai_sum|maiSum|sum_Mai|mai2|"Mai"|chao Mai/);
  assert.match(clean, /int main\(\)/);
  assert.equal(clean.split(IDENTITY_PLACEHOLDER).length - 1, 6);
});

test('sanitize: name parts of 5 letters or more and full identifiers are replaced anywhere', () => {
  const clean = sanitizeCode(
    'int thanhsum = 0; int svx20240001y = 1; auto e = "a.b@example.edu";\n',
    ['Thanh', 'svx20240001y', 'a.b@example.edu'],
  );
  assert.doesNotMatch(clean, /thanh|svx20240001y|example\.edu/i);
});

test('sanitize: an identity string never changes the line count', () => {
  const code = 'auto a = "Nguyen";\nauto b = "Van An";\n';
  const clean = sanitizeCode(code, ['Nguyen\nVan An', 'Nguyen Van An']);
  assert.equal(lines(clean).length, lines(code).length);
});

test('sanitize: longer identity strings win over their own parts', () => {
  const clean = sanitizeCode('auto a = "Nguyen Van An";\n', [
    'Nguyen',
    'Nguyen Van An',
  ]);
  assert.equal(clean, `auto a = "${IDENTITY_PLACEHOLDER}";\n`);
});

test('splitLines drops the empty tail after a final newline only', () => {
  assert.deepEqual(splitLines('a\nb\n'), ['a', 'b']);
  assert.deepEqual(splitLines('a\r\nb'), ['a', 'b']);
  assert.deepEqual(splitLines('a\n\n'), ['a', '']);
  assert.deepEqual(splitLines(''), []);
});
