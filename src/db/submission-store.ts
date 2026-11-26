import type {
  Submission,
  SubmissionStatus,
  JudgeVerdict,
} from '../shared/domain/index.js';

export type SubmissionSummary = Pick<
  Submission,
  'id' | 'labId' | 'studentId' | 'submittedAt' | 'status'
> & { verdict: JudgeVerdict | null };
export interface SubmissionPosition {
  submittedAt: string;
  seq: string;
}
export interface SubmissionListQuery {
  labId: string;
  studentId?: string;
  status?: SubmissionStatus;
  limit: number;
  after?: SubmissionPosition;
}
export interface SubmissionPage {
  submissions: SubmissionSummary[];
  next: SubmissionPosition | null;
}
export type SubmissionIntakeResult =
  | { kind: 'created' | 'replayed'; submission: Submission }
  | { kind: 'conflict' }
  | { kind: 'not-open' }
  | { kind: 'not-found' };

// Used by PA03-T04 (submit, status), PA03-T06 and PA03-T11.
export interface SubmissionStore {
  submitIdempotently(
    input: { labId: string; studentId: string; code: string },
    key: string,
  ): Promise<SubmissionIntakeResult>;
  listSubmissionSummaries(query: SubmissionListQuery): Promise<SubmissionPage>;
  // Stores a 'queued' submission and its judge job in one atomic step.
  // submittedAt captures the store clock on entry (server receive time,
  // FAQ-03), before awaiting readiness or database I/O. It is never supplied
  // by the client. Deadline, size, ownership and open-window checks (labPhase)
  // belong to the API before calling this.
  submit(input: {
    labId: string;
    studentId: string;
    code: string;
  }): Promise<Submission>;
  getSubmission(submissionId: string): Promise<Submission | undefined>;
  // Newest first.
  listSubmissions(labId: string, studentId: string): Promise<Submission[]>;
  // The last submission received while the lab was open (opensAt <= t <
  // deadline) of each student, whatever its result (FAQ-02). Before the deadline this is the provisional latest one.
  listCountedSubmissions(labId: string): Promise<Submission[]>;
  // Queues a new judge job for a 'failed' submission; false otherwise.
  requeue(submissionId: string): Promise<boolean>;
}
