# Review queue — contract, version 1 (PA03-T09)

The TA review queue of a lab. Verdicts from hard rules and the model only reach the TA of the lab's class through these endpoints; nothing here or elsewhere shows a verdict to a student before Publish, and Publish (`docs/contract/publish.md`) is refused while any queue item lacks a TA decision. Contract tests: `tests/contract/review-queue.test.mjs`.

## 1. Product rules (FAQ of the product owners)

Quoted from the course FAQ (`LeeTKOB FAQ`, 2026-10-25):

- **FAQ-08** — "Trước khi công bố: không. Sinh viên chỉ thấy kết quả chấm test (FAQ-02). Kết quả của cả luật cứng lẫn mô hình đều ẩn." Students also never see a rejected proposal, an `unsure` verdict or whether they were sampled.
- **FAQ-09** — the TA sees the constraint, the whole code and the cause of an `unsure` verdict; "TA phải chọn `pass` hoặc `violation`. Không có lựa chọn mặc định; `unsure` không bao giờ tự thành khoản trừ." and "Chọn `violation` thì TA phải chỉ ít nhất một dòng code làm bằng chứng." A lab with an unhandled `unsure` cannot be published (FAQ-12).
- **FAQ-01** — a TA only sees the labs, submissions and queue of their own classes.

How this contract applies them:

| Rule | Where |
| --- | --- |
| Students see no verdict before Publish (FAQ-08) | Students and admins get `403` on every endpoint below; the submissions API returns only the judge result (`docs/contract/submissions.md`) |
| TA sees constraint, code and `unsure` cause (FAQ-09) | Queue items carry `constraintText`, `deduction`, `verdict`, `evidence`, `unsureCause`, `reason`; item detail adds `code` |
| No default decision; `unsure` never becomes a deduction by itself | `taDecision` is `null` until a TA decides; only `pass`/`violation` are accepted; Publish counts every undecided item as pending |
| `violation` needs at least one line of code (FAQ-09) | `400` without `evidenceLines`; the line text is taken from the stored code |
| TA of another class sees nothing (FAQ-01) | `404`, identical (status and body) to a missing lab or item, the same as `GET /labs/{labId}` in `docs/contract/labs.md` |

**Known difference with Publish (decision of 2026-11-23).** `POST /labs/{labId}/publish` keeps contract v1 and answers a TA of another class with `403 forbidden`, while this queue answers `404`. The `403` body carries no lab data; it only tells a caller who already knows a lab ID that the lab exists. Labs created through the API (`POST /classes/{classId}/labs`) get random UUIDs that cannot be guessed; only labs loaded from a seed (for example `lab-sort` in the test seed) have fixed IDs. The risk was accepted to keep the Publish contract at version 1 (T09 acceptance: "giữ contract v1"); aligning Publish to `404` would be a separate, agreed contract change.

PA03 scope: every verdict of each counted Accepted submission is in the queue (no 10% `pass` sampling yet, FAQ-10 is PA04), and a TA may confirm all unreviewed `pass` verdicts at once. Requiring evidence lines for `violation` was planned for PA04 and is enforced from PA03 on purpose, so this contract does not need a breaking change later.

## 2. Conventions

- Session Bearer auth from `POST /auth/login` (`docs/contract/auth.md`): `Authorization: Bearer <token>`. Missing, invalid or expired sessions return `401 unauthenticated` with `WWW-Authenticate: Bearer`.
- Every response has `Cache-Control: no-store`. Errors are RFC 9457 `application/problem+json` with the namespace `https://leetkob.example/problems/<slug>`.
- IDs (`labId`, `itemId`) match `^[a-zA-Z0-9_-]{1,64}$`; otherwise `400 validation`.
- Evaluation order: authentication (`401`) → path ID (`400`) → role (`403` unless `TA`) → lab or item exists and the TA belongs to its class (`404`) → lab already published (`409 conflict`, write endpoints only) → request body (`400`/`415`) → action. Body parsing errors from the framework (`400 invalid-json`, `415 unsupported-media-type`) come after the authentication and role checks.
- The reviewer is always the session user. Body fields such as `taId` or `role` are rejected (`400`), never trusted.

## 3. Resources

### ReviewItem

One item per (counted Accepted submission, constraint) pair.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Item ID |
| `labId`, `submissionId`, `studentId`, `constraintId` | string | |
| `constraintText` | string | As written by the TA |
| `deduction` | number | Deduction the TA set on the constraint (0 < d ≤ 10); never from the model |
| `verdict` | `pass` \| `violation` \| `unsure` | Pipeline verdict |
| `source` | `hard_rule` \| `model` | |
| `evidence` | `{ line, text }[]` | Lines the pipeline cited, in the original code |
| `unsureCause` | string \| null | `model_unsure`, `schema_error`, `evidence_mismatch`, `timeout`, `cost_cap`, `model_off` (model switched off with `MODEL_OFF=1`, PA03-T10); non-null only for `unsure` |
| `reason` | string \| null | Untrusted model or rule text; clients must escape it |
| `createdAt` | string | UTC ISO timestamp |
| `taDecision` | `pass` \| `violation` \| null | `null` = not reviewed |
| `taEvidence` | `{ line, text }[]` | Lines the TA pointed at; non-empty for `violation` |
| `reviewedBy`, `reviewedAt` | string \| null | Last TA decision |

### ReviewState

`{ queueItemCount, passDecisionCount, violationDecisionCount, pendingCount }`. `pendingCount` also counts counted submissions not judged yet (`queued`, `judging`, `failed`) and verdicts the pipeline has not produced, so Publish waits for the whole pipeline.

## 4. Endpoints

### `GET /labs/{labId}/review-queue`

`200` with:

```json
{
  "labId": "lab-sort",
  "classId": "class-1",
  "published": false,
  "publishedAt": null,
  "state": { "queueItemCount": 4, "passDecisionCount": 0, "violationDecisionCount": 0, "pendingCount": 4 },
  "items": [ { "id": "…", "verdict": "violation", "evidence": [{ "line": 4, "text": "  std::sort(a, a + 3);" }], "deduction": 3, "taDecision": null, "…": "…" } ]
}
```

Items are ordered by counted submission, then by constraint order of the lab. The list never contains the code.

### `GET /review-items/{itemId}`

`200 { "item": ReviewItem, "code": "<whole submitted code>" }` (FAQ-09).

### `POST /review-items/{itemId}/decision`

Body (`application/json`): `{ "decision": "pass" | "violation", "evidenceLines"?: number[] }`.

- `violation`: 1–50 distinct integers, each between 1 and the number of lines of the submitted code. The server stores `{ line, text }` with `text` read from the code (line breaks `\n`, `\r\n`, `\r`).
- `pass`: no evidence lines (absent or `[]`). `null` is not accepted for either decision (`400`).
- Any other field, a missing or other `decision`, or a non-object body: `400 validation`. Another content type: `415`.

`200 { "item": ReviewItem }`. A TA may change a decision until Publish; every change of decision, evidence or reviewer is logged in the Store (FAQ-10). After Publish: `409 conflict`.

### `POST /labs/{labId}/review-queue/confirm-passes`

No body needed. Sets `pass` on every queue item whose verdict is `pass` and that has no TA decision yet. `200 { "confirmedCount": n, "state": ReviewState }`. After Publish: `409 conflict`, also when Publish commits while this call waits for the lab lock (the Store then confirms nothing and the response is `409`, never `200` with `confirmedCount: 0`).

## 5. Errors

| Status | Slug | When |
| ---: | --- | --- |
| 400 | `validation` | Bad path ID or decision body |
| 400 | `invalid-json` | Body is not valid JSON |
| 401 | `unauthenticated` | Missing, invalid or expired session |
| 403 | `forbidden` | Caller is not a TA (student, admin) |
| 404 | `not-found` | Lab or item unknown, or the TA is not in the lab's class |
| 409 | `conflict` | The lab is published; decisions are locked |
| 415 | `unsupported-media-type` | Decision body is not `application/json` |
| 500 / 503 | `internal` | Sanitized server or database failure |

## 6. Versions

Version 1. Only backward-compatible additions are allowed (for example a new optional item field, or 10% `pass` sampling that removes unsampled `pass` items from the queue in PA04 as stated by FAQ-10). Renaming fields, changing statuses or slugs needs a new version committed with its rationale.
