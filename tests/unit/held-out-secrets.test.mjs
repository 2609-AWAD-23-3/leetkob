// PA04-T08: `marking.env` chứa model key cho lần chạy held-out của người chấm. File chỉ được
// đính kèm trên Classroom, không bao giờ vào Git hay build context của checker image.
// Test chỉ đọc file cấu hình, không gọi `git` hay Docker, để chạy được khi không có network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const patterns = (path) =>
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

test('held-out: .gitignore ignores marking.env in every directory and never re-includes it', () => {
  const lines = patterns('.gitignore');
  // Trong .gitignore, một tên không có dấu "/" khớp ở mọi thư mục.
  assert.ok(
    lines.includes('marking.env'),
    '.gitignore has no marking.env line',
  );
  assert.equal(
    lines.some((line) => line.startsWith('!') && line.includes('marking.env')),
    false,
    '.gitignore re-includes marking.env',
  );
});

test('held-out: .dockerignore keeps marking.env out of the build context at the root and below', () => {
  const lines = patterns('.dockerignore');
  // Trong .dockerignore, "marking.env" chỉ khớp ở gốc context; "**/marking.env" khớp mọi thư mục.
  assert.ok(
    lines.includes('marking.env'),
    '.dockerignore has no marking.env line',
  );
  assert.ok(
    lines.includes('**/marking.env'),
    '.dockerignore has no **/marking.env line',
  );
  assert.equal(
    lines.some((line) => line.startsWith('!') && line.includes('marking.env')),
    false,
    '.dockerignore re-includes marking.env',
  );
});
