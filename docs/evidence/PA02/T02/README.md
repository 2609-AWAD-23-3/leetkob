# T02 — Publish data foundation evidence

Executor: Vuong / @vinny2707. Independent reviewer: Vy / @tranquocvy.
Task: [Issue #2](https://github.com/2609-AWAD-23-3/leetkob/issues/2), [PA02 acceptance](../../../plans/PA02.md#t02--data-foundation).

Tested source candidate: [94d9e22057a2d5d5f0db21fa61147bc7c00e4f6f](https://github.com/2609-AWAD-23-3/leetkob/commit/94d9e22057a2d5d5f0db21fa61147bc7c00e4f6f), branch feat/t02-publish-state, based on develop at 9ac6bf5. Checks ran against the working source immediately before that implementation commit; no source/test changes occurred between the successful baseline run and the commit. Subsequent evidence/plan edits are documentation only. [verification.json](verification.json) records the observations and source-file hashes, not fabricated per-command timestamps or a claim of a clean-clone run.

## Verification results

Local verification date: 2026-11-09 (Asia/Bangkok; UTC date 2026-11-08), Windows x64.

| Command/check | Actual result |
| --- | --- |
| npm.cmd ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 | Exit 0, 55 packages installed from the existing lockfile; bootstrap used Node 24.14.0/npm 11.9.0 and emitted the repository engine warning |
| npm run build, using Node 24.22.1/npm 11.19.1 | Exit 0 |
| node --test tests/data/publish-store.test.mjs tests/smoke/app.test.mjs, using Node 24.22.1 | Exit 0, 47 passed, 0 failed/skipped/cancelled: 40 data tests and 7 T01 smoke tests |
| git diff --check before the implementation commit | Exit 0 |

Initial build and separate data/smoke runs also passed on the system Node 24.14.0. Because it is below the repository minimum, the final build and combined suite were repeated on Node 24.22.1/npm 11.19.1 installed into a temporary directory; the system runtime was not changed. The installed dependencies and lockfile were not altered for the repeat. Downloading a portable zip from nodejs.org did not complete and was interrupted; installing the pinned node-win-x64 and npm packages through npm registry succeeded. The first sandbox npm install was interrupted after failing to make progress; the escalated lockfile install succeeded. These are setup limitations, not failed assertions hidden by changing tests.

## Requirement to evidence mapping

| Requirement | Test evidence |
| --- | --- |
| Lab/class lookup; many-to-many TA assignments | lab lookup and membership test; missing-lab results and cross-class membership false |
| Explicit TA decision for every current queue item | pending tests for pass, violation and unsure; pending in another lab is excluded |
| Deadline boundary and refusal without writes | deadline -1 ms / exact / +1 ms; deadline refusal precedence |
| Whole-lab publication and stored summary | summary counts decisions, including model overrides and resolved unsure; empty queue |
| Repeat safety | different publisher; throwing/later clock not read; seeded publication with clock before deadline |
| Single-instance competition | two Promise-scheduled synchronous calls yield one published and one already_published, with equal publication values |
| Lifecycle isolation | separate factories, reset-to-seed, reset-to-empty, and fresh fixed-clock Date values |
| Defensive copies | mutations of input seed, returned lab/review/publication and nested summaries do not alter internal state |
| Invalid fixture handling | duplicate/reference/enum/ID/timestamp/publication/summary cases; failed reset preserves existing publication and membership |
| Programming/clock failure safety | invalid publisher, invalid Date, non-Date and throwing clocks create no publication |

## Reproduction

With the repository baseline Node 24.22.1 and npm 11.19.1 on PATH, from the repository root:

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test tests/data/publish-store.test.mjs tests/smoke/app.test.mjs
git diff --check
~~~

On Windows, npm.cmd avoids installations whose PowerShell execution policy blocks npm.ps1. Tests import compiled dist files, so build first. Test clocks/IDs are fixed; no real model, database or user data is required.

## Handoff and remaining acceptance

- Phuc/T03/T08: [model, interface and examples](../../../architecture/data-model.md), [public exports](../../../../src/data/index.ts), and [fixtures](../../../../src/data/fixtures.ts). Resolve/authorize the trusted TA before store calls. Consume PublishResult as an internal data result, with HTTP mapping owned by T03/T08. Summary contains review statistics only. Pending-to-resolved examples use fixture reset, not a new endpoint.
- Vy/T01/T04: instantiate a store per app/test, inject only PublishStore into the publish module, retain reset in test setup, and add the data-test command to the shared harness when integrated. No manifest, lockfile, app composition, setup README or shared runner was edited by T02.
- Storage: no durability, restart recovery, cross-process sharing or distributed concurrency guarantee. The clock must be trusted and non-reentrant. There are no external side effects or unpublish operation.
- The handoff artifacts are available; consumer acknowledgment/wiring and independent reviewer execution are not claimed. The fifth execution checkbox and both review checkboxes remain open.
- No HTTP contract/auth tests, full T04 lint/format/harness, CI run, Linux/fresh-clone verification, independent approval, merge or task closure is established by these results. T02 remains open pending handoff/review/integration.

[AI-log input](AI-LOG.md) is prepared for T11. It does not replace the required root milestone reports.
