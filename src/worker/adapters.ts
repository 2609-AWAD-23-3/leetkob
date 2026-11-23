import type { Store } from '../db/index.js';
import {
  createDockerSandboxRunner,
  type DockerSandboxRunnerOptions,
  type SandboxLimits,
  type SandboxRunner,
  type SandboxSubmissionResult,
  type SandboxTestCaseStatus,
  type SubmissionVerdict,
} from '../sandbox/index.js';
import {
  FIXED_JUDGE_LIMITS,
  type JudgeResult,
  type JudgeVerdict,
  type LabLimits,
  type Submission,
} from '../shared/domain/index.js';
import type { JudgeSubmissionFn } from './types.js';

const SUBMISSION_VERDICT_MAP: Record<SubmissionVerdict, JudgeVerdict> = {
  Accepted: 'AC',
  CompileError: 'CE',
  WrongAnswer: 'WA',
  TimeLimitExceeded: 'TLE',
  MemoryLimitExceeded: 'MLE',
  OutputLimitExceeded: 'RE',
  RuntimeError: 'RE',
};

const TEST_STATUS_MAP: Record<
  SandboxTestCaseStatus,
  Exclude<JudgeVerdict, 'CE'>
> = {
  accepted: 'AC',
  wrong_answer: 'WA',
  time_limit_exceeded: 'TLE',
  memory_limit_exceeded: 'MLE',
  output_limit_exceeded: 'RE',
  runtime_error: 'RE',
};

/** Converts lab CPU/memory limits plus FIXED_JUDGE_LIMITS into sandbox container limits. */
export function buildSandboxLimitsFromLab(labLimits: LabLimits): SandboxLimits {
  return {
    cpuTimeLimitSeconds: labLimits.cpuTimeMs / 1000,
    wallTimeLimitSeconds:
      (labLimits.cpuTimeMs * FIXED_JUDGE_LIMITS.wallTimeFactor) / 1000,
    memoryLimitMb: labLimits.memoryMb,
    maxProcesses: FIXED_JUDGE_LIMITS.maxProcesses,
    outputLimitBytes: FIXED_JUDGE_LIMITS.maxOutputBytes,
    compileCpuTimeLimitSeconds: FIXED_JUDGE_LIMITS.compileTimeMs / 1000,
    compileWallTimeLimitSeconds:
      (FIXED_JUDGE_LIMITS.compileTimeMs * FIXED_JUDGE_LIMITS.wallTimeFactor) /
      1000,
  };
}

export function mapSandboxVerdictToJudgeVerdict(
  verdict: SubmissionVerdict,
): JudgeVerdict {
  return SUBMISSION_VERDICT_MAP[verdict];
}

export function mapSandboxTestStatusToJudgeVerdict(
  status: SandboxTestCaseStatus,
): Exclude<JudgeVerdict, 'CE'> {
  return TEST_STATUS_MAP[status];
}

export function mapSandboxResultToJudgeResult(
  result: SandboxSubmissionResult,
): JudgeResult {
  if (!result.compileResult.success || result.verdict === 'CompileError') {
    return { verdict: 'CE', tests: [] };
  }
  return {
    verdict: mapSandboxVerdictToJudgeVerdict(result.verdict),
    tests: result.testResults.map((tc) => ({
      testId: tc.testCaseId,
      verdict: mapSandboxTestStatusToJudgeVerdict(tc.status),
    })),
  };
}

export interface SandboxJudgeAdapterOptions {
  readonly imageTag?: string | undefined;
  readonly dockerCommand?: string | undefined;
  readonly createRunner?:
    ((options: DockerSandboxRunnerOptions) => SandboxRunner) | undefined;
}

/**
 * Adapts the T05 Docker sandbox runner to the T06 worker JudgeSubmissionFn interface.
 */
export function createSandboxJudgeSubmission(
  options: SandboxJudgeAdapterOptions = {},
): JudgeSubmissionFn {
  const makeRunner = options.createRunner ?? createDockerSandboxRunner;

  return async ({ submission, lab }) => {
    const runnerOptions: DockerSandboxRunnerOptions = {
      limits: buildSandboxLimitsFromLab(lab.limits),
      ...(options.imageTag !== undefined ? { imageTag: options.imageTag } : {}),
      ...(options.dockerCommand !== undefined
        ? { dockerCommand: options.dockerCommand }
        : {}),
    };
    const runner = makeRunner(runnerOptions);
    const result = await runner.compileAndRun(
      submission.code,
      lab.tests.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
    );
    return mapSandboxResultToJudgeResult(result);
  };
}

/**
 * Resolves student identity strings from the store for fail-closed prompt redaction (T08/T11).
 */
export function createStoreIdentityResolver(
  store: Pick<Store, 'getUser' | 'getSubmission'>,
): (
  submission: Pick<Submission, 'id'> & {
    readonly studentId?: string | undefined;
  },
) => Promise<readonly string[]> {
  return async (submission) => {
    const studentId =
      submission.studentId ??
      (await store.getSubmission(submission.id))?.studentId;
    if (!studentId) {
      return [];
    }
    const user = await store.getUser(studentId);
    if (!user) {
      return [];
    }
    const candidates = [
      user.displayName,
      user.username,
      ...user.displayName.split(/\s+/),
    ];
    const seen = new Set<string>();
    const identities: string[] = [];
    for (const raw of candidates) {
      const trimmed = raw.trim();
      if (trimmed !== '' && !seen.has(trimmed)) {
        seen.add(trimmed);
        identities.push(trimmed);
      }
    }
    return identities;
  };
}
