import type {
  Job,
  JudgeResult,
  NewConstraintVerdict,
} from '../shared/domain/index.js';

// Used by the worker (PA03-T06). Postgres claims with FOR UPDATE SKIP LOCKED.
export interface JobQueue {
  // Takes the oldest unfinished job that has no lease or whose lease expired,
  // increments attempts and marks the submission 'judging'. A job that
  // already used maxAttempts (for example a worker crashed every time and
  // never called fail) is ended instead and its submission becomes 'failed'.
  // Every claim gets a fresh leaseToken; extendLease, complete and fail must
  // present it, so work left over from an earlier claim of the same job (even
  // by the same worker) can never touch the current lease.
  claim(input: {
    workerId: string;
    leaseMs: number;
    maxAttempts: number;
  }): Promise<Job | undefined>;
  // false when leaseToken is not the live lease of the job.
  extendLease(input: {
    jobId: string;
    leaseToken: string;
    leaseMs: number;
  }): Promise<boolean>;
  // One atomic step: store the judge result, insert verdicts (unique per
  // (submissionId, constraintId)), finish the job and mark the submission
  // 'judged'. An 'AC' result needs exactly one valid verdict per lab
  // constraint; any other result takes none (FAQ-04). Invalid input throws
  // TypeError and writes nothing. false when leaseToken is not the live
  // lease of the job; nothing is written then.
  complete(input: {
    jobId: string;
    leaseToken: string;
    judgeResult: JudgeResult;
    verdicts: NewConstraintVerdict[];
  }): Promise<boolean>;
  // Releases the job for a retry, or marks the submission 'failed' once
  // attempts reached maxAttempts. false when leaseToken is not the live
  // lease of the job.
  fail(input: {
    jobId: string;
    leaseToken: string;
    error: string;
    maxAttempts: number;
  }): Promise<boolean>;
}
