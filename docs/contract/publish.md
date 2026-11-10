# LeeTKOB publication API — contract, version 1

CSC13114 · PA02 checkpoint · endpoint specification for `POST /labs/{labId}/publish`

This document specifies the contract for publishing lab grades after TA constraint review in the LeeTKOB course project. Contract tests verify the implementation against this specification. If the implementation and this specification disagree, the implementation is incorrect. Any change to this contract must be committed with an explanation of rationale.

---

## 1. Conventions

- **Path and mounting:** The endpoint in this contract is mounted at `/labs/{labId}/publish` on the modular LeeTKOB HTTP backend. No URL version prefix (e.g. `/v1`) is prepended by default module registration.
- **Media types:**
  - Successful responses (HTTP `200`): `Content-Type: application/json; charset=utf-8`.
  - Error responses (HTTP `4xx`, `5xx`): `Content-Type: application/problem+json; charset=utf-8` conforming to RFC 9457.
- **Identifiers:** All identifiers (`labId`, `classId`, `userId`) are non-empty ASCII strings of 1 to 64 characters conforming to `^[a-zA-Z0-9_-]{1,64}$`. This length and character bound is an explicit technical design choice for course project safety, not a lecturer-mandated specification.
- **Counts:** All counts (`queueItemCount`, `passDecisionCount`, `violationDecisionCount`, `pendingReviewCount`) are non-negative integers (`0, 1, 2, ...`).
- **Timestamps:** Timestamps (`publishedAt`) are ISO 8601 strings in UTC with millisecond precision, for example `2026-11-09T15:00:00.001Z`. Millisecond precision is an explicit design choice aligned with JavaScript `Date.toISOString()`.
- **Authentication and caller identity:** Every request must carry trusted caller credentials resolved by the server authentication boundary via standard HTTP Bearer authentication:
  ```http
  Authorization: Bearer <token>
  ```
  The server never reads `userId`, `role`, or `classId` from the request body or query string to establish caller identity.
- **Request body:** The request body is optional. When provided, it must be a valid JSON object (`{}`). Client-supplied body fields (such as `role`, `userId`, `classId`, `force`, or `publishedAt`) are ignored and never override authentication, ownership checks, or publication prerequisites. Non-object payloads (arrays, primitives) are rejected.
- **Unknown fields policy:** Clients ignore response fields they do not recognize. The server ignores unrecognized top-level JSON body fields after validating object syntax.
- **Storage and concurrency bounds:** In the PA02 checkpoint, the backend utilizes an in-memory data store (`PublishStore`). Storage is ephemeral and resets on process restart. Concurrency guarantees (atomic check-and-publish and repeat-call safety) apply within a single JavaScript thread/process; distributed locks or multi-process synchronization are outside the scope of PA02.

---

## 2. Errors

Every response with a 4xx or 5xx status is an RFC 9457 **Problem Details** object with `Content-Type: application/problem+json; charset=utf-8`:

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://leetkob.example/problems/pending-reviews",
  "title": "Pending reviews block publication",
  "status": 409,
  "detail": "1 required review queue item is still pending.",
  "pendingCount": 1
}
```

### Standard members

| Member | Rule |
| --- | --- |
| `type` | URI string under the namespace `https://leetkob.example/problems/<slug>`. Clients branch on `type`, not `title` or `detail`. |
| `title` | Deterministic human-readable summary matching `<slug>`. |
| `status` | Integer equal to the HTTP status code of the response. |
| `detail` | Controlled human-readable description of this occurrence. Must never leak internal file paths, stack traces, database queries, or credentials. |
| `errors` | Present **only** on `validation` (`400`): array of `{ parameter, detail }` or `{ pointer, detail }`. |
| `pendingCount` | Present **only** on `pending-reviews` (`409`): positive integer (`>= 1`) indicating how many review items for this lab remain pending. |
| `deadline` | Present **only** on `before-deadline` (`409`): ISO 8601 UTC string indicating the deadline that has not passed. |

### Problem types table

| Slug | Status | Title | Trigger |
| --- | ---: | --- | --- |
| `unauthenticated` | 401 | Authentication required | Request is missing the `Authorization` header, uses an unsupported scheme, or provides an unrecognized token. Response includes `WWW-Authenticate: Bearer` challenge header per RFC 9110 section 11.6.1. |
| `invalid-json` | 400 | Malformed JSON | Request includes a body that cannot be parsed as valid JSON, or contains forbidden prototype pollution keys (`__proto__`, `constructor.prototype`). |
| `validation` | 400 | Invalid request | Path parameter `labId` violates `^[a-zA-Z0-9_-]{1,64}$`, or request body is valid JSON but not an object (e.g. an array or primitive). Member `errors` describes each issue. |
| `not-found` | 404 | Not found | No lab exists with identifier `labId` in the store. |
| `forbidden` | 403 | Forbidden | Authenticated caller does not have `role === "TA"`, or is a `TA` not assigned to `lab.classId`. |
| `before-deadline` | 409 | Lab deadline has not passed | Current server time is strictly before the lab's deadline (`now < lab.deadline`). |
| `pending-reviews` | 409 | Pending reviews block publication | Lab has one or more required review queue items still pending TA decision (`pendingReviewCount > 0`). |
| `internal` | 500 | Internal error | Unhandled server error. `detail` is fixed to `"An unexpected internal error occurred."` without leaking internals. |

---

## 3. Resources

### LabPublication

Represents the publication state of a lab once TA constraint review is complete and grades are released.

```json
{
  "labId": "lab-1",
  "classId": "class-1",
  "status": "published",
  "publishedAt": "2026-11-09T15:00:00.001Z",
  "publishedBy": "ta-one",
  "summary": {
    "queueItemCount": 3,
    "passDecisionCount": 2,
    "violationDecisionCount": 1
  }
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `labId` | string | Identifier of the published lab (`^[a-zA-Z0-9_-]{1,64}$`). |
| `classId` | string | Identifier of the class that owns `labId` (`^[a-zA-Z0-9_-]{1,64}$`). |
| `status` | string | Always `"published"` in a `LabPublication` response. |
| `publishedAt` | string | ISO 8601 UTC timestamp of initial publication. Immutable across repeated calls. |
| `publishedBy` | string | `userId` of the authenticated TA who performed the initial publication. Immutable across repeated calls. |
| `summary` | object | Summary of review queue decisions recorded at publication time: |
| `summary.queueItemCount` | integer | Total number of required review queue items for this lab (`>= 0`). |
| `summary.passDecisionCount` | integer | Number of items resolved with TA decision `"pass"` (`>= 0`). |
| `summary.violationDecisionCount` | integer | Number of items resolved with TA decision `"violation"` (`>= 0`). |

Invariant: `passDecisionCount + violationDecisionCount === queueItemCount`. If the review queue was empty, all three counts are `0`.

---

## 4. Endpoints

### 4.1 `POST /labs/{labId}/publish` — publish reviewed lab grades

Publishes grades and deductions for `{labId}`. Per Section 3 of the LeeTKOB course project brief (*Human gate*), every `violation` verdict, every `unsure` verdict, and a sampled 10% of `pass` verdicts enter the TA review queue. Grades may be published **only** after the deadline has passed and all pending review queue items have received a TA decision.

#### Path parameters

| Parameter | Type | Required | Rule |
| --- | --- | --- | --- |
| `labId` | string | Yes | Identifier of the lab (`^[a-zA-Z0-9_-]{1,64}$`). |

#### Request headers

| Header | Required | Rule |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <token>` scheme. Missing or invalid credentials return `401 unauthenticated`. |
| `Content-Type` | Conditional | Required as `application/json` when a non-empty request body is sent. |

#### Request body

Optional JSON object (`{}`). When omitted or empty (`{}`), publication proceeds normally. Extra top-level object fields are ignored. Non-object bodies return `400 validation`.

#### Strict evaluation precedence

The server processes the request following this exact sequence and halts at the first failing condition:

1. **Authentication:** The `Authorization` header is validated. Missing, malformed, or invalid tokens yield `401 unauthenticated` with `WWW-Authenticate: Bearer`.
2. **Input syntax validation:**
   - If a request body is present and not valid JSON, or contains prototype keys (`__proto__`), return `400 invalid-json`.
   - If `labId` does not match `^[a-zA-Z0-9_-]{1,64}$`, or if a parsed JSON body is not a JSON object, return `400 validation` with details in `errors`.
3. **Lab existence:** The lab `{labId}` is looked up in the store. If not found, return `404 not-found`.
4. **Role and class ownership:**
   - The authenticated caller must have `role === "TA"`; otherwise return `403 forbidden`.
   - The caller must be assigned to `lab.classId` (`store.isTaAssignedToClass(principal.id, lab.classId)`); otherwise return `403 forbidden`.
5. **Repeat-call check (already published):** If the lab is already in `published` status, return `200 OK` with `Idempotent-Replayed: true` and the stored `LabPublication` resource.
6. **Deadline gate:** If current server time is before `lab.deadline` (`now < lab.deadline`), return `409 before-deadline`.
7. **Pending-reviews gate:** If `review.pendingCount > 0`, return `409 pending-reviews` with `pendingCount: review.pendingCount`.
8. **State transition:** The lab transitions from unpublished to `published`. The store records `publishedAt` (from server clock) and `publishedBy` (caller's trusted principal ID), freezes summary counts, and returns `200 OK` with `Content-Type: application/json; charset=utf-8` and the `LabPublication` body.

#### Idempotency and repeat safety

Publishing grades releases final scores and confirmed constraint deductions to students. Retries due to network drops or timeouts must not cause duplicate publications, overwritten metadata, or repeated side effects.

- **Natural state idempotency:** `POST /labs/{labId}/publish` transitions an existing resource to the terminal state `published`. It is naturally idempotent without requiring a client-generated `Idempotency-Key` header.
- **Initial publication (`unpublished` -> `published`):**
  - Returns HTTP `200 OK` with the new `LabPublication` representation.
  - Does **not** include the `Idempotent-Replayed` response header.
- **Repeated calls on already-published lab (`published` -> `published`):**
  - Any authorized TA of `lab.classId` who calls `POST /labs/{labId}/publish` on an already-published lab receives HTTP `200 OK` with the exact stored `LabPublication` payload and the response header:
    ```http
    Idempotent-Replayed: true
    ```
  - `publishedAt`, `publishedBy`, and `summary` remain unchanged, even if a different TA of the same class triggers the repeat call.
  - No second publication record is created, and no side effect occurs.
- **Failed calls (`4xx`):**
  - A request failing with `400`, `401`, `403`, `404`, or `409` does not mutate any state. Once prerequisites are resolved, a subsequent call can succeed as the initial publication.

---

## 5. Versions and the legacy API

- **Additive evolution policy:** Within contract version 1, only backward-compatible additive changes are allowed (e.g. adding an optional request parameter, introducing an optional field to `LabPublication`). Any breaking change (renaming/removing response fields, altering status codes, changing problem slugs, modifying path structure) requires a new contract version (`/v2/labs/{labId}/publish`) committed with rationale.
- **No legacy API:** LeeTKOB is a greenfield course project established in PA02. No legacy unversioned endpoints exist to deprecate, and `Deprecation`, `Sunset`, or `Link: rel="successor-version"` headers are not applicable in PA02.
- **Course rubric alignment:** All domain logic and rules derive directly from the LeeTKOB class brief (Sections 3 and 4) and the PA02 rubric (Criteria 5 and 6). Technical decisions (ASCII ID pattern, UTC ISO ms timestamp precision, in-memory single-process limits) are documented herein.
