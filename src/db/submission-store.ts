import type { Submission } from '../shared/domain/index.js';

// Used by PA03-T04 (submit, status), PA03-T06 and PA03-T11.
export interface SubmissionStore {
  // Stores a 'queued' submission and its judge job in one atomic step.
  // submittedAt is the store clock (server receive time, FAQ-03). Deadline,
  // size, ownership and open-window checks (labPhase) belong to the API
  // before calling this.
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
