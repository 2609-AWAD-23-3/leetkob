# LeeTKOB publication API — contract, version 1

CSC13114 · PA02 checkpoint · endpoint specification for `POST /labs/{labId}/publish`

This file is the specification for publishing lab grades after TA constraint review. Contract tests check the implementation against this specification. If the implementation and this file disagree, the implementation is wrong. If this file requires a change, update it in a dedicated commit that explains why — never quietly.

## 1. Conventions

- The endpoint in this contract is served at `/labs/{labId}/publish` on the modular LeeTKOB HTTP backend (no URL version prefix is prepended by default module registration).
- Requests and responses use UTF-8 JSON (`application/json` for successful responses and `application/problem+json` for all 4xx and 5xx responses).
- Identifiers (`labId`, `classId`, `userId`) are non-empty ASCII strings of 1 to 64 characters matching `^[a-zA-Z0-9_-]{1,64}$`.
- Counts (`publishedSubmissionCount`, `totalReviewCount`, `pendingReviewCount`, `totalDeductionsApplied`) are non-negative integers (`0, 1, 2, ...`).
- Timestamps (`publishedAt`) are ISO 8601 strings in UTC with millisecond precision, e.g. `2026-11-07T06:30:00.000Z`.
- **Authentication and caller identity:** Every request must carry trusted caller credentials resolved by the server authentication boundary. The server never reads `userId`, `role`, or `classId` from the request body or query string to determine who is calling.
- Clients ignore response fields they do not know. When a JSON request body is provided, the server ignores unknown top-level object fields after validating that the body is a JSON object.

## 2. Errors

Every response with a 4xx or 5xx status is an RFC 9457 **problem details** object with `Content-Type: application/problem+json; charset=utf-8`:

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://leetkob.example/problems/pending-reviews",
  "title": "Pending reviews block publication",
  "status": 409,
  "detail": "Lab lab-sorting-01 has 3 unresolved review queue items and cannot be published.",
  "pendingReviewCount": 3
}
```

| Member | Rule |
| --- | --- |
| `type` | `https://leetkob.example/problems/` followed by a slug from the table below. No other values |
| `title` | the exact title from the table below corresponding to `type` |
| `status` | an integer equal to the HTTP status code of the response |
| `detail` | one sentence describing **this** occurrence. Never a stack trace, an SQL or store query, an internal file path, or a secret |
| `errors` | present **only** on `validation`: one entry per invalid input found, each `{ "parameter": "<name>", "detail": "<rule broken>" }` for a path/query/header parameter or `{ "pointer": "<json-pointer>", "detail": "<rule broken>" }` for a request body field (`""` when the body is valid JSON but not an object) |
| `pendingReviewCount` | present **only** on `pending-reviews`: a positive integer (`>= 1`) indicating how many required review queue items for `{labId}` are still unresolved |

| Slug | Status | Title | When |
| --- | ---: | --- | --- |
| `unauthenticated` | 401 | Authentication required | the request has no caller credentials, or the credentials cannot be verified by the identity boundary |
| `invalid-json` | 400 | Malformed JSON | the request includes a body with `Content-Type: application/json` (or non-empty payload) that is not valid JSON |
| `validation` | 400 | Invalid request | path parameter `labId` does not match `^[a-zA-Z0-9_-]{1,64}$`, or a non-empty JSON body is not a JSON object (`{}`) |
| `not-found` | 404 | Not found | no lab exists with identifier `labId` |
| `forbidden` | 403 | Forbidden | the authenticated caller does not have `role === "TA"`, or is a `TA` who is not assigned to the `classId` that owns `labId` |
| `pending-reviews` | 409 | Pending reviews block publication | the lab has one or more required TA review items (`violation`, `unsure`, or sampled 10% `pass`) still in `pending` state (`pendingReviewCount > 0`) |
| `internal` | 500 | Internal error | any unexpected server failure. `detail` is a fixed generic sentence (`"An unexpected internal error occurred."`) |

Clients branch on `type`, never on `title` or `detail`.

## 3. Resources

**LabPublication**

Represents the publication state of a lab after TA constraint review is complete and grades/deductions are released to students.

```json
{
  "labId": "lab-sorting-01",
  "classId": "class-2609-awad",
  "status": "published",
  "publishedAt": "2026-11-07T06:30:00.000Z",
  "publishedBy": "ta-user-01",
  "publishedSubmissionCount": 80,
  "totalReviewCount": 14,
  "pendingReviewCount": 0,
  "totalDeductionsApplied": 5
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `labId` | string | identifier of the published lab (`^[a-zA-Z0-9_-]{1,64}$`) |
| `classId` | string | identifier of the class that owns `labId` (`^[a-zA-Z0-9_-]{1,64}$`) |
| `status` | string | always `"published"` in a `LabPublication` response |
| `publishedAt` | string | ISO 8601 UTC timestamp of when the lab first transitioned from `"unpublished"` to `"published"`. Immutable across repeated publish calls |
| `publishedBy` | string | `userId` of the TA who triggered the initial transition to `"published"`. Immutable across repeated publish calls |
| `publishedSubmissionCount` | integer | number of `Accepted` submissions included in the published lab results (`>= 0`) |
| `totalReviewCount` | integer | total number of required review items generated for this lab (`>= 0`) |
| `pendingReviewCount` | integer | always `0` on a published lab |
| `totalDeductionsApplied` | integer | total number of confirmed constraint deductions applied across published submissions (`>= 0`) |

## 4. Endpoints

### 4.1 `POST /labs/{labId}/publish` — publish reviewed lab grades

Releases reviewed constraint verdicts and deductions for `{labId}` to students. By the LeeTKOB class project brief (Section 3, *Human gate*), every `violation` verdict, every `unsure` verdict, and a randomly sampled 10% of `pass` verdicts enter the TA review queue. Grades may be published **only** after the TA has resolved all pending review queue items for that lab.

#### Path parameters

| Parameter | Rule |
| --- | --- |
| `labId` | required string of 1 to 64 characters matching `^[a-zA-Z0-9_-]{1,64}$` |

#### Request headers and body

- **Authentication:** Required via the server's trusted identity boundary.
- **Request body:** Optional. A client may send an empty body (no `Content-Type` required) or `{}` with `Content-Type: application/json`.
- If a JSON body is sent and is valid JSON but not a JSON object (for example `[]`, `"text"`, `123`, or `null`), the server returns `400 validation` with `errors: [{ "pointer": "", "detail": "request body must be a JSON object or empty" }]`.
- Client-supplied fields in the body (such as `role`, `userId`, `classId`, `publishedAt`, or `force`) are ignored and never override server authentication, ownership checks, or the pending-review gate.

#### Evaluation order and precedence

The server evaluates checks **in this exact order** and stops at the first step that fails:

1. **Authentication:** Caller identity is present and valid, else `401 unauthenticated`.
2. **Input syntax and validation:**
   - If a request body is present and cannot be parsed as JSON, return `400 invalid-json`.
   - If `labId` does not match `^[a-zA-Z0-9_-]{1,64}$`, or if a parsed JSON body is not a JSON object, return `400 validation` listing every validation problem in `errors`.
3. **Lab existence:** A lab with `labId` exists in the store, else `404 not-found`.
4. **Role and class ownership:** The authenticated caller has `role === "TA"` **and** is assigned to `lab.classId`, else `403 forbidden`.
   - Note: Step 3 precedes Step 4 only for syntactically valid `labId` values; to avoid leaking lab metadata across classes in detailed messages, `403 forbidden` never exposes internal review counts or submissions of another class's lab.
5. **Repeat-call check (already published):** If the lab is already in `status === "published"`, return `200 OK` with `Idempotent-Replayed: true` and the stored `LabPublication` object (see *Idempotency and repeat safety* below).
6. **Pending-review gate:** Count required review queue items for `labId` whose state is still `pending`. If `pendingReviewCount > 0`, return `409 pending-reviews` with `pendingReviewCount` set to that count. Nothing is mutated.
7. **Publish transition:** Atomically transition the lab from `"unpublished"` to `"published"`, record `publishedAt` and `publishedBy`, freeze the published summary counts, and return `200 OK` with `Content-Type: application/json; charset=utf-8` and the `LabPublication` body.

#### Idempotency and repeat safety

Publishing grades is hard to reverse: once published, students can see their deductions and submit appeals. Network timeouts or client retries must never cause duplicate publications, double deductions, or overwritten audit metadata.

- **Natural state idempotency:** Because `POST /labs/{labId}/publish` transitions a specific lab resource (`{labId}`) to its published state rather than creating an unbounded collection item, it is naturally idempotent without requiring a client-generated `Idempotency-Key` header.
- **First successful call (`unpublished` -> `published`):**
  - Returns `200 OK` with the newly created `LabPublication` representation.
  - Does **not** include the `Idempotent-Replayed` response header.
- **Subsequent calls on an already-published lab (`published` -> `published`):**
  - Any authorized TA assigned to `lab.classId` who calls `POST /labs/{labId}/publish` after step 7 has succeeded receives `200 OK` with the **exact stored `LabPublication` body** (`publishedAt`, `publishedBy`, `publishedSubmissionCount`, `totalReviewCount`, `pendingReviewCount: 0`, and `totalDeductionsApplied` remain unchanged) plus the response header:
    ```http
    Idempotent-Replayed: true
    ```
  - No second publication event is recorded, no student score or deduction is recalculated or deducted a second time, and `publishedAt` / `publishedBy` are not overwritten even if a different TA of the same class triggers the retry.
- **Failed calls (`4xx`):**
  - A request that fails with `400`, `401`, `403`, `404`, or `409 pending-reviews` mutates nothing. Once a TA resolves the remaining pending review items (`pendingReviewCount` becomes `0`), a subsequent `POST /labs/{labId}/publish` succeeds as the initial publication (`200 OK` without `Idempotent-Replayed`).

## 5. Versions and the legacy API

- **Additive evolution policy:** Within this contract version, only additive, backward-compatible changes are permitted: adding an optional request field, adding a new field to `LabPublication`, or introducing a new endpoint. Any breaking change — renaming or removing a response field, changing a field's type, relaxing or altering the `pending-reviews` gate semantics, changing status codes or problem `type` slugs, or changing the path structure — requires a new contract version (`/v2/labs/{labId}/publish`) recorded in a dedicated commit before code or tests are modified.
- **No legacy API:** LeeTKOB is a greenfield course project established in PA02. Unlike the IA#3 menu service starter, there are no pre-existing unversioned legacy endpoints to deprecate or maintain alongside `/labs/{labId}/publish`, and `Deprecation` / `Sunset` / `Link: rel="successor-version"` headers do not apply in PA02.
- **Source alignment:** All domain rules in this contract derive directly from the LeeTKOB class project brief (Sections 3 and 4) and the PA02 rubric (Criteria 5 and 6). No external product-owner FAQ overrides are assumed.
