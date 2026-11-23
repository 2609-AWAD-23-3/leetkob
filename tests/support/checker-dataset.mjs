// Dataset nhỏ tự viết cho test checker (PA03-T10), cùng layout với dev set:
// problems/<id>/{statement.md,constraints.json,tests/}, solutions/<id>/<sNN>.cpp, labels.jsonl.
// Không dùng code, id hay đề của dev set.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const BAN_TEXT =
  'Do not call a library accumulate function: `std::accumulate`, `std::reduce`.';
export const SEMANTIC_TEXT =
  'Add the odd numbers with a loop you wrote yourself; do not store the whole input.';

export const PROBLEMS = {
  'odd-sum': {
    statement:
      '# Odd sum\n\nRead n, then n integers. Print the sum of the odd ones.\n',
    constraints: [
      { id: 'C1', text: BAN_TEXT, deduction: 2 },
      { id: 'C2', text: SEMANTIC_TEXT, deduction: 3 },
    ],
    solutions: {
      // Vi phạm ban list ở dòng 7 (thụt lề giữ nguyên trong evidence).
      's01.cpp':
        '#include <iostream>\n' +
        '#include <numeric>\n' +
        '#include <vector>\n' +
        'int main() {\n' +
        '  int n; std::cin >> n; std::vector<long long> v(n);\n' +
        '  for (auto &x : v) { std::cin >> x; if (x % 2 == 0) x = 0; }\n' +
        '    std::cout << std::accumulate(v.begin(), v.end(), 0LL) << "\\n";\n' +
        '}\n',
      // Trap: tên cấm chỉ có trong comment và string.
      's02.cpp':
        '#include <iostream>\n' +
        '// not std::accumulate: a plain loop\n' +
        'int main() {\n' +
        '  int n; std::cin >> n; long long s = 0;\n' +
        '  for (int i = 0; i < n; ++i) { long long x; std::cin >> x; if (x % 2) s += x; }\n' +
        '  const char *note = "std::reduce";\n' +
        '  (void)note; std::cout << s << "\\n";\n' +
        '}\n',
      'notes.txt': 'not a solution\n',
    },
    labels: [
      ['s01', 'C1', 'violation', [7]],
      ['s01', 'C2', 'violation', [5]],
      ['s02', 'C1', 'pass', []],
      ['s02', 'C2', 'pass', []],
    ],
  },
  'abs-max': {
    statement:
      '# Absolute max\n\nRead n integers and print the largest absolute value.\n',
    constraints: [
      {
        id: 'C1',
        text: 'Do not use `std::max_element`, `std::ranges::max_element`.',
        deduction: 3,
      },
    ],
    solutions: {
      's01.cpp':
        '#include <cstdlib>\n' +
        '#include <iostream>\n' +
        'int main() {\n' +
        '  int n; std::cin >> n; long long best = 0;\n' +
        '  while (n--) { long long x; std::cin >> x; if (std::llabs(x) > best) best = std::llabs(x); }\n' +
        '  std::cout << best << "\\n";\n' +
        '}\n',
    },
    labels: [['s01', 'C1', 'pass', []]],
  },
};

/** Ghi dataset vào thư mục tạm; trả về đường dẫn và hàm dọn dẹp. */
export const writeDataset = ({ withLabels = true, withTests = true } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'leetkob-checker-'));
  const labels = [];
  for (const [pid, problem] of Object.entries(PROBLEMS)) {
    const pdir = join(root, 'problems', pid);
    mkdirSync(pdir, { recursive: true });
    writeFileSync(join(pdir, 'statement.md'), problem.statement);
    writeFileSync(
      join(pdir, 'constraints.json'),
      JSON.stringify(problem.constraints, null, 2) + '\n',
    );
    if (withTests) {
      mkdirSync(join(pdir, 'tests'));
      // Nội dung cố tình không phải test hợp lệ: checker không được đọc thư mục này.
      writeFileSync(join(pdir, 'tests', '01.in'), 'checker must not read me\n');
    }
    const sdir = join(root, 'solutions', pid);
    mkdirSync(sdir, { recursive: true });
    for (const [name, code] of Object.entries(problem.solutions)) {
      writeFileSync(join(sdir, name), code);
    }
    for (const [sid, constraint, label, evidence] of problem.labels) {
      labels.push(
        JSON.stringify({
          solution: `${pid}/${sid}`,
          constraint,
          label,
          evidence,
          tags: [],
        }),
      );
    }
  }
  if (withLabels)
    writeFileSync(join(root, 'labels.jsonl'), labels.join('\n') + '\n');
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};
