import type { Migration } from './types.js';

export const migration0001: Migration = {
  id: '0001_init',
  sql: `
CREATE TABLE users (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'TA', 'student')),
  password_hash text NOT NULL
);

CREATE TABLE classes (
  id   text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE class_memberships (
  user_id  text NOT NULL REFERENCES users (id),
  class_id text NOT NULL REFERENCES classes (id),
  role     text NOT NULL CHECK (role IN ('TA', 'student')),
  seq      bigserial NOT NULL,
  PRIMARY KEY (user_id, class_id)
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users (id),
  expires_at timestamptz NOT NULL
);

CREATE TABLE labs (
  id          text PRIMARY KEY,
  class_id    text NOT NULL REFERENCES classes (id),
  title       text NOT NULL,
  statement   text NOT NULL,
  opens_at    timestamptz NOT NULL,
  deadline    timestamptz NOT NULL,
  cpu_time_ms integer NOT NULL CHECK (cpu_time_ms BETWEEN 1000 AND 5000),
  memory_mb   integer NOT NULL CHECK (memory_mb BETWEEN 64 AND 512),
  created_by  text NOT NULL REFERENCES users (id),
  created_at  timestamptz NOT NULL,
  seq         bigserial NOT NULL,
  CHECK (opens_at < deadline)
);

CREATE TABLE lab_tests (
  lab_id          text NOT NULL REFERENCES labs (id),
  id              text NOT NULL,
  position        integer NOT NULL,
  input           text NOT NULL,
  expected_output text NOT NULL,
  PRIMARY KEY (lab_id, id),
  UNIQUE (lab_id, position)
);

CREATE TABLE lab_constraints (
  lab_id    text NOT NULL REFERENCES labs (id),
  id        text NOT NULL,
  position  integer NOT NULL,
  text      text NOT NULL,
  deduction double precision NOT NULL CHECK (deduction > 0 AND deduction <= 10),
  PRIMARY KEY (lab_id, id),
  UNIQUE (lab_id, position)
);

CREATE TABLE submissions (
  id           text PRIMARY KEY,
  lab_id       text NOT NULL REFERENCES labs (id),
  student_id   text NOT NULL REFERENCES users (id),
  code         text NOT NULL,
  submitted_at timestamptz NOT NULL,
  status       text NOT NULL
    CHECK (status IN ('queued', 'judging', 'judged', 'failed')),
  judge_result jsonb,
  seq          bigserial NOT NULL
);
CREATE INDEX submissions_lab_student ON submissions (lab_id, student_id);

CREATE TABLE jobs (
  id               text PRIMARY KEY,
  submission_id    text NOT NULL REFERENCES submissions (id),
  attempts         integer NOT NULL DEFAULT 0,
  lease_owner      text,
  -- New random token per claim; only its holder may extend, complete or fail.
  lease_token      text,
  lease_expires_at timestamptz,
  last_error       text,
  done             boolean NOT NULL DEFAULT false,
  seq              bigserial NOT NULL
);
CREATE INDEX jobs_open ON jobs (seq) WHERE NOT done;

CREATE TABLE verdicts (
  id            text PRIMARY KEY,
  submission_id text NOT NULL REFERENCES submissions (id),
  constraint_id text NOT NULL,
  verdict       text NOT NULL CHECK (verdict IN ('pass', 'violation', 'unsure')),
  evidence      jsonb NOT NULL,
  unsure_cause  text CHECK (unsure_cause IN
    ('model_unsure', 'schema_error', 'evidence_mismatch', 'timeout', 'cost_cap')),
  reason        text,
  source        text NOT NULL CHECK (source IN ('hard_rule', 'model')),
  created_at    timestamptz NOT NULL,
  ta_decision   text CHECK (ta_decision IN ('pass', 'violation')),
  ta_evidence   jsonb NOT NULL DEFAULT '[]',
  reviewed_by   text REFERENCES users (id),
  reviewed_at   timestamptz,
  seq           bigserial NOT NULL,
  -- One verdict per (submission, constraint): a restarted worker cannot
  -- store a second set (PA03-T06).
  UNIQUE (submission_id, constraint_id),
  CHECK ((verdict = 'unsure') = (unsure_cause IS NOT NULL))
);

CREATE TABLE review_decisions (
  seq        bigserial PRIMARY KEY,
  item_id    text NOT NULL REFERENCES verdicts (id),
  changed_by text NOT NULL REFERENCES users (id),
  changed_at timestamptz NOT NULL,
  previous   text CHECK (previous IN ('pass', 'violation')),
  next       text NOT NULL CHECK (next IN ('pass', 'violation')),
  evidence   jsonb NOT NULL
);

CREATE TABLE model_calls (
  id             text PRIMARY KEY,
  submission_id  text NOT NULL REFERENCES submissions (id),
  constraint_ids jsonb NOT NULL,
  provider       text NOT NULL,
  model          text NOT NULL,
  request_id     text,
  input_tokens   integer NOT NULL,
  output_tokens  integer NOT NULL,
  latency_ms     integer NOT NULL,
  cost_usd       double precision NOT NULL,
  outcome        text NOT NULL
    CHECK (outcome IN ('ok', 'schema_error', 'timeout', 'provider_error')),
  created_at     timestamptz NOT NULL,
  seq            bigserial NOT NULL
);

CREATE TABLE publications (
  lab_id                   text PRIMARY KEY REFERENCES labs (id),
  published_at             timestamptz NOT NULL,
  published_by             text NOT NULL REFERENCES users (id),
  queue_item_count         integer NOT NULL,
  pass_decision_count      integer NOT NULL,
  violation_decision_count integer NOT NULL
);
`,
};
