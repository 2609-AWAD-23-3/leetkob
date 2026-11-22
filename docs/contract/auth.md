# Auth — PA03-T04 phase 1

Server sessions persisted in PostgreSQL; opaque Bearer tokens, no JWT, cookie or refresh token. This contract adds student registration to the T04 minimum. TA provisioning and class membership management remain future work. Publish v1 retains its separate PA02 identity boundary until T09.

## Interactive API docs

When the auth module is mounted, open `/docs/` on the running API. Swagger UI serves its assets locally, and `/docs/json` exposes the OpenAPI 3.0.3 specification. No external validator receives the specification. The wire specification is maintained in `src/api/modules/api-docs/auth-openapi.ts`; this Markdown contract explains the behavior. Update both when changing auth and run the contract tests. Documentation does not add runtime validators or serializers that would change the handlers' existing behavior.

To test: expand `POST /auth/login`, click **Try it out**, enter your own username/password and execute. Copy `accessToken`, click **Authorize**, paste only the token (without `Bearer`), then test `/auth/me` and `/auth/logout`. Clear Authorize after logout; the server has revoked the token even if Swagger still displays it. Authorization is not persisted across page reloads. Fictional development accounts use the public password `password123`, declared in `src/db/seeds/demo-accounts.ts`; no private seed JSON is needed. This is an explicit seed-only exception to the registration password policy. API responses still enforce authentication, membership and rate limits normally.

The login request example selector includes student, TA, admin and the student created by the registration example. Registration uses a separate valid 15+ character demo password and warns to change the username if already registered. Success/error response examples reflect actual response shapes; the sample response token is fictional and cannot be used for authorization. Use the token returned by Execute. After a successful server listen, startup logs include `API docs: <actual-address>/docs/` with the configured port; wildcard listeners show a local loopback URL for convenience.

## Endpoints

| Method/path | Request | Response |
| --- | --- | --- |
| POST /auth/register | `{ username, password, displayName }` | 201 `{ user }` |
| POST /auth/login | `{ username, password }` | 200 `{ accessToken, tokenType: "Bearer", expiresAt, user }` |
| GET /auth/me | Authorization: Bearer token | 200 `{ user, memberships }` |
| POST /auth/logout | Authorization: Bearer token | 204, empty body |

Public user: `{ id, username, displayName, role }`. Membership: `{ userId, classId, role }`. Never return password/hash. All auth responses use `Cache-Control: no-store`. No session is created by registration; role is always `student`, memberships initially empty.

### Validation

Body must be a JSON object containing exactly the required string fields, without extra properties. Username uses ECMAScript trim, then lowercase; the result must match `[a-z0-9._-]{3,32}`. Uniqueness is enforced atomically on the normalized username, including preexisting accounts.

Registration password: 15–128 Unicode code points; login password: 1–128. Password must be well-formed Unicode (no unpaired surrogates); invalid input returns 400 rather than being repaired during UTF-8 encoding. Password is neither trimmed, Unicode-normalized nor truncated. No mandatory character categories. Display name is trimmed and must have 1–100 Unicode code points, well-formed Unicode and no NUL (U+0000). The same display-name rules apply at the Store boundary. Valid Vietnamese text and emoji are supported. Each auth route has an 8192-byte body limit. JSON parsing and transport errors precede handlers; body validation precedes Store access and rate limiting.

### Sessions and authorization

Login generates 32 cryptographically random bytes encoded as unpadded canonical base64url (43 characters). Only SHA-256(token) is persisted. Every login creates a separate session with absolute 12-hour expiration; `now >= expiresAt` is invalid, activity does not extend it. Keep token private and use HTTPS outside local development. Never put credentials in URLs or logs.

Only `Authorization: Bearer <token>` supplies identity. Missing/malformed/unknown/expired credentials on `/me` return 401. Logout requires a well-formed token, deletes that session and returns 204 even if it is already unknown/expired; other sessions survive. `/me` returns current user and memberships, not a frozen role embedded in a token, and does not expose session expiration.

Future lab/submission routes use helpers checking principal role **and** current class membership, plus student ownership where relevant. Admin is not automatically a TA of every class. Client role/userId/classId never establish identity or membership.

### Examples

Register (illustrative input, not a deployment credential):

```http
POST /auth/register
Content-Type: application/json

{"username":" student.new ","password":"illustrative example password","displayName":" New Student "}
```

```json
{"user":{"id":"<server-generated-id>","username":"student.new","displayName":"New Student","role":"student"}}
```

Login sends the same username/password, omitting displayName. Successful response:

```json
{"accessToken":"<private-43-character-token>","tokenType":"Bearer","expiresAt":"<ISO-8601-timestamp>","user":{"id":"<server-generated-id>","username":"student.new","displayName":"New Student","role":"student"}}
```

`GET /auth/me` with that Bearer token returns `{ "user": <public-user>, "memberships": [] }` for a new registration. After logout, the same request returns 401 with `WWW-Authenticate: Bearer`.

Wrong password and unknown username return identical 401 bodies:

```json
{"type":"https://leetkob.example/problems/unauthenticated","title":"Invalid username or password.","status":401,"detail":"Invalid username or password."}
```

### Errors and retries

Errors use RFC 9457 `application/problem+json`, matching the existing problem namespace. `401` responses include `WWW-Authenticate: Bearer`.

| HTTP | Meaning |
| --- | --- |
| 400 | Malformed/empty JSON, non-object body, invalid/missing/extra fields |
| 401 | Invalid login or protected-endpoint credential |
| 403 | Reserved for authorization failures in subsequent routes |
| 409 | Username unavailable (`conflict`); change username before retrying |
| 413 / 415 | Body too large / unsupported media type |
| 429 | Authentication rate limit; wait `Retry-After` seconds |
| 503 | Temporary database failure, password work saturation or limiter capacity |
| 500 | Unexpected internal error, including corrupt stored password hash |

Internal messages, SQL, connection strings and stack traces are never serialized. Database failure is not reported as bad credentials. Overloaded password work/capacity returns `Retry-After: 1`. Registration is not idempotent: if a response is lost, retry may return 409. A repeated login creates another session; logout is naturally repeatable.

## Password work and rate limits

Password hash: `scrypt$v1$16384$8$5$<16-byte-salt-hex>$<64-byte-key-hex>`, asynchronous Node scrypt, maxmem 64 MiB. Compare with timingSafeEqual; only supported format/parameters are accepted. Unknown users still incur dummy verification. Parameters follow an [OWASP scrypt configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). One process scheduler permits 2 active jobs and 32 waiting jobs; tests may inject a service.

Each app has an independent, bounded in-memory limiter with fixed epoch-aligned windows:

- Login: 120 validated requests/IP/minute, plus 10 failed or in-flight verifications/IP+normalized-username/15 minutes. Reserve before awaiting password work; successful login clears its pair, infrastructure failures release their reservation.
- Register: 20 validated requests/IP/hour, including attempts that later conflict or fail internally.
- At most 10,000 buckets; expired buckets are removed on access. Full capacity returns 503, never bypasses the limit. No timers are required.

Counters reset on API restart and are not shared between processes. `trustProxy` remains false; forwarded headers cannot spoof IP. A reverse proxy may group clients under one IP until T12 configures a trusted proxy explicitly. Multiple instances require a shared limiter. This phase does not demonstrate the 80-user load requirement.
