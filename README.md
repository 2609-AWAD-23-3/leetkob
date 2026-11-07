# LeeTKOB

A modular backend for the LeeTKOB class project. This branch implements the T01 application foundation, not a finished grading product or a completed PA02 quality gate.

## Prerequisites

- Node.js 24 LTS, version 24.22.1 or later in the 24.x line; .node-version records the verified baseline.
- npm 11.x; the baseline was exercised with npm 11.19.1.
- Git, and repository access while the repository remains private.

No Docker, database service, model key or paid account is needed for this skeleton. Run commands from the repository root, which contains package.json. Clone/check out the reviewed branch you intend to evaluate; T01 is not on develop/main until its PR is merged.

## Install, build and run

~~~sh
npm ci --ignore-scripts
npm run build
npm start
~~~

The server defaults to http://127.0.0.1:3000. In another terminal, request GET /health, for example:

~~~sh
curl http://127.0.0.1:3000/health
~~~

Expected response: HTTP 200, JSON {"status":"ok"}. Stop the server with Ctrl+C. This is a liveness probe only: it does not certify database readiness, auth, judging or model availability.

For editing with automatic restart:

~~~sh
npm run dev
~~~

HOST and PORT are optional process environment variables; .env files are not loaded automatically. Defaults are 127.0.0.1 and 3000. PORT must be an integer between 1 and 65535. For a different local port:

~~~powershell
# PowerShell
$env:PORT = '3001'
npm start
Remove-Item Env:PORT
~~~

~~~sh
# POSIX shell
PORT=3001 npm start
~~~

Set HOST=0.0.0.0 only intentionally in a controlled container/deployment environment; this skeleton is not production-hardened. No model/provider variables are used. T05 owns the complete env example and security/cost records.

## T01 acceptance smoke checks

~~~sh
npm run build
node --test tests/smoke/app.test.mjs
~~~

These narrow checks exercise factory/lifecycle isolation, health routing, all three plugin registration seams, absence of fake business endpoints, config validation, and a real loopback listener on an ephemeral port. They import built code, so build first. They require no real model calls, database or fixed free port.

T04 will add the standard lint, format-check, typecheck and comprehensive test commands and shared harness. T09 will run those same commands in CI and configure required checks/protection. Neither task is complete merely because build or these smoke checks pass. No npm test command or required CI check is claimed yet.

## Module handoff

- src/app.ts: createApp() returns a fresh non-listening application; consumers own ready/inject/listen/close.
- src/server.ts: executable startup and signal handling only.
- src/modules/submissions/index.ts: T06, @vinny2707.
- src/modules/review-queue/index.ts: T07, @tranquocvy.
- src/modules/publish/index.ts: T08, @BHVPhuc.

Each feature module exports a standard Fastify async plugin and owns its complete contract, implementation and tests. The three plugins currently register no routes; missing business routes return 404, not dummy success. Shared data (T02) and trusted auth/errors (T03) must be agreed before implementing business behavior. For interface details and a module extension example, read the [architecture baseline](docs/architecture/overview.md).

B maintains the initial setup README and shared manifest/lockfile through T01/T04; README ownership transfers explicitly to A in T11. Teammate requirements are inputs, not permission for concurrent edits to shared files. The T01 reviewer is @BHVPhuc. PA02 has been finalized with `publish` as the sole endpoint; T06/T07 are deferred, and implementation of the two remaining empty plugins is not required. The requester has reviewed the local documentation; Phuc's review on PR #14 is tied to candidate `738b183a` and does not automatically apply to new changes.

## Documentation

- [Documentation index](docs/README.md)
- [Project roadmap](docs/plans/PROJECT.md)
- [Current PA02 plan](docs/plans/PA02.md)
- [All checkpoint plans](docs/plans/README.md)
- [Source brief, requirements, rubric and templates](docs/reference/README.md)
- [Architecture baseline](docs/architecture/overview.md)

The separate workflow setup [PR #13](https://github.com/2609-AWAD-23-3/leetkob/pull/13) contains CONTRIBUTING and branch/PR templates; do not treat those files as merged into this develop-based task branch yet. Resolve overlapping documentation updates when integrating that PR, preserving both setup instructions and workflow links.

## Repository and remaining delivery requirements

[2609-AWAD-23-3/leetkob](https://github.com/2609-AWAD-23-3/leetkob) remains private during preparation. T09 must verify source-sharing rights before the required public submission visibility. T01 does not publish or deploy the application.

Final root PA2.md, AI-LOG.md and SELF_ASSESSMENT_REPORT.md are T11 deliverables, not the examples/templates under docs/reference. Per-PR AI-assistance evidence must be consolidated by that executor. Assistant memory, external cleanup backups, node_modules, local secrets and build outputs are not submission artifacts. PA03-PA05 documents remain roadmap scaffolds until their checkpoint requirements are available.
