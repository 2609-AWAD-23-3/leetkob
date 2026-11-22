import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
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
const STATUS_FRAME_PREFIX = '\n__LEETKOB_STATUS__:';
const STATUS_FRAME_MAX_BYTES = 512;
const DEFAULT_FALLBACK_KILL_DELAY_MS = 1500;
const DEFAULT_CLEANUP_TIMEOUT_MS = 5000;
const FORCED_CLOSE_GRACE_MS = 500;
const DEFAULT_DOCKER_DIR = fileURLToPath(
  new URL('../../docker', import.meta.url),
);

type HelperStatusOutcome =
  | 'exited'
  | 'signaled'
  | 'cpu_time_limit'
  | 'memory_limit'
  | 'output_size_limit'
  | 'infra_error';

interface ParsedHelperStatusFrame {
  readonly outcome: HelperStatusOutcome;
  readonly exitCode: number;
  readonly signal: number;
  readonly cpuUsec: number;
}

const VALID_HELPER_OUTCOMES = new Set<HelperStatusOutcome>([
  'exited',
  'signaled',
  'cpu_time_limit',
  'memory_limit',
  'output_size_limit',
  'infra_error',
]);

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
  readonly statusToken?: string;
}

export interface DockerSandboxRunnerOptions {
  readonly imageTag?: string;
  readonly dockerCommand?: string;
  readonly limits?: Partial<SandboxLimits>;
  readonly hostEnv?: NodeJS.ProcessEnv;
  readonly spawnProcess?: SpawnSandboxProcess;
  readonly killContainer?: (containerName: string) => Promise<void>;
  readonly containerNamePrefix?: string;
  readonly fallbackKillDelayMs?: number;
  readonly cleanupTimeoutMs?: number;
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
  const normalizeCpuSeconds = (value: number, key: string): number => {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `Sandbox limit "${key}" must be a positive finite number (>= 0.001s)`,
      );
    }
    const ms = Math.round(value * 1000);
    if (ms < 1) {
      throw new Error(
        `Sandbox limit "${key}" must be a positive finite number (>= 0.001s)`,
      );
    }
    return ms / 1000;
  };

  const cpuTimeLimitSeconds = normalizeCpuSeconds(
    overrides.cpuTimeLimitSeconds ?? FAQ05_SANDBOX_LIMITS.cpuTimeLimitSeconds,
    'cpuTimeLimitSeconds',
  );
  const compileCpuTimeLimitSeconds = normalizeCpuSeconds(
    overrides.compileCpuTimeLimitSeconds ??
      FAQ05_SANDBOX_LIMITS.compileCpuTimeLimitSeconds,
    'compileCpuTimeLimitSeconds',
  );
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
    compileCpuTimeLimitSeconds,
    compileWallTimeLimitSeconds:
      overrides.compileWallTimeLimitSeconds ??
      FAQ05_SANDBOX_LIMITS.compileWallTimeLimitSeconds,
  };

  const integerLimitKeys = [
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
  const ulimitCpuSec = Math.max(1, Math.ceil(cpuLimitSec));
  const fsizeLimitBytes =
    options.mode === 'compile'
      ? MAX_COMPILE_BINARY_BYTES
      : limits.outputLimitBytes;

  const args: string[] = [
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
    `cpu=${ulimitCpuSec}:${ulimitCpuSec + 1}`,
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

  if (options.statusToken && options.statusToken.length > 0) {
    args.push(options.statusToken);
  }

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

function resolvePositiveDurationMs(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Sandbox option "${name}" must be a positive finite number`,
    );
  }
  return value;
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
  cleanupTimeoutMs: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const killer = spawn(dockerCommand, ['rm', '-f', containerName], {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: sanitizeDockerHostEnv(hostEnv),
      windowsHide: true,
    });

    const stderrChunks: Buffer[] = [];
    let stderrBytes = 0;
    killer.stderr.on('data', (chunk: Buffer) => {
      if (stderrBytes < 4096) {
        const slice = chunk.subarray(0, 4096 - stderrBytes);
        stderrChunks.push(slice);
        stderrBytes += slice.length;
      }
    });

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      killer.kill('SIGKILL');
      reject(
        new Error(
          `docker rm -f timed out after ${cleanupTimeoutMs}ms for container "${containerName}"`,
        ),
      );
    }, cleanupTimeoutMs);
    timer.unref();

    killer.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    killer.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const stderrText = Buffer.concat(stderrChunks).toString('utf8');
      if (
        code === 0 ||
        /no such container|already in progress|is not running/i.test(stderrText)
      ) {
        resolve();
        return;
      }
      reject(
        new Error(
          `docker rm -f failed with exit code ${String(code)} for container "${containerName}": ${stderrText.trim() || 'unknown error'}`,
        ),
      );
    });
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

function parseHelperStatusFrame(
  stderrBuf: Buffer,
  expectedToken: string,
): {
  readonly frame: ParsedHelperStatusFrame | null;
  readonly userStderr: Buffer;
} {
  if (
    stderrBuf.length === 0 ||
    stderrBuf[stderrBuf.length - 1] !== 0x0a ||
    expectedToken.length === 0
  ) {
    return { frame: null, userStderr: stderrBuf };
  }

  const marker = Buffer.from(
    `${STATUS_FRAME_PREFIX}${expectedToken}:`,
    'ascii',
  );
  const idx = stderrBuf.lastIndexOf(marker);
  if (idx < 0) {
    return { frame: null, userStderr: stderrBuf };
  }

  const payloadBuf = stderrBuf.subarray(
    idx + marker.length,
    stderrBuf.length - 1,
  );
  if (payloadBuf.indexOf(0x0a) !== -1) {
    return { frame: null, userStderr: stderrBuf };
  }

  const parts = payloadBuf.toString('ascii').split(':');
  if (parts.length !== 4) {
    return { frame: null, userStderr: stderrBuf };
  }

  const [outcomeRaw, exitCodeRaw, signalRaw, cpuUsecRaw] = parts;
  if (
    !outcomeRaw ||
    !exitCodeRaw ||
    !signalRaw ||
    !cpuUsecRaw ||
    !VALID_HELPER_OUTCOMES.has(outcomeRaw as HelperStatusOutcome) ||
    !/^-?\d+$/.test(exitCodeRaw) ||
    !/^-?\d+$/.test(signalRaw) ||
    !/^\d+$/.test(cpuUsecRaw)
  ) {
    return { frame: null, userStderr: stderrBuf };
  }

  const exitCode = Number(exitCodeRaw);
  const signal = Number(signalRaw);
  const cpuUsec = Number(cpuUsecRaw);
  if (
    !Number.isInteger(exitCode) ||
    !Number.isInteger(signal) ||
    !Number.isSafeInteger(cpuUsec)
  ) {
    return { frame: null, userStderr: stderrBuf };
  }

  return {
    frame: {
      outcome: outcomeRaw as HelperStatusOutcome,
      exitCode,
      signal,
      cpuUsec,
    },
    userStderr: stderrBuf.subarray(0, idx),
  };
}

type CleanupOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'timeout' | 'rejected';
      readonly message: string;
    };

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
  fallbackKillDelayMs: number;
  cleanupTimeoutMs: number;
}): Promise<RawExecutionResult> {
  const startedAt = Date.now();
  const proc = params.spawnProcess(params.dockerCommand, params.args, {
    env: sanitizeDockerHostEnv(params.hostEnv),
  });

  const stdoutCollector = createStreamCollector(params.maxStdoutBytes);
  const stderrCollector = createStreamCollector(params.maxStderrBytes);

  let wallClockTimedOut = false;
  let containerKilled = false;
  let fallbackKillSent = false;
  let forcedClose = false;
  let closed = false;
  const cleanupState: { promise: Promise<CleanupOutcome> | null } = {
    promise: null,
  };
  let wallTimer: NodeJS.Timeout | null = null;
  let fallbackKillTimer: NodeJS.Timeout | null = null;
  let cleanupTimer: NodeJS.Timeout | null = null;
  let closeGraceTimer: NodeJS.Timeout | null = null;
  let forceCloseCallback: (() => void) | null = null;

  const clearRunTimers = (): void => {
    if (wallTimer) {
      clearTimeout(wallTimer);
      wallTimer = null;
    }
    if (fallbackKillTimer) {
      clearTimeout(fallbackKillTimer);
      fallbackKillTimer = null;
    }
    if (closeGraceTimer) {
      clearTimeout(closeGraceTimer);
      closeGraceTimer = null;
    }
  };

  const scheduleForceClose = (delayMs: number): void => {
    if (closed || closeGraceTimer) {
      return;
    }
    closeGraceTimer = setTimeout(() => {
      closeGraceTimer = null;
      if (!closed && forceCloseCallback) {
        forceCloseCallback();
      }
    }, delayMs);
    closeGraceTimer.unref();
  };

  const sendFallbackKill = (): void => {
    if (closed || fallbackKillSent) {
      return;
    }
    fallbackKillSent = true;
    try {
      proc.kill('SIGKILL');
    } catch {
      // Ignore synchronously thrown errors on an already-exited handle.
    }
  };

  const triggerContainerKill = (): void => {
    if (containerKilled) {
      return;
    }
    containerKilled = true;

    const effectiveFallbackDelayMs = Math.min(
      params.fallbackKillDelayMs,
      params.cleanupTimeoutMs,
    );
    fallbackKillTimer = setTimeout(() => {
      fallbackKillTimer = null;
      if (!closed) {
        sendFallbackKill();
        scheduleForceClose(
          Math.min(FORCED_CLOSE_GRACE_MS, params.cleanupTimeoutMs),
        );
      }
    }, effectiveFallbackDelayMs);
    fallbackKillTimer.unref();

    cleanupState.promise = new Promise<CleanupOutcome>((resolve) => {
      let settled = false;
      const finish = (outcome: CleanupOutcome): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (cleanupTimer) {
          clearTimeout(cleanupTimer);
          cleanupTimer = null;
        }
        if (!outcome.ok) {
          sendFallbackKill();
          scheduleForceClose(Math.min(200, params.cleanupTimeoutMs));
        }
        resolve(outcome);
      };

      cleanupTimer = setTimeout(() => {
        finish({
          ok: false,
          reason: 'timeout',
          message: `container cleanup timed out after ${params.cleanupTimeoutMs}ms`,
        });
      }, params.cleanupTimeoutMs);
      cleanupTimer.unref();

      Promise.resolve()
        .then(() => params.killContainer(params.containerName))
        .then(
          () => finish({ ok: true }),
          (error: unknown) => {
            const detail =
              error instanceof Error ? error.message : String(error);
            finish({
              ok: false,
              reason: 'rejected',
              message: `container cleanup failed: ${detail}`,
            });
          },
        );
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
    forceCloseCallback = () => {
      if (closed) {
        return;
      }
      closed = true;
      forcedClose = true;
      clearRunTimers();
      resolve({ exitCode: null, signal: 'SIGKILL' });
    };

    proc.on('error', (error) => {
      if (closed) {
        return;
      }
      closed = true;
      clearRunTimers();
      reject(error);
    });

    proc.on('close', (code, signal) => {
      if (closed) {
        return;
      }
      closed = true;
      clearRunTimers();
      resolve({ exitCode: code, signal });
    });

    wallTimer = setTimeout(() => {
      wallClockTimedOut = true;
      triggerContainerKill();
    }, params.wallTimeLimitSeconds * 1000);
    wallTimer.unref();

    proc.stdin.end(params.stdinPayload);
  });

  const cleanupOutcome = cleanupState.promise
    ? await cleanupState.promise
    : null;
  if (cleanupOutcome && !cleanupOutcome.ok) {
    throw new Error(
      `Docker sandbox infrastructure error: ${cleanupOutcome.message} (container "${params.containerName}")`,
    );
  }
  if (forcedClose) {
    throw new Error(
      `Docker sandbox infrastructure error: sandbox process did not exit after fallback SIGKILL (container "${params.containerName}")`,
    );
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

function throwIfDockerInfraError(params: {
  raw: RawExecutionResult;
  frame: ParsedHelperStatusFrame | null;
  userStderrText: string;
  outputTruncated: boolean;
}): void {
  if (params.raw.wallClockTimedOut || params.outputTruncated) {
    return;
  }
  if (params.frame === null) {
    throw new Error(
      `Docker sandbox infrastructure error (exit ${String(params.raw.exitCode)}): ${params.userStderrText.trim() || 'sandbox helper did not report status'}`,
    );
  }
  if (params.frame.outcome === 'infra_error') {
    throw new Error(
      `Docker sandbox helper infrastructure error (exit ${String(params.frame.exitCode)}): ${params.userStderrText.trim() || 'helper failed'}`,
    );
  }
}

function classifyExecutionFailure(raw: {
  frame: ParsedHelperStatusFrame | null;
  exitCode: number | null;
  stderrText: string;
  outputTruncated: boolean;
  wallClockTimedOut: boolean;
}): {
  status: Exclude<SandboxTestCaseStatus, 'accepted' | 'wrong_answer'>;
  terminationReason: Exclude<SandboxTerminationReason, 'normal'>;
} | null {
  if (
    raw.outputTruncated ||
    raw.frame?.outcome === 'output_size_limit' ||
    (raw.frame === null && raw.exitCode === EXIT_SIGXFSZ)
  ) {
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
  if (
    raw.frame?.outcome === 'cpu_time_limit' ||
    (raw.frame === null && raw.exitCode === EXIT_SIGXCPU)
  ) {
    return {
      status: 'time_limit_exceeded',
      terminationReason: 'cpu_time_limit',
    };
  }
  if (
    raw.frame?.outcome === 'memory_limit' ||
    (raw.frame === null && raw.exitCode === EXIT_CGROUP_OOM) ||
    (((raw.frame?.outcome === 'signaled' && raw.frame.signal === 6) ||
      (raw.frame === null && raw.exitCode === EXIT_SIGABRT)) &&
      /bad_alloc|cannot allocate memory/i.test(raw.stderrText))
  ) {
    return {
      status: 'memory_limit_exceeded',
      terminationReason: 'memory_limit',
    };
  }
  if (
    raw.frame?.outcome === 'signaled' ||
    (raw.frame?.outcome === 'exited' && raw.frame.exitCode !== 0) ||
    (raw.frame === null && raw.exitCode !== 0)
  ) {
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
  const fallbackKillDelayMs = resolvePositiveDurationMs(
    options.fallbackKillDelayMs,
    DEFAULT_FALLBACK_KILL_DELAY_MS,
    'fallbackKillDelayMs',
  );
  const cleanupTimeoutMs = resolvePositiveDurationMs(
    options.cleanupTimeoutMs,
    DEFAULT_CLEANUP_TIMEOUT_MS,
    'cleanupTimeoutMs',
  );
  const spawnProcess = options.spawnProcess ?? defaultSpawnSandboxProcess;
  const killContainer =
    options.killContainer ??
    ((containerName: string) =>
      defaultKillContainer(
        dockerCommand,
        containerName,
        hostEnv,
        cleanupTimeoutMs,
      ));

  const nextContainerName = (phase: 'compile' | 'run'): string =>
    `${containerNamePrefix}-${phase}-${randomUUID().slice(0, 12)}`;

  const compile = async (sourceCode: string): Promise<SandboxCompileResult> => {
    const containerName = nextContainerName('compile');
    const statusToken = randomBytes(16).toString('hex');
    const commandArgs = buildSandboxDockerArgs({
      mode: 'compile',
      containerName,
      imageTag,
      limits,
      statusToken,
    });

    const raw = await executeContainer({
      dockerCommand,
      args: commandArgs,
      containerName,
      stdinPayload: Buffer.from(sourceCode, 'utf8'),
      wallTimeLimitSeconds: limits.compileWallTimeLimitSeconds,
      maxStdoutBytes: MAX_COMPILE_BINARY_BYTES,
      maxStderrBytes: limits.outputLimitBytes + STATUS_FRAME_MAX_BYTES,
      hostEnv,
      spawnProcess,
      killContainer,
      fallbackKillDelayMs,
      cleanupTimeoutMs,
    });

    const parsed = parseHelperStatusFrame(raw.stderr, statusToken);
    const userStderrExceeded =
      parsed.userStderr.length > limits.outputLimitBytes;
    const boundedUserStderr = userStderrExceeded
      ? parsed.userStderr.subarray(0, limits.outputLimitBytes)
      : parsed.userStderr;
    const stderrText = boundedUserStderr.toString('utf8');
    const outputTruncated =
      raw.outputTruncated ||
      userStderrExceeded ||
      parsed.frame?.outcome === 'output_size_limit';

    throwIfDockerInfraError({
      raw,
      frame: parsed.frame,
      userStderrText: stderrText,
      outputTruncated,
    });

    const reportedExitCode = parsed.frame
      ? parsed.frame.exitCode
      : raw.exitCode;
    const failure = classifyExecutionFailure({
      frame: parsed.frame,
      exitCode: reportedExitCode,
      stderrText,
      outputTruncated,
      wallClockTimedOut: raw.wallClockTimedOut,
    });

    const success = failure === null && raw.stdout.length > 0;
    return {
      success,
      binary: success ? raw.stdout : null,
      exitCode: reportedExitCode,
      stderr: stderrText,
      outputTruncated,
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
    const statusToken = randomBytes(16).toString('hex');
    const commandArgs = buildSandboxDockerArgs({
      mode: 'run',
      containerName,
      imageTag,
      limits,
      statusToken,
    });

    const raw = await executeContainer({
      dockerCommand,
      args: commandArgs,
      containerName,
      stdinPayload: encodeRunStdin(binary, testCase.input),
      wallTimeLimitSeconds: limits.wallTimeLimitSeconds,
      maxStdoutBytes: limits.outputLimitBytes,
      maxStderrBytes: limits.outputLimitBytes + STATUS_FRAME_MAX_BYTES,
      hostEnv,
      spawnProcess,
      killContainer,
      fallbackKillDelayMs,
      cleanupTimeoutMs,
    });

    const parsed = parseHelperStatusFrame(raw.stderr, statusToken);
    const userStderrExceeded =
      parsed.userStderr.length > limits.outputLimitBytes;
    const boundedUserStderr = userStderrExceeded
      ? parsed.userStderr.subarray(0, limits.outputLimitBytes)
      : parsed.userStderr;
    const stdoutText = raw.stdout.toString('utf8');
    const stderrText = boundedUserStderr.toString('utf8');
    const outputTruncated =
      raw.outputTruncated ||
      userStderrExceeded ||
      parsed.frame?.outcome === 'output_size_limit';

    throwIfDockerInfraError({
      raw,
      frame: parsed.frame,
      userStderrText: stderrText,
      outputTruncated,
    });

    const reportedExitCode = parsed.frame
      ? parsed.frame.exitCode
      : raw.exitCode;
    const failure = classifyExecutionFailure({
      frame: parsed.frame,
      exitCode: reportedExitCode,
      stderrText,
      outputTruncated,
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
      exitCode: reportedExitCode,
      signal: raw.signal,
      stdout: stdoutText,
      stderr: stderrText,
      outputTruncated,
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
