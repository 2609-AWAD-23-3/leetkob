# Labs — PA03-T04 phase 2

Create/read only. No update/delete, hidden/paused switches, admin provisioning, submissions or judging endpoints. The clock determines draft/open/closed; publication remains a separate T09 concern. Auth and Publish v1 contracts remain unchanged.

## Endpoints and authorization

All lab routes use server session Bearer auth and `Cache-Control: no-store`.

| Method/path | Result |
| --- | --- |
| POST /classes/:classId/labs | 201 `{ lab }`; Location: /labs/:id |
| GET /classes/:classId/labs | 200 `{ labs: [...] }`, no pagination |
| GET /labs/:labId | 200 `{ lab }`, role-specific detail |

Validate authentication, path ID, role and class membership before reading upload bodies. IDs match `[a-zA-Z0-9_-]{1,64}`. Only class TAs create labs. Student/admin creation and all admin lab access return 403. Missing/invalid/expired session returns 401 with WWW-Authenticate: Bearer. Unknown or inaccessible resources and student requests for draft labs return 404. A valid class with no visible labs returns an empty array.

TA/student reads require both their principal role and matching membership role. Students can see labs of multiple classes if enrolled in them, but never other students' test/review data. Authorization is checked again on replay. Body identity fields, role and phase are rejected: classId comes from the path, createdBy from the session.

## Creation and import

JSON requires exactly title, statement, tests, constraints, deadline; optional opensAt and limits. Title is trimmed; other text preserves whitespace and newlines. Constraints may be empty; tests must not be empty. With no opensAt the lab opens when it is created. Limits default to cpuTimeMs 1000 and memoryMb 256; if limits is present it must have both fields. CPU is an integer 1000–5000 ms, memory an integer 64–512 MiB. Constraint deduction is finite, greater than 0 and at most 10; the sum can exceed 10.

Timestamps must be canonical UTC ISO strings with milliseconds, e.g. `2026-11-25T15:00:00.000Z`. A fresh creation requires a future deadline and opensAt before deadline; a backdated opensAt is allowed. The Store checks fresh-creation time after acquiring the idempotency lock. Legacy Store.createLab retains historical-fixture support.

```json
{
  "title": "Sum two integers",
  "statement": "Read two integers and print their sum.\n",
  "deadline": "2027-01-01T00:00:00.000Z",
  "tests": [{ "id": "t1", "input": "2 3\n", "expectedOutput": "5\n" }],
  "constraints": []
}
```

Multipart uses exactly one JSON text field named `lab`, and up to two JSON file parts named testsFile and constraintsFile. Parts can arrive in any order. If a file provides a group, omit the corresponding inline property. Missing/both sources, duplicate or unknown parts/fields return 400. File names/extensions do not determine content; the part name and validated JSON structure do. UTF-8 file decoding is strict and accepts a leading BOM; files are never saved to disk or persisted as attachments.

testsFile must contain exactly `{"tests":[{"id":"t1","input":"2 3\n","expectedOutput":"5\n"}]}`. constraintsFile must contain exactly `{"constraints":[]}` or a populated array of `{ id, text, deduction }`. All nested fields are exact; IDs are unique within each group of a lab. Test input/output must be strings, including numeric values; empty strings are allowed. Test comparison is the runner's responsibility; API import does not trim or normalize test data.

Repository-owned examples are in [tests.json](../examples/labs/tests.json), [constraints.json](../examples/labs/constraints.json) and [lab-metadata.json](../examples/labs/lab-metadata.json). Use the metadata file's contents in lab when uploading both files. These examples are independent of eval data.

| Limit | Value |
| --- | --- |
| Total HTTP body, including multipart framing | 20 MiB |
| Title after trim | 1–200 Unicode code points |
| Statement | Nonblank, at most 256 KiB UTF-8 |
| Tests | 1–100 |
| Each input / expected output | At most 1 MiB UTF-8 |
| Total decoded test input/output | At most 16 MiB UTF-8 |
| Constraints | 0–50 |
| Each constraint text | Nonblank, at most 4 KiB UTF-8 |

All persisted text must be well-formed Unicode without NUL. The same size/text validation is shared with the Stores. Request byte counters cover chunked bodies and the aggregate of multipart parts; per-part parser limits also apply. Abort/truncation is handled without partial writes. Counts/shape errors return 400, byte-size overflow 413, unsupported Content-Type 415. Malformed UTF-8/JSON returns 400. A failed import does not reserve its key or create a partial lab.

## Idempotency

POST requires one Idempotency-Key header containing a UUID v4. Use a new random key for each intended new lab; keep it for retries/double-clicks. A key is scoped by authenticated TA and class. Same valid key and canonical payload within 24 hours returns the same lab ID with 201, Location and Idempotent-Replayed: true. Different canonical payload returns 409.

The fingerprint ignores JSON key order and import source, trims title, fills default limits, preserves arrays/text and represents omitted opensAt with a clock-independent marker. Replay is allowed after deadline while the key remains valid; response phase is computed at the current read/response time. It does not create a new lab or extend key lifetime. Keys expire at exactly createdAt + 24 hours; reuse then performs a fresh creation if current time rules permit it. Expired records are replaced lazily for the same scope; the original lab remains.

PostgreSQL serializes a scope with a transaction-level advisory lock. Lab, tests, constraints and key are inserted in one transaction. Rollback does not leave a pending key. Store reopens/server restarts preserve keys. The in-memory implementation updates lab/key state without yielding between check and commit. Migration 0004 adds this metadata and a class summary index; earlier migration IDs/SQL are unchanged.

## Read DTOs and errors

List items contain only id, classId, title, opensAt, deadline, createdAt, phase; ordered by createdAt descending, then ID ascending (C/ASCII order). PostgreSQL reads only labs metadata, not all tests/constraints. Student lists exclude draft. TA details contain the full Lab plus phase. Student details contain exactly id, classId, title, statement, opensAt, deadline, limits, constraints, phase; no tests, createdBy or review data. Students retain access to closed labs of their classes. Timestamps determine phase at the boundaries: opensAt inclusive, deadline exclusive for open.

Errors use the existing RFC 9457 namespace and application/problem+json: 400 validation/parsing/time; 401 unauthenticated; 403 wrong role; 404 inaccessible/unknown; 409 key conflict; 413 byte limit; 415 media type; 503 temporary database outage; 500 sanitized internal failures. Never map every Store TypeError to client validation: only the parsing/validation boundary does that. Responses/logs do not include raw database errors or uploaded payloads.
