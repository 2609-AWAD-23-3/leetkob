import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  SandboxCompileResult,
  SandboxLimits,
  SandboxRunner,
  SandboxSubmissionResult,
  SandboxTerminationReason,
  SandboxTestCase,
  SandboxTestCaseResult,
  SandboxTestCaseStatus,
  SubmissionVerdict,
} from './types.js';

export const DEFAULT_SANDBOX_IMAGE = 'leetkob-sandbox:pa03';

// FAQ-05 defaults: 1s CPU, wall 3x CPU, 256 MB memory (swap included), 16 processes, 1 MB output.
export const FAQ05_SANDBOX_LIMITS: SandboxLimits = Object.freeze({
  cpuTimeLimitSeconds: 1,
  wallTimeLimitSeconds: 3,
  memoryLimitMb: 256,
  maxProcesses: 16,
  outputLimitBytes: 1024 * 1024,
  compileCpuTimeLimitSeconds: 10,
  compileWallTimeLimitSeconds: 30,
});

const SAFE_DOCKER_HOST_ENV_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'DOCKER_HOST',
  'DOCKER_CONFIG',
  'DOCKER_CERT_PATH',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CONTEXT',
  'TEMP',
  'TMP',
  'SystemRoot',
  'COMSPEC',
] as const;

const FORBIDDEN_SANDBOX_ARG_PATTERNS: readonly RegExp[] = [
  /^--privileged(?:=|$)/i,
  /docker\.sock/i,
  /^--env-file(?:=|$)/i,
  /^(?:-e|--env(?:=|$))/i,
  /^(?:-v|--volume(?:=|$)|--mount(?:=|$))/i,
  /type=bind/i,
  /MODEL_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY/i,
];

const MAX_COMPILE_BINARY_BYTES = 32 * 1024 * 1024;
const EXIT_SIGXCPU = 128 + 24;
const EXIT_SIGXFSZ = 128 + 25;
const EXIT_SIGABRT = 128 + 6;
const EXIT_CGROUP_OOM = 197;
const EXIT_DOCKER_ERROR = 125;
const DEFAULT_DOCKER_DIR = fileURLToPath(
  new URL('../../docker', import.meta.url),
);

export interface SpawnedSandboxProcess {
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(
    event: 'close',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export type SpawnSandboxProcess = (
  command: string,
  args: readonly string[],
  options: { env: NodeJS.ProcessEnv },
) => SpawnedSandboxProcess;

export interface BuildSandboxDockerArgsOptions {
  readonly mode: 'compile' | 'run';
  readonly containerName: string;
  readonly imageTag?: string;
  readonly limits?: Partial<SandboxLimits>;
}

export interface DockerSandboxRunnerOptions {
  readonly imageTag?: string;
  readonly dockerCommand?: string;
  readonly limits?: Partial<SandboxLimits>;
  readonly hostEnv?: NodeJS.ProcessEnv;
  readonly spawnProcess?: SpawnSandboxProcess;
  readonly killContainer?: (containerName: string) => Promise<void>;
  readonly containerNamePrefix?: string;
}

export interface EnsureSandboxImageOptions {
  readonly imageTag?: string;
  readonly dockerfilePath?: string;
  readonly contextDir?: string;
  readonly dockerCommand?: string;
  readonly hostEnv?: NodeJS.ProcessEnv;
}

export function sanitizeDockerHostEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};
  for (const key of SAFE_DOCKER_HOST_ENV_KEYS) {
    const value = env[key];
    if (typeof value === 'string' && value.length > 0) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function resolveSandboxLimits(
  overrides?: Partial<SandboxLimits>,
): SandboxLimits {
  if (!overrides) {
    return FAQ05_SANDBOX_LIMITS;
  }
  const cpuTimeLimitSeconds =
    overrides.cpuTimeLimitSeconds ?? FAQ05_SANDBOX_LIMITS.cpuTimeLimitSeconds;
  const wallTimeLimitSeconds =
    overrides.wallTimeLimitSeconds ??
    Math.max(
      FAQ05_SANDBOX_LIMITS.wallTimeLimitSeconds,
      cpuTimeLimitSeconds * 3,
    );

  const resolved: SandboxLimits = {
    cpuTimeLimitSeconds,
    wallTimeLimitSeconds,
    memoryLimitMb:
      overrides.memoryLimitMb ?? FAQ05_SANDBOX_LIMITS.memoryLimitMb,
    maxProcesses: overrides.maxProcesses ?? FAQ05_SANDBOX_LIMITS.maxProcesses,
    outputLimitBytes:
      overrides.outputLimitBytes ?? FAQ05_SANDBOX_LIMITS.outputLimitBytes,
    compileCpuTimeLimitSeconds:
      overrides.compileCpuTimeLimitSeconds ??
      FAQ05_SANDBOX_LIMITS.compileCpuTimeLimitSeconds,
    compileWallTimeLimitSeconds:
      overrides.compileWallTimeLimitSeconds ??
      FAQ05_SANDBOX_LIMITS.compileWallTimeLimitSeconds,
  };

  const integerLimitKeys = [
    'cpuTimeLimitSeconds',
    'compileCpuTimeLimitSeconds',
    'memoryLimitMb',
    'maxProcesses',
    'outputLimitBytes',
  ] as const;

  for (const key of integerLimitKeys) {
    const value = resolved[key];
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Sandbox limit "${key}" must be a positive integer`);
    }
  }

  for (const key of [
    'wallTimeLimitSeconds',
    'compileWallTimeLimitSeconds',
  ] as const) {
    const value = resolved[key];
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `Sandbox limit "${key}" must be a positive finite number`,
      );
    }
  }
  return Object.freeze(resolved);
}

export function assertSafeSandboxDockerArgs(args: readonly string[]): void {
  for (const arg of args) {
    for (const pattern of FORBIDDEN_SANDBOX_ARG_PATTERNS) {
      if (pattern.test(arg)) {
        throw new Error(`Forbidden sandbox Docker argument detected: "${arg}"`);
      }
    }
  }
}

export function buildSandboxDockerArgs(
  options: BuildSandboxDockerArgsOptions,
): readonly string[] {
  const limits = resolveSandboxLimits(options.limits);
  const imageTag = options.imageTag ?? DEFAULT_SANDBOX_IMAGE;
  const cpuLimitSec =
    options.mode === 'compile'
      ? limits.compileCpuTimeLimitSeconds
      : limits.cpuTimeLimitSeconds;
  const fsizeLimitBytes =
    options.mode === 'compile'
      ? MAX_COMPILE_BINARY_BYTES
      : limits.outputLimitBytes;

  const args: readonly string[] = [
    'run',
    '--rm',
    '-i',
    '--name',
    options.containerName,
    '--network',
    'none',
    '--cpus',
    '1',
    '--memory',
    `${limits.memoryLimitMb}m`,
    '--memory-swap',
    `${limits.memoryLimitMb}m`,
    '--pids-limit',
    String(limits.maxProcesses),
    '--ulimit',
    `cpu=${cpuLimitSec}:${cpuLimitSec + 1}`,
    '--ulimit',
    `fsize=${fsizeLimitBytes}:${fsizeLimitBytes}`,
    '--ulimit',
    'core=0:0',
    '--user',
    '10001:10001',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,exec,nosuid,nodev,size=64m,uid=10001,gid=10001',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    imageTag,
    options.mode,
    String(cpuLimitSec),
    String(limits.outputLimitBytes),
  ];

  assertSafeSandboxDockerArgs(args);
  return args;
}

export function normalizeJudgeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '');
}

function defaultSpawnSandboxProcess(
  command: string,
  args: readonly string[],
  options: { env: NodeJS.ProcessEnv },
): SpawnedSandboxProcess {
  return spawn(command, [...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: options.env,
    windowsHide: true,
  });
}

async function defaultKillContainer(
  dockerCommand: string,
  containerName: string,
  hostEnv: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve) => {
    const killer = spawn(dockerCommand, ['rm', '-f', containerName], {
      stdio: ['ignore', 'ignore', 'ignore'],
      env: sanitizeDockerHostEnv(hostEnv),
      windowsHide: true,
    });
    killer.on('close', () => resolve());
    killer.on('error', () => resolve());
  });
}

export async function ensureSandboxImage(
  options: EnsureSandboxImageOptions = {},
): Promise<void> {
  const dockerCommand = options.dockerCommand ?? 'docker';
  const imageTag = options.imageTag ?? DEFAULT_SANDBOX_IMAGE;
  const contextDir = options.contextDir ?? DEFAULT_DOCKER_DIR;
  const dockerfilePath =
    options.dockerfilePath ?? path.join(contextDir, 'sandbox.Dockerfile');
  const hostEnv = sanitizeDockerHostEnv(options.hostEnv ?? process.env);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      dockerCommand,
      ['build', '-f', dockerfilePath, '-t', imageTag, contextDir],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: hostEnv,
        windowsHide: true,
      },
    );

    const stderrChunks: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const stderrText = Buffer.concat(stderrChunks).toString('utf8');
      reject(
        new Error(
          `docker build for sandbox image "${imageTag}" failed with exit code ${String(code)}: ${stderrText}`,
        ),
      );
    });
  });
}

interface StreamLimitCollector {
  push(chunk: Buffer): boolean;
  toBuffer(): Buffer;
  readonly truncated: boolean;
}

function createStreamCollector(limitBytes: number): StreamLimitCollector {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let truncated = false;

  return {
    push(chunk: Buffer): boolean {
      if (truncated) {
        return false;
      }
      if (totalBytes + chunk.length > limitBytes) {
        const remaining = limitBytes - totalBytes;
        if (remaining > 0) {
          chunks.push(chunk.subarray(0, remaining));
          totalBytes += remaining;
        }
        truncated = true;
        return true;
      }
      chunks.push(chunk);
      totalBytes += chunk.length;
      return false;
    },
    toBuffer(): Buffer {
      return Buffer.concat(chunks);
    },
    get truncated(): boolean {
      return truncated;
    },
  };
}

interface RawExecutionResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
  readonly outputTruncated: boolean;
  readonly wallClockTimedOut: boolean;
  readonly containerKilled: boolean;
  readonly durationMs: number;
}

async function executeContainer(params: {
  dockerCommand: string;
  args: readonly string[];
  containerName: string;
  stdinPayload: Buffer;
  wallTimeLimitSeconds: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  hostEnv: NodeJS.ProcessEnv;
  spawnProcess: SpawnSandboxProcess;
  killContainer: (containerName: string) => Promise<void>;
}): Promise<RawExecutionResult> {
  const startedAt = Date.now();
  const proc = params.spawnProcess(params.dockerCommand, params.args, {
    env: sanitizeDockerHostEnv(params.hostEnv),
  });

  const stdoutCollector = createStreamCollector(params.maxStdoutBytes);
  const stderrCollector = createStreamCollector(params.maxStderrBytes);

  let wallClockTimedOut = false;
  let containerKilled = false;
  let killPromise: Promise<void> | null = null;
  let wallTimer: NodeJS.Timeout | null = null;
  let fallbackKillTimer: NodeJS.Timeout | null = null;
  let closed = false;

  const triggerContainerKill = (): void => {
    if (containerKilled) {
      return;
    }
    containerKilled = true;
    killPromise = params.killContainer(params.containerName).finally(() => {
      if (!closed) {
        fallbackKillTimer = setTimeout(() => {
          if (!closed) {
            proc.kill('SIGKILL');
          }
        }, 1500);
        fallbackKillTimer.unref();
      }
    });
  };

  proc.stdout.on('data', (chunk: Buffer | string) => {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    if (stdoutCollector.push(buf)) {
      triggerContainerKill();
    }
  });

  proc.stderr.on('data', (chunk: Buffer | string) => {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    if (stderrCollector.push(buf)) {
      triggerContainerKill();
    }
  });

  // Ignore EPIPE when the container aborts before draining stdin.
  proc.stdin.on('error', () => {});

  const closeResult = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    proc.on('error', (error) => {
      closed = true;
      if (wallTimer) clearTimeout(wallTimer);
      if (fallbackKillTimer) clearTimeout(fallbackKillTimer);
      reject(error);
    });

    proc.on('close', (code, signal) => {
      closed = true;
      if (wallTimer) clearTimeout(wallTimer);
      if (fallbackKillTimer) clearTimeout(fallbackKillTimer);
      resolve({ exitCode: code, signal });
    });

    wallTimer = setTimeout(() => {
      wallClockTimedOut = true;
      triggerContainerKill();
    }, params.wallTimeLimitSeconds * 1000);
    wallTimer.unref();

    proc.stdin.end(params.stdinPayload);
  });

  if (killPromise) {
    await killPromise;
  }

  return {
    exitCode: closeResult.exitCode,
    signal: closeResult.signal,
    stdout: stdoutCollector.toBuffer(),
    stderr: stderrCollector.toBuffer(),
    outputTruncated: stdoutCollector.truncated || stderrCollector.truncated,
    wallClockTimedOut,
    containerKilled,
    durationMs: Date.now() - startedAt,
  };
}

function throwIfDockerInfraError(
  raw: RawExecutionResult,
  stderrText: string,
): void {
  if (
    !raw.wallClockTimedOut &&
    !raw.outputTruncated &&
    raw.exitCode === EXIT_DOCKER_ERROR
  ) {
    throw new Error(
      `Docker sandbox infrastructure error (exit 125): ${stderrText.trim() || 'docker run failed'}`,
    );
  }
}

function classifyExecutionFailure(raw: {
  exitCode: number | null;
  stderrText: string;
  outputTruncated: boolean;
  wallClockTimedOut: boolean;
}): {
  status: Exclude<SandboxTestCaseStatus, 'accepted' | 'wrong_answer'>;
  terminationReason: Exclude<SandboxTerminationReason, 'normal'>;
} | null {
  if (raw.outputTruncated || raw.exitCode === EXIT_SIGXFSZ) {
    return {
      status: 'output_limit_exceeded',
      terminationReason: 'output_size_limit',
    };
  }
  if (raw.wallClockTimedOut) {
    return {
      status: 'time_limit_exceeded',
      terminationReason: 'wall_clock_timeout',
    };
  }
  if (raw.exitCode === EXIT_SIGXCPU) {
    return {
      status: 'time_limit_exceeded',
      terminationReason: 'cpu_time_limit',
    };
  }
  if (
    raw.exitCode === EXIT_CGROUP_OOM ||
    (raw.exitCode === EXIT_SIGABRT &&
      /bad_alloc|cannot allocate memory/i.test(raw.stderrText))
  ) {
    return {
      status: 'memory_limit_exceeded',
      terminationReason: 'memory_limit',
    };
  }
  if (raw.exitCode !== 0) {
    return {
      status: 'runtime_error',
      terminationReason: 'runtime_error',
    };
  }
  return null;
}

function encodeRunStdin(binary: Buffer, testInput: string): Buffer {
  const header = Buffer.from(
    `${String(binary.length).padStart(16, '0')}\n`,
    'ascii',
  );
  const inputBuf = Buffer.from(testInput, 'utf8');
  return Buffer.concat([header, binary, inputBuf]);
}

function aggregateSubmissionVerdict(
  compileSuccess: boolean,
  testResults: readonly SandboxTestCaseResult[],
): SubmissionVerdict {
  if (!compileSuccess) {
    return 'CompileError';
  }
  for (const result of testResults) {
    switch (result.status) {
      case 'time_limit_exceeded':
        return 'TimeLimitExceeded';
      case 'memory_limit_exceeded':
        return 'MemoryLimitExceeded';
      case 'output_limit_exceeded':
        return 'OutputLimitExceeded';
      case 'runtime_error':
        return 'RuntimeError';
      case 'wrong_answer':
        return 'WrongAnswer';
      case 'accepted':
        break;
    }
  }
  return 'Accepted';
}

export function createDockerSandboxRunner(
  options: DockerSandboxRunnerOptions = {},
): SandboxRunner {
  const limits = resolveSandboxLimits(options.limits);
  const dockerCommand = options.dockerCommand ?? 'docker';
  const imageTag = options.imageTag ?? DEFAULT_SANDBOX_IMAGE;
  const containerNamePrefix = options.containerNamePrefix ?? 'leetkob-sbx';
  const hostEnv = options.hostEnv ?? process.env;
  const spawnProcess = options.spawnProcess ?? defaultSpawnSandboxProcess;
  const killContainer =
    options.killContainer ??
    ((containerName: string) =>
      defaultKillContainer(dockerCommand, containerName, hostEnv));

  const nextContainerName = (phase: 'compile' | 'run'): string =>
    `${containerNamePrefix}-${phase}-${randomUUID().slice(0, 12)}`;

  const compile = async (sourceCode: string): Promise<SandboxCompileResult> => {
    const containerName = nextContainerName('compile');
    const commandArgs = buildSandboxDockerArgs({
      mode: 'compile',
      containerName,
      imageTag,
      limits,
    });

    const raw = await executeContainer({
      dockerCommand,
      args: commandArgs,
      containerName,
      stdinPayload: Buffer.from(sourceCode, 'utf8'),
      wallTimeLimitSeconds: limits.compileWallTimeLimitSeconds,
      maxStdoutBytes: MAX_COMPILE_BINARY_BYTES,
      maxStderrBytes: limits.outputLimitBytes,
      hostEnv,
      spawnProcess,
      killContainer,
    });

    const stderrText = raw.stderr.toString('utf8');
    throwIfDockerInfraError(raw, stderrText);

    const failure = classifyExecutionFailure({
      exitCode: raw.exitCode,
      stderrText,
      outputTruncated: raw.outputTruncated,
      wallClockTimedOut: raw.wallClockTimedOut,
    });

    const success = failure === null && raw.stdout.length > 0;
    return {
      success,
      binary: success ? raw.stdout : null,
      exitCode: raw.exitCode,
      stderr: stderrText,
      outputTruncated: raw.outputTruncated || raw.exitCode === EXIT_SIGXFSZ,
      terminationReason: failure ? failure.terminationReason : 'normal',
      containerKilled: raw.containerKilled,
      containerName,
      durationMs: raw.durationMs,
      commandArgs,
    };
  };

  const runBinary = async (
    binary: Buffer,
    testCase: SandboxTestCase,
  ): Promise<SandboxTestCaseResult> => {
    const containerName = nextContainerName('run');
    const commandArgs = buildSandboxDockerArgs({
      mode: 'run',
      containerName,
      imageTag,
      limits,
    });

    const raw = await executeContainer({
      dockerCommand,
      args: commandArgs,
      containerName,
      stdinPayload: encodeRunStdin(binary, testCase.input),
      wallTimeLimitSeconds: limits.wallTimeLimitSeconds,
      maxStdoutBytes: limits.outputLimitBytes,
      maxStderrBytes: limits.outputLimitBytes,
      hostEnv,
      spawnProcess,
      killContainer,
    });

    const stdoutText = raw.stdout.toString('utf8');
    const stderrText = raw.stderr.toString('utf8');
    throwIfDockerInfraError(raw, stderrText);

    const failure = classifyExecutionFailure({
      exitCode: raw.exitCode,
      stderrText,
      outputTruncated: raw.outputTruncated,
      wallClockTimedOut: raw.wallClockTimedOut,
    });

    let status: SandboxTestCaseStatus;
    let terminationReason: SandboxTerminationReason;
    if (failure) {
      status = failure.status;
      terminationReason = failure.terminationReason;
    } else {
      terminationReason = 'normal';
      status =
        normalizeJudgeOutput(stdoutText) ===
        normalizeJudgeOutput(testCase.expectedOutput)
          ? 'accepted'
          : 'wrong_answer';
    }

    return {
      testCaseId: testCase.id,
      status,
      terminationReason,
      exitCode: raw.exitCode,
      signal: raw.signal,
      stdout: stdoutText,
      stderr: stderrText,
      outputTruncated: raw.outputTruncated || raw.exitCode === EXIT_SIGXFSZ,
      containerKilled: raw.containerKilled,
      containerName,
      durationMs: raw.durationMs,
      commandArgs,
    };
  };

  const compileAndRun = async (
    sourceCode: string,
    testCases: readonly SandboxTestCase[],
  ): Promise<SandboxSubmissionResult> => {
    const compileResult = await compile(sourceCode);
    const { binary: compiledBinary, ...compileSummary } = compileResult;
    if (!compileResult.success || compiledBinary === null) {
      return {
        verdict: 'CompileError',
        compileResult: compileSummary,
        testResults: [],
      };
    }

    const testResults: SandboxTestCaseResult[] = [];
    for (const testCase of testCases) {
      testResults.push(await runBinary(compiledBinary, testCase));
    }

    return {
      verdict: aggregateSubmissionVerdict(true, testResults),
      compileResult: compileSummary,
      testResults,
    };
  };

  return {
    compile,
    runBinary,
    compileAndRun,
  };
}
