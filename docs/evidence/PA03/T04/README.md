# T04 — phase 1: auth and demo seed

Implementation branch: `feat/pa03-t04-auth-lab-submissions`. Base/source SHA: `f37b5b314dd9b1bc2150efd4e1019943f139e37c`; changes are uncommitted on top of that base. Implementation and tests were assisted by Codex. No remote publication, real model call, sandbox execution or reviewer approval is claimed.

Contract: [auth](../../../contract/auth.md). Lab/submission APIs and T09 Publish runtime integration remain outstanding; T04 as a whole is not complete.

## Run locally (PowerShell)

Migration source lives in `src/db/migrations/`: one file per migration plus an explicit ordered registry in `index.ts`. IDs and SQL remain unchanged when reorganizing files, so existing databases do not rerun migrations. Demo account seed code lives in `src/db/seeds/demo-accounts.ts`; `scripts/seed-demo.mjs` is only the CLI entry point. The current dev seed uses the public credential declared in source and does not require a private JSON file. T03's in-memory seed remains a test fixture rather than a runtime seed.

Node 24.x >=24.22.1, npm 11.x; install using `npm.cmd ci --ignore-scripts`. Start local PostgreSQL:

```powershell
docker compose -f docker/compose.postgres.yml up -d --wait
# First time only, if .env does not exist:
Copy-Item .env.example .env
npm.cmd run db:seed
npm.cmd start
```

Compose credentials above are the repository's public local-only defaults, not deployment credentials. The seed command builds first. The fictional demo account list and common public password `password123` live in `src/db/seeds/demo-accounts.ts`; no private JSON file or `--init` step is required. Passwords are still scrypt-hashed with independent salts before storage. Registration keeps its separate 15–128 code point policy.

`npm run db:seed` applies migrations and then transactionally adds missing demo records. For existing matching demo IDs/usernames/roles, it resets a different password to the public demo password and revokes that user's sessions; an already-matching password/hash/session is preserved. Unrelated users, classes, labs and submissions are retained. ID/username/role collisions roll back. This dev seed is not a provisioning mechanism for real users or deployment administrators; T12 must supply a separate deployment seed/configuration. The old ignored `.local/seed-accounts.json`, if present, is obsolete and is neither read nor deleted.

| Accounts | Membership |
| --- | --- |
| admin.vuong, admin.phuc, admin.vy | No automatic class membership |
| ta01–ta05 / ta06–ta10 | Class 1 / class 2 |
| student001–student060 | Both classes |
| student061–student080 | Class 1 only |
| student081–student100 | Class 2 only |

Totals: 113 users, 2 demo classes, 170 memberships; 80 students and 5 TAs per class. Labs, submissions and verdicts are not seeded. Existing T03 fake fixtures remain test-only with placeholder hashes and are not suitable for login.

The server requires DATABASE_URL, waits for Store initialization/migrations, and only then listens. It never falls back to fake identity. HOST/PORT retain their existing defaults. The npm commands dev/start/db:migrate/db:seed load optional root `.env` with Node CLI; existing environment variables take precedence. Direct `node dist/api/server.js` does not load `.env` unless the flag is supplied. Restart after changing `.env`. Tests do not load `.env`; test:db requires explicit TEST_DATABASE_URL. Store connections close on normal shutdown or initialization failure. `/health` is a liveness response, not a live database readiness probe. Production URLs/passwords must be configured privately by T12.

### Test in the browser

To inspect database rows instead of HTTP APIs, run `npm.cmd run db:studio` in another terminal and open `http://localhost:5555`. PostgreSQL must be running and `.env` configured; the backend may be stopped. Studio uses the pinned Prisma 7 CLI as a dev-only viewer/editor and introspects the existing database through `scripts/prisma-studio.config.ts`; it does not own migrations, generate a Prisma Client, seed data or create tables. Edits write directly to the dev database. Stop with Ctrl+C. Optional alternate port: `npm.cmd run db:studio -- --port 5556`.

After starting/restarting the API, open `http://127.0.0.1:3000/docs/` (adjust HOST/PORT if configured). Expand an endpoint and click **Try it out**. Start with login using a seeded username and the public demo password `password123`; copy the returned `accessToken` into **Authorize** without the `Bearer` prefix. `/auth/me` shows current user/classes; logout returns 204 and a subsequent `/auth/me` returns 401. A newly registered student has no class memberships. Test accounts made through registration persist in the database.

`/docs/json` can be imported into an API client as OpenAPI. Only the four mounted auth endpoints are documented; future lab/submission operations will be added when implemented. The docs use the page's origin, serve bundled UI assets and do not persist authorization across page reloads. There are no real credentials in examples. Versions are pinned in package.json/lockfile; plugin registration compatibility is checked against Fastify 5 and exercised by the docs tests.

## Verification

Default tests discover auth unit/contract/runtime tests recursively. Real database tests are in the existing postgres-store suite, so the `test:db` command and its CI discovery remain intact. Every fixture owns an isolated schema and deterministic clock where time matters. Test-only password strings are fictional, not credentials for the generated local seed.

Migration 0003 adds normalized username uniqueness without modifying migrations 0001/0002. It preserves existing accounts; normalization collisions fail before index creation and require an explicit operator decision. No account is renamed or removed automatically.

## Results — 2026-11-21

Environment: Node v24.22.3, npm 11.19.1, Windows/PowerShell; PostgreSQL 17 from the repository's local Compose. Source is the uncommitted implementation on the base SHA above, not a published commit.

| Command/check | Exit | Observed result |
| --- | --- | --- |
| `npm run lint` | 0 | No warnings/errors |
| `npm run format-check` | 0 | All matched files formatted |
| `npm run type-check` | 0 | Strict TypeScript passed |
| `npm test` (after Swagger UI addition) | 0 | 171 pass, 1 PostgreSQL suite skipped without TEST_DATABASE_URL |
| `TEST_DATABASE_URL=<local disposable database>; npm run test:db` | 0 | 74/74 pass, including real auth, seed concurrency, normalized migration and existing T03 regression tests |
| `npm run db:seed -- --init` | 0 | Private seed file generated, not printed |
| `npm run db:seed` on local database | 0 | 113 accounts added, 0 skipped |
| Repeat `npm run db:seed` | 0 | 0 added, 113 unchanged |
| Repeat `--init` overwrite check | 0 for assertion; seed subprocess 1 | Existing file refused, digest unchanged |
| Real runtime HTTP probe with local seed | 0 | Admin/TA/student login, current memberships, logout and rejected revoked token |
| `git diff --check` | 0 | No whitespace errors |

Raw local test/probe logs are under `.local/` and excluded from Git. Initial default/sandbox runs hit socket restrictions (HTTP loopback and PostgreSQL EACCES); the successful network checks were rerun outside that sandbox. No checks were bypassed or expectations weakened to address those environment failures. Migration-count expectations changed because migration 0003 was added.

Password parameters have not been benchmarked on the deployment VPS. No distributed limiter test or 80-user load test is claimed. Reviewer checklist remains for Vỹ; this evidence does not claim approval.

### Swagger UI follow-up verification

- Pinned `@fastify/swagger` 9.9.5 and `@fastify/swagger-ui` 6.1.5. The older UI 5.x candidate reported vulnerable transitive packages; the selected UI declares Fastify `5.x` compatibility and installs/audits with zero known vulnerabilities. `npm ci --ignore-scripts` exited 0. Existing dependency entries in the base lockfile were unchanged; additions are Swagger-related.
- New contract tests verify `/docs/`, bundled JS/CSS, disabled external validator, nonpersistent authorization, `/docs/json`, request/response schemas and Bearer security for exactly the four mounted endpoints. No docs/spec are mounted in the app factory without an AuthStore.
- Full default suite: 171 passed, 1 skipped. Lint, format-check, type-check and diff-check exited 0. The targeted real PostgreSQL HTTP auth test passed (1/1) after adding Swagger. The earlier full 74/74 PostgreSQL run above preceded this docs addition; database logic was not changed by it.
- UI HTML/assets/spec and HTTP behavior were verified programmatically; no visual browser inspection is claimed. Markdown and the typed OpenAPI document must be updated together when future endpoints change.

### Local .env follow-up

The npm commands dev/start/db:migrate/db:seed now use Node's `--env-file-if-exists=.env`; dev combines the built-in watcher with the tsx import loader. No dotenv dependency was added. `.env.example` provides the public Compose defaults; a private `.env` was created locally without overwriting any existing file, and `git check-ignore .env` confirmed exclusion. Existing process variables override file values. Missing `.env` remains valid when the deployment supplies DATABASE_URL. Tests intentionally do not load this local file.

Verification with DATABASE_URL removed from the child environment: `npm run db:migrate` exited 0 (up to date); `npm run db:seed` exited 0 (0 added, 113 unchanged); the start entry loaded `.env` and served `/docs/json` on an overridden PORT. The dev TypeScript loader/config probe passed. Lint, format-check, type-check, diff-check and full tests exited 0 (171 passed, 1 PostgreSQL suite skipped). These probes did not print passwords or connection strings.

### Development seed policy revision

The user requested a simple public dev seed instead of private random credentials. Historical verification rows above describe the previous behavior. The current CLI reads only the tracked account template and resets matching demo passwords to `password123`; no --init/private JSON is needed. Generic seed helpers preserve credentials unless explicitly called with resetPasswords, as the dev CLI does. Reset tests check revocation of the changed demo session and preservation of an unrelated account. Email/MSSV fields were not added: the checked [FAQ-01](https://github.com/tkob-team/LeeTKOB-FAQ/blob/main/FAQ.md#faq-01) does not mandate either login identifier. FAQ-06 requires removing personal identifiers from model input, which does not itself mandate storing them on accounts.

Verification after this revision: `npm run db:seed` exited 0 with 0 added, 113 passwords updated, 0 unchanged in the local dev database. HTTP login/me/logout passed for an admin, TA and two-class student using the public dev password. Full default suite exited 0 (171 passed, 1 skipped); PostgreSQL suite exited 0 (74/74), including password-reset/session-revocation and unrelated-account preservation checks. Lint, format-check, type-check and diff-check exited 0. Existing private seed JSON is obsolete and was left untouched, not imported into source or read by the seed CLI.

### Swagger examples and startup link

Request examples now cover seeded student/TA/admin login and a consistent registration/login pair (`student.demo`, with a separate valid registration password). Success responses show realistic user IDs, memberships and timestamps; the response token is explicitly illustrative. Named validation/malformed-JSON examples and conflict responses were compared against real handlers. The additional contract test executes the documented request payloads, rather than only checking their shape.

After listen succeeds, the server logs `API docs: <actual-listening-origin>/docs/` plus the structured docsUrl field. Live process probes verified the log and HTTP docs on custom ports with both the .env host and wildcard 0.0.0.0 (shown as local loopback). No credentials are included in this startup log. Final default tests exited 0: 172 passed, 1 skipped. Lint, format-check, type-check and diff-check exited 0. No database logic changed in this follow-up; the full 74/74 database result above remains the preceding database verification.

### Prisma Studio tooling

Added exact dev dependency prisma 7.10.1 and `db:studio`, with optional root .env loaded by Node CLI and a config-only datasource. No Prisma Client, schema.prisma or Prisma migration directory is introduced. A scoped override updates @prisma/config's Effect dependency to 3.22.1 because the pinned upstream 3.20.0 was affected by [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw). The install used --ignore-scripts and npm audit reported zero known vulnerabilities after the override. CLI/config loading and live browser introspection succeeded: Studio listed existing tables and displayed both demo classes. No database rows were changed during UI verification. Studio is a development-only tool and is not part of API startup or production dependencies.

Final tooling verification: Studio listened on 127.0.0.1:5555. Lint, format-check, type-check, npm test and diff-check exited 0; tests remained 172 passed and 1 skipped. Studio was left running with the verified classes view open for the user. No full PostgreSQL suite rerun was needed for this tooling-only addition; no Store/schema/seed behavior changed.

### Phase 1 review fixes

The follow-up review reproduced three issues now addressed: idle pool connection errors previously caused an unhandled EventEmitter error/process exit; unpaired surrogate passwords were converted to the same replacement bytes during UTF-8 encoding; a NUL display name succeeded in the fake but failed with PostgreSQL 500. The pool now has a sanitized error listener and lets pg discard failed idle clients/reconnect on demand. Password validation rejects malformed Unicode at HTTP and password-service boundaries. Shared display-name validation rejects NUL and malformed Unicode before either Store persists it. Vietnamese and valid emoji remain supported; no Unicode repair/normalization is performed.

New regression tests exercise actual child-process survival/reconnection after terminating only that probe's idle PostgreSQL backend, malformed-password rejection, consistent invalid-name behavior in both Stores and real PostgreSQL HTTP signup/login with valid Unicode.

**Accepted development limitation:** the user explicitly deferred the fourth finding: a login that verified an old password before a concurrent dev-seed password reset can create a session after the reset's revocation. That race is unchanged. There is no public password-reset API in phase 1; revisit atomic credential checking before implementing one. This acceptance does not claim that the race is fixed.

Verification after the three fixes: npm test exited 0 (175 passed, 1 PostgreSQL suite skipped without TEST_DATABASE_URL); full PostgreSQL suite exited 0 (77/77), including idle-client termination/reconnection and the invalid-text regressions. Lint, format-check, type-check and diff-check exited 0. The tests used isolated schemas and terminated only their own probe connection; no application database reset or reseed was performed. No migration, dependency, seed-reset semantics or public password-reset endpoint was added by this fix.
