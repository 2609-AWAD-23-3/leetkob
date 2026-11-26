import type { Migration } from './types.js';

export const migration0004: Migration = {
  id: '0004_lab_creation_idempotency',
  sql: `
CREATE TABLE lab_creation_requests (
  created_by text NOT NULL REFERENCES users(id),
  class_id text NOT NULL REFERENCES classes(id),
  key text NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  lab_id text NOT NULL UNIQUE REFERENCES labs(id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (created_by, class_id, key),
  CHECK (expires_at > created_at)
);
CREATE INDEX labs_class_created_id ON labs (class_id, created_at DESC, id COLLATE "C");
`,
};
