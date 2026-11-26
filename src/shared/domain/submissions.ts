// queued: waiting for a worker; judging: a worker holds the job;
// judged: judge result stored; failed: retries exhausted (system error).
export type SubmissionStatus = 'queued' | 'judging' | 'judged' | 'failed';

// Judge verdict codes used by the FAQ glossary.
export type JudgeVerdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE';

export interface TestResult {
  testId: string;
  verdict: Exclude<JudgeVerdict, 'CE'>;
}

// Students see the overall verdict and per-test verdicts, never test input/output (FAQ-02).
export interface JudgeResult {
  verdict: JudgeVerdict;
  tests: TestResult[]; // in lab test order; empty when verdict is CE
}

export interface Submission {
  id: string;
  labId: string;
  studentId: string;
  code: string;
  submittedAt: string; // time the server received it (FAQ-03)
  status: SubmissionStatus;
  judgeResult: JudgeResult | null;
}

export interface Job {
  id: string;
  submissionId: string;
  attempts: number;
  leaseOwner: string | null; // worker id, for logs and monitoring
  leaseToken: string | null; // identifies one claim; required to finish it
  leaseExpiresAt: string | null;
  lastError: string | null;
}
