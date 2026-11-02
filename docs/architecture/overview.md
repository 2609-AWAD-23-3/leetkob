# LeeTKOB architecture baseline

Status: implemented T01 proposal, awaiting independent review by @BHVPhuc and team confirmation of the rubric-focus endpoint. This is not evidence that T01 or PA02 is accepted.

Executor: @tranquocvy. Source: [class brief](../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief.pdf), sections 3-5 and 7; [PA02 requirements](../reference/PA02/requirement.md); [task T01](../plans/PA02.md#t01--architecture-baseline-v%C3%A0-skeleton).

## Scope and stack

Use one modular backend, Node.js 24 LTS (baseline 24.22.1), npm 11, TypeScript strict mode with ESM, and Fastify 5. The exact dependency versions and transitive tree are recorded in package.json and package-lock.json. The root is the existing leetkob repository, not the legacy PA02 directory. Do not recreate the repository.

Fastify provides maintained HTTP routing, plugin encapsulation, lifecycle hooks and real HTTP-boundary injection. A custom HTTP framework would duplicate these capabilities. Express is adequate but would need additional conventions for the same plugin/testing boundaries. A multi-service/multi-language scaffold adds deployment, identity and storage coordination without helping PA02. No dependency on a paid service, model provider, database server or container runtime is needed to start this baseline.

This stack is a reviewable implementation choice, not a requirement imposed by the brief. TypeScript emits JavaScript into dist; the server never relies on a global TypeScript/tsx installation. The development watcher is not the production startup command.

## Runtime and file boundaries

~~~text
src/
  app.ts                       createApp; composition and module registration (T01/B)
  config.ts                    explicit HOST/PORT parsing (T01/B)
  server.ts                    executable listener and shutdown (T01/B)
  modules/
    submissions/index.ts       no-op plugin now; contract/source/tests owned by T06/A
    review-queue/index.ts      no-op plugin now; contract/source/tests owned by T07/B
    publish/index.ts           no-op plugin now; contract/source/tests owned by T08/C
tests/smoke/app.test.mjs        narrow T01 acceptance checks, not the T04 quality harness
~~~

The package manifest, lockfile, app composition and setup README have one writer, B, until the explicit T11 README handoff to A. Data/store/shared data fixtures belong to T02/A. Auth/error helpers and shared authorization/error tests belong to T03/C. Do not introduce a competing store/auth schema in a feature module. Source directories for those future artifacts are created when their owners implement them, not populated with pretend production services here.

## Application and listener lifecycle

1. Import createApp from src/app.ts (or dist/app.js after build). Construction does not read environment variables, bind ports, connect to services or launch workers.
2. Each call creates a separate Fastify instance and registers submissions, reviewQueue and publish plugins, in that stable order. Default plugins deliberately register no business routes.
3. app.ready() boots plugins; app.inject() exercises actual routing/serialization without listening. Call app.close() in teardown to release resources. Test fixtures must be per instance and must not depend on another member's endpoint or test order.
4. Only server.ts reads validated HOST/PORT and calls app.listen(). It defaults to 127.0.0.1:3000. The server entry point handles SIGINT/SIGTERM by calling app.close(); normal Windows terminal Ctrl+C maps to the SIGINT handler, while forced process termination is not proof of graceful shutdown.
5. A listener failure exits nonzero after closing the app. The narrow /health route reports process liveness only; it is not readiness, database health, security acceptance or pipeline completion.

The current smoke suite also starts an ephemeral loopback listener and verifies close. It does not prove every OS signal path or production deployment behavior.

## Module extension interface

Each module exports a FastifyPluginAsync named submissionsModule, reviewQueueModule or publishModule. Add the owned routes inside that plugin; default registration adds no URL prefix, so module contracts retain their documented /labs/... paths. Do not wrap these feature plugins with fastify-plugin merely to escape encapsulation.

For a temporary integration probe, createApp({ modules: { publish: async (scope) => { scope.get('/probe', async () => ({ ok: true })); } } }) replaces only that plugin. This is an in-process composition seam, never a request/body/header option. Call inject('/probe') and close the returned app. The smoke suite exercises the same interface for all three modules. Production module tests should use their real module, not replace the handler under test with a fake response.

Fastify decorators/hooks are encapsulated: a decorator inside one ordinary plugin is not automatically visible to siblings. Before T02/T03 consumers implement business routes, agree the real data/auth interfaces and compose shared services at the correct ancestor scope or pass typed plugin options explicitly. T01 intentionally does not freeze entity schemas or invent an authentication mechanism on behalf of those owners. Any resulting app.ts or manifest change is integrated by B after the owning package supplies its requirements. Review the wiring before parallel endpoint implementation is accepted.

## Shared business and security invariants

- The conceptual relationships are user -> class -> lab, with submissions, reviews and publication state. [T02 data-model document](data-model.md) remains the authoritative place to decide concrete IDs, storage/reset APIs, persistence and concurrency guarantees. No global mutable store exists in this baseline.
- T03 must establish a trusted identity boundary, role plus class/lab ownership checks and RFC 9457 conventions. Client-provided role/userId is never an authentication strategy. No development header bypass is introduced here.
- Only /health is implemented. The three business routes return Fastify's default 404 until their owners implement them; current default errors are not claimed to be the final RFC 9457 model. No business route is exposed before its contract and authorization boundary are ready.
- T04 owns the comprehensive test lifecycle, fixture/clock/seed rules and lint/format/typecheck/test commands. Build and narrow smoke checks here do not complete T04. T09 owns workflows/settings; no CI or protection is added by T01.
- No .env is automatically loaded. HOST/PORT are the only environment inputs consumed by server.ts; defaults are local development choices, not business contract limits. T05 owns the full env example, permissions, rules, secret-history audit and cost-cap records.

## Product flow and deferred components

The eventual flow is TA lab/constraints -> student submission -> queued sandbox judging -> Accepted -> hard rules -> semantic-only model review -> schema/evidence guards -> TA review queue -> TA publish -> appeals. The model never sets deductions; the TA defines them. Hard-rule decisions avoid unnecessary model calls, and violation/unsure plus a sampled 10% of pass go through human review.

PA02 may use deterministic in-process fixtures to exercise endpoint contracts. That is not evidence that judging, queueing, model review or the final pipeline works. No C++ is executed and no provider key is consumed in this skeleton. Later sandbox work must satisfy no-network, resource limits, non-root, no host mounts/Docker socket and no secrets, with attack-test evidence; do not substitute an unrestricted local child process for a sandbox.

There is no frontend, database adapter, judge, job queue, sandbox, LLM/eval pipeline, appeal implementation or deployment in T01. Storage/queue/provider/deployment choices remain open until their checkpoint needs them. Publish is still the proposed PA02 rubric-focus endpoint and requires team confirmation; the skeleton does not depend on that choice.

See [architecture decisions](decisions/README.md) for the review status of consequential choices; no separate accepted ADR is fabricated for this proposal.
