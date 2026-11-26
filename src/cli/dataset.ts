// Đọc một thư mục dataset cùng layout với dev set (PA03-T10).
// Chỉ đọc problems/<id>/statement.md, problems/<id>/constraints.json và solutions/<id>/*.cpp.
// Không bao giờ đọc labels.jsonl hay tests/: checker phải chạy được trên held-out set chỉ với
// đề bài và constraints.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export class DatasetError extends Error {
  override readonly name = 'DatasetError';
}

export interface DatasetConstraint {
  readonly id: string;
  readonly text: string;
}

export interface DatasetSolution {
  /** `<problem-id>/<file name without .cpp>`, như trong labels.jsonl. */
  readonly id: string;
  readonly code: string;
}

export interface DatasetProblem {
  readonly id: string;
  readonly statement: string;
  readonly constraints: readonly DatasetConstraint[];
  readonly solutions: readonly DatasetSolution[];
}

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const readText = async (path: string, what: string): Promise<string> => {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new DatasetError(
      `cannot read ${what} ${path}: ${(error as Error).message}`,
    );
  }
};

const listDirs = async (path: string): Promise<string[]> => {
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(byName);
};

const parseConstraints = (raw: string, path: string): DatasetConstraint[] => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new DatasetError(
      `${path} is not valid JSON: ${(error as Error).message}`,
    );
  }
  if (!Array.isArray(value)) {
    throw new DatasetError(`${path} must hold a JSON array of constraints`);
  }
  const ids = new Set<string>();
  return value.map((item: unknown, index) => {
    const c = item as { id?: unknown; text?: unknown } | null;
    if (
      typeof c !== 'object' ||
      c === null ||
      typeof c.id !== 'string' ||
      c.id === '' ||
      typeof c.text !== 'string'
    ) {
      throw new DatasetError(
        `${path}: constraint ${index} needs a string "id" and "text"`,
      );
    }
    if (ids.has(c.id)) {
      throw new DatasetError(`${path}: duplicate constraint id ${c.id}`);
    }
    ids.add(c.id);
    return { id: c.id, text: c.text };
  });
};

const readSolutions = async (
  root: string,
  problemId: string,
): Promise<DatasetSolution[]> => {
  const dir = join(root, 'solutions', problemId);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.cpp'))
    .map((entry) => entry.name)
    .sort(byName);
  const solutions: DatasetSolution[] = [];
  for (const file of files) {
    solutions.push({
      id: `${problemId}/${file.slice(0, -'.cpp'.length)}`,
      code: await readText(join(dir, file), 'solution'),
    });
  }
  return solutions;
};

/** Đọc toàn bộ dataset; thứ tự cố định (tên bài, tên file) để output lặp lại được. */
export const readDataset = async (root: string): Promise<DatasetProblem[]> => {
  const problemsDir = join(root, 'problems');
  try {
    if (!(await stat(problemsDir)).isDirectory())
      throw new Error('not a folder');
  } catch {
    throw new DatasetError(
      `dataset folder ${root} has no problems/ folder (expected problems/<id>/statement.md and constraints.json)`,
    );
  }
  const problems: DatasetProblem[] = [];
  for (const id of await listDirs(problemsDir)) {
    const constraintsPath = join(problemsDir, id, 'constraints.json');
    problems.push({
      id,
      statement: await readText(
        join(problemsDir, id, 'statement.md'),
        'statement',
      ),
      constraints: parseConstraints(
        await readText(constraintsPath, 'constraints'),
        constraintsPath,
      ),
      solutions: await readSolutions(root, id),
    });
  }
  return problems;
};
