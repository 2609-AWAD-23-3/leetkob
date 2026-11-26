// Lệnh checker (PA03-T10): đọc thư mục dataset, ghi file prediction JSONL cho eval.mjs.
//
//   node dist/cli/checker.js <dataset-dir> [--out <predictions.jsonl>]
//        [--call-log <calls.jsonl>] [--concurrency <n>]
//
// Không có `--out` (hoặc `--out -`): prediction ghi ra stdout, mọi log ra stderr. Người chấm
// lấy file bằng redirect của shell (`docker run ... > predictions.jsonl`), container không phải
// ghi vào thư mục nào của máy chủ nên không phụ thuộc uid, capability hay quyền thư mục.
// Prediction chỉ được ghi một lần sau khi chấm xong; lần chạy lỗi không ghi gì ra stdout.
//
// MODEL_OFF=1: chỉ hard rules, constraint semantic ghi `unsure`, không tạo model client,
// không đọc MODEL_API_KEY, không mở network. Không bật MODEL_OFF thì cần MODEL_API_KEY
// (tuỳ chọn MODEL_TIMEOUT_MS). Exit 0 khi đã ghi prediction; 2 khi sai tham số, cấu hình hoặc dataset.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatasetError, readDataset } from './dataset.js';
import {
  DEFAULT_CONCURRENCY,
  formatJsonl,
  runChecker,
  type CheckerModel,
} from './run.js';

export const USAGE =
  'usage: checker <dataset-dir> [--out <predictions.jsonl> | --out -] [--call-log <calls.jsonl>] [--concurrency <n>]\n' +
  '       (without --out, predictions go to stdout; --data <dataset-dir> is accepted too; set MODEL_OFF=1 to run the hard rules only, without network)';

class UsageError extends Error {}

export interface CheckerArgs {
  readonly data: string;
  /** `null`: ghi prediction ra stdout. */
  readonly out: string | null;
  readonly callLog: string | null;
  readonly concurrency: number;
}

export const parseArgs = (argv: readonly string[]): CheckerArgs => {
  let data: string | null = null;
  let out: string | null = null;
  let callLog: string | null = null;
  let concurrency = DEFAULT_CONCURRENCY;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const value = (): string => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new UsageError(`${arg} needs a value`);
      }
      i += 1;
      return next;
    };
    if (arg === '--out') out = value();
    else if (arg === '--data') data = value();
    else if (arg === '--call-log') callLog = value();
    else if (arg === '--concurrency') {
      const raw = value();
      concurrency = Number(raw);
      if (!/^\d+$/.test(raw) || concurrency < 1 || concurrency > 32) {
        throw new UsageError('--concurrency must be an integer from 1 to 32');
      }
    } else if (arg.startsWith('--'))
      throw new UsageError(`unknown option ${arg}`);
    else if (data === null) data = arg;
    else throw new UsageError(`unexpected argument ${arg}`);
  }
  if (data === null) throw new UsageError('missing the dataset folder');
  return { data, out: out === '-' ? null : out, callLog, concurrency };
};

/** `MODEL_OFF=1` (hoặc `true`) tắt model; không đặt, rỗng, `0`, `false` là bật. */
export const readModelOff = (value: string | undefined): boolean => {
  const v = (value ?? '').trim().toLowerCase();
  if (v === '1' || v === 'true') return true;
  if (v === '' || v === '0' || v === 'false') return false;
  throw new UsageError(
    `MODEL_OFF must be 1 (model off) or 0/unset (model on), got "${value}"`,
  );
};

interface Io {
  readonly stderr: (text: string) => void;
  readonly stdout: (text: string) => Promise<void>;
}

const writeStdout = (text: string): Promise<void> =>
  new Promise((resolve, reject) => {
    process.stdout.write(text, (error) => (error ? reject(error) : resolve()));
  });

const createModel = async (
  env: Readonly<Record<string, string | undefined>>,
): Promise<CheckerModel> => {
  // Chỉ nạp client khi bật model; khi MODEL_OFF=1 không có client nào được tạo.
  const { createAnthropicModelClient, readModelConfig, ModelConfigError } =
    await import('../pipeline/model/index.js');
  try {
    const config = readModelConfig(env);
    return {
      client: createAnthropicModelClient(config),
      timeoutMs: config.timeoutMs,
    };
  } catch (error) {
    if (error instanceof ModelConfigError) {
      throw new UsageError(
        `${error.message}. Set MODEL_API_KEY for a real model run, or MODEL_OFF=1 to run the hard rules only.`,
      );
    }
    throw error;
  }
};

const writeOutput = async (path: string, text: string): Promise<void> => {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, text);
};

export const main = async (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: Io = {
    stderr: (text) => process.stderr.write(text),
    stdout: writeStdout,
  },
): Promise<number> => {
  let args: CheckerArgs;
  let modelOff: boolean;
  let model: CheckerModel | undefined;
  try {
    args = parseArgs(argv);
    modelOff = readModelOff(env['MODEL_OFF']);
    if (!modelOff) model = await createModel(env);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`checker: ${error.message}\n${USAGE}\n`);
      return 2;
    }
    throw error;
  }

  let problems;
  try {
    problems = await readDataset(args.data);
  } catch (error) {
    if (error instanceof DatasetError) {
      io.stderr(`checker: dataset error: ${error.message}\n`);
      return 2;
    }
    throw error;
  }

  io.stderr(
    modelOff
      ? 'checker: MODEL_OFF=1, hard rules only; semantic constraints are written as unsure and no network connection is opened\n'
      : `checker: model on (${model!.client.provider} ${model!.client.model}), concurrency ${args.concurrency}\n`,
  );
  const result = await runChecker({
    problems,
    modelOff,
    model,
    concurrency: args.concurrency,
  });
  const predictions = formatJsonl(result.predictions);
  if (args.out === null) await io.stdout(predictions);
  else await writeOutput(args.out, predictions);
  if (args.callLog !== null) {
    await writeOutput(args.callLog, formatJsonl(result.callLog));
  }

  const count = (verdict: string) =>
    result.predictions.filter((p) => p.verdict === verdict).length;
  const calls = result.callLog.filter((e) => e.type === 'model_call');
  const failed = calls.filter((e) => e.outcome !== 'ok').length;
  const cost = calls.reduce((sum, e) => sum + e.costUsd, 0);
  io.stderr(
    `checker: ${problems.length} problems, ${result.predictions.length} pairs ` +
      `(pass ${count('pass')}, violation ${count('violation')}, unsure ${count('unsure')}); ` +
      `model calls ${calls.length} (not ok ${failed}), cost $${cost.toFixed(6)}\n` +
      `checker: wrote predictions to ${args.out ?? 'stdout'}${args.callLog === null ? '' : `, call log to ${args.callLog}`}\n`,
  );
  return 0;
};

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntryPoint) {
  main(process.argv.slice(2), process.env).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `checker: failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
