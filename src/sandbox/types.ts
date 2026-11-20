export interface SandboxLimits {
  readonly cpuTimeLimitSeconds: number;
  readonly wallTimeLimitSeconds: number;
  readonly memoryLimitMb: number;
  readonly maxProcesses: number;
  readonly outputLimitBytes: number;
  readonly compileCpuTimeLimitSeconds: number;
  readonly compileWallTimeLimitSeconds: number;
}

export type SandboxTerminationReason =
  | 'normal'
  | 'cpu_time_limit'
  | 'wall_clock_timeout'
  | 'memory_limit'
  | 'output_size_limit'
  | 'runtime_error';

export type SandboxTestCaseStatus =
  | 'accepted'
  | 'wrong_answer'
  | 'time_limit_exceeded'
  | 'memory_limit_exceeded'
  | 'output_limit_exceeded'
  | 'runtime_error';

export type SubmissionVerdict =
  | 'Accepted'
  | 'CompileError'
  | 'WrongAnswer'
  | 'TimeLimitExceeded'
  | 'MemoryLimitExceeded'
  | 'OutputLimitExceeded'
  | 'RuntimeError';

export interface SandboxTestCase {
  readonly id: string;
  readonly input: string;
  readonly expectedOutput: string;
}

export interface SandboxCompileResult {
  readonly success: boolean;
  readonly binary: Buffer | null;
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly outputTruncated: boolean;
  readonly terminationReason: SandboxTerminationReason;
  readonly containerKilled: boolean;
  readonly containerName: string;
  readonly durationMs: number;
  readonly commandArgs: readonly string[];
}

export interface SandboxTestCaseResult {
  readonly testCaseId: string;
  readonly status: SandboxTestCaseStatus;
  readonly terminationReason: SandboxTerminationReason;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly outputTruncated: boolean;
  readonly containerKilled: boolean;
  readonly containerName: string;
  readonly durationMs: number;
  readonly commandArgs: readonly string[];
}

export interface SandboxSubmissionResult {
  readonly verdict: SubmissionVerdict;
  readonly compileResult: Omit<SandboxCompileResult, 'binary'>;
  readonly testResults: readonly SandboxTestCaseResult[];
}

export interface SandboxRunner {
  compile(sourceCode: string): Promise<SandboxCompileResult>;
  runBinary(
    binary: Buffer,
    testCase: SandboxTestCase,
  ): Promise<SandboxTestCaseResult>;
  compileAndRun(
    sourceCode: string,
    testCases: readonly SandboxTestCase[],
  ): Promise<SandboxSubmissionResult>;
}
