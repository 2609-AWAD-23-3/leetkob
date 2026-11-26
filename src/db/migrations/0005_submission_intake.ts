import type { Migration } from './types.js';

export const migration0005: Migration = {
  id: '0005_submission_intake',
  sql: `
CREATE TABLE submission_intake_requests (
  student_id text NOT NULL REFERENCES users(id),
  lab_id text NOT NULL REFERENCES labs(id),
  key text NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  submission_id text NOT NULL UNIQUE REFERENCES submissions(id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  PRIMARY KEY (student_id,lab_id,key)
);
CREATE INDEX submissions_lab_time ON submissions(lab_id,submitted_at DESC,seq DESC);
CREATE INDEX submissions_lab_student_time ON submissions(lab_id,student_id,submitted_at DESC,seq DESC);
`,
};
