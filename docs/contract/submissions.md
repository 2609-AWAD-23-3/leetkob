# Submissions — PA03-T04 phase 3

Intake/read APIs only. Worker execution, retry/requeue, compilation, sandbox, model, publication and review belong to later integration. Each attempt stores one C++ source string; ZIP/multiple files and edit/delete are outside PA3. Existing Store.submit remains the fixture/worker compatibility path.

## HTTP and authorization

All endpoints use server-session Bearer credentials and `Cache-Control: no-store`.

| Endpoint | Access | Success |
| --- | --- | --- |
| POST /labs/:labId/submissions | Student member of the lab's class | 201 `{ submission, notice }`; Location: /submissions/:id |
| GET /labs/:labId/submissions/mine | Student member | 200 `{ submissions, nextCursor }` |
| GET /labs/:labId/submissions | TA member | 200 `{ submissions, nextCursor }` |
| GET /submissions/:submissionId | Student owner with current membership or class TA | 200 `{ submission }` |

IDs use `[a-zA-Z0-9_-]{1,64}`. Missing/invalid/expired credentials: 401 and WWW-Authenticate: Bearer. Wrong endpoint role, including admin: 403. Unknown/inaccessible lab/submission, another student's submission, missing membership or student access to a draft lab: 404. TA has no cross-class access. Reads remain available after deadline; revoked membership removes access. Role and membership checks precede upload parsing. Identity/time/status are never taken from client input.

### DTOs

Submission detail/POST: exactly `id`, `labId`, `studentId`, `code`, `submittedAt`, `status`, `judgeResult`. A new submission has status queued and judgeResult null. Stored results, when present, contain only overall verdict and `{ testId, verdict }[]`, using T03's JudgeResult. No input/output, review verdicts, job IDs, leases or internal failure diagnostics.

Summary: exactly `id`, `labId`, `studentId`, `submittedAt`, `status`, `verdict`. Verdict is the overall judge verdict or null. The SQL summary projection does not read source code or the per-test result array. No total count is returned.

Notice: “Mã nguồn được soát bằng luật cứng và mô hình AI. Dữ liệu gửi tới mô hình được loại bỏ comment và thông tin định danh sinh viên. Mô hình không quyết điểm; TA duyệt trước khi công bố.” This phase communicates that policy; it does not perform sanitization/model calls or alter stored source.

### Pagination

Both lists accept limit (integer 1–100, default 20) and cursor. TA additionally accepts studentId and status (`queued`, `judging`, `judged`, `failed`). Mine rejects filters, including studentId. Duplicate, unknown or malformed query values return 400. Student identity is always the current session user.

Order: submittedAt descending, then insertion sequence descending. Cursor is canonical base64url encoding of JSON `{ v: 1, labId, studentId, status, submittedAt, seq }`; absent filter values are null, seq is a decimal string. It must match the current lab and filters. Cursor input is bounded to 2048 characters, structurally validated and never grants access. No signature/secret is required: authorization is checked independently and SQL remains parameterized. Next page uses the strict tuple boundary. No further page: nextCursor null. Empty list: submissions [] and nextCursor null. Results are not a frozen snapshot across inserts/status changes.

## Submission input

POST requires Idempotency-Key UUID v4. Supports:

```json
{ "code": "#include <iostream>\nint main() { long long a,b; std::cin >> a >> b; std::cout << a+b << \"\\n\"; }\n" }
```

- application/json: exactly the code field, string type.
- multipart/form-data: exactly one file part codeFile; no text fields, additional files or other part names. Filename ends in .cpp (case-insensitive), with no slash/backslash/NUL. Filename is checked but not saved. MIME/filename do not replace content validation.
- UTF-8 file decoding is strict and accepts a leading BOM. JSON code must be well-formed Unicode. Code must contain non-whitespace content, contain no NUL, and be at most 65,536 UTF-8 bytes. Keep whitespace/newlines; no trim, Unicode normalization or syntax checking. Invalid C++ syntax still creates a queued submission.
- Whole HTTP body at most 1 MiB, including multipart framing and JSON escaping; applies to chunked requests as well. Multipart uses streaming parts, fields=0/files=1/parts=1. File parser allows 65,539 bytes to accommodate a UTF-8 BOM, then validates decoded code against 65,536 bytes. No original/temporary files are written.
- Rejected imports do not create a submission/job or reserve an idempotency key. Abort/truncation must settle without partial writes.

## Time, history and idempotency

After complete input validation, submitIdempotently captures the server clock immediately on method entry, before readiness/connection/advisory-lock waits. That exact submittedAt checks opensAt <= submittedAt < deadline and is persisted. A completed upload at deadline is too late; one received in time remains valid if database writes wait beyond deadline. No client timestamp is accepted. A closed lab rejects a fresh intake with 409; draft labs remain hidden from students with 404.

All attempts are retained. Existing T03 rules select the last attempt in the open interval, regardless of AC/WA/CE or other result; insertion sequence breaks equal-time ties. Replaying an attempt does not change its submittedAt or make it the latest attempt.

Key scope is student + lab + UUID (case normalized); fingerprint is SHA-256 of exact decoded source. Equivalent JSON/file source shares a fingerprint; differing whitespace remains significant. A successful key lives 24 hours, expires at the exact boundary, and replay does not renew it. Replay returns the existing submission's current state with 201, Location and Idempotent-Replayed: true, with no additional job. Different code under a live key: 409. Replay is allowed after deadline, subject to current authentication/membership. Reuse after expiry is a fresh attempt only if still in time; old submissions remain.

PostgreSQL uses a scope advisory lock and transaction: recheck user/student membership/lab, check replay, then validate fresh-intake time and insert submission, job and key. TTL starts at key creation, independently from submittedAt. Rollback leaves none of the three. No unique constraint on jobs.submission_id is added: T06's requeue semantics remain valid. Fake performs the same operation without yielding between check and mutation. Migration 0005 adds key storage and listing indexes; migrations 0001–0004 remain unchanged by phase 3.

## Limits and errors

Per-app-instance fixed-window POST limiter: 10 requests/student/minute, reserved after auth/access/valid key and before body parsing. Invalid bodies/replays count; exceeding it returns 429 and Retry-After seconds until the next boundary. Expired buckets are removed; capacity is 10,000 buckets, full returns 503 with Retry-After: 1. Clock/limiter are injectable. No extra GET limiter, distributed state or trusted proxy headers in this phase.

RFC 9457 application/problem+json: 400 invalid JSON/UTF-8/shape/filename/query/cursor; 401 credentials; 403 role; 404 unavailable resource; 409 key conflict/closed window; 413 code/body too large; 415 unsupported media type; 429 rate limit; 503 temporary database/capacity; 500 sanitized unexpected failure. Parser/validation errors are distinguished from Store/internal failures. Never log source, upload bodies, raw bearer tokens or connection strings.
