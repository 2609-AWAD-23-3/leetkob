# LeeTKOB — T02 data model and publish store

Executor: Vuong (vinny2707). Independent reviewer: Vy (tranquocvy).
Acceptance: [PA02/T02](../plans/PA02.md#t02--data-foundation), [Issue #2](https://github.com/2609-AWAD-23-3/leetkob/issues/2).

Status: implementation candidate on feat/t02-publish-state, based on 9ac6bf5.
The original uncommitted T02 plan has been developed into this specification and implementation; it was not treated as completed work. See [T02 evidence](../evidence/PA02/T02/README.md) for actual checks and remaining gates. Independent review and integration are required. This document does not establish HTTP contracts or mark T03/T08 complete.

## Requirements and boundaries

Sources are the [class brief](../reference/leetkob/LeeTKOB%20%E2%80%94%20class%20project%20brief_vn.md), sections 3–4, and the product-owner FAQ available through Classroom. The local source inspected is D:/semester1-year4/advanced_web_development/project/docs/FAQ.md; it is outside this repo and is not a runtime dependency. These paraphrases preserve the FAQ identifiers for comparison against the course source without copying the full document.

| Source | Requirement used here |
| --- | --- |
| FAQ-01 | Each lab belongs to a class. Classes may have multiple TAs and TAs may serve multiple classes. TA access is limited to their assigned classes. |
| FAQ-02 | The counted submission is the student's last submission before the deadline, regardless of judging result. Only the current counted submission contributes to the current queue. |
| FAQ-09 | An unsure result requires an explicit TA pass/violation decision; it never becomes a deduction automatically. |
| FAQ-10 | Queue items represent counted-submission/constraint pairs: all violation/unsure results and a sample of pass results. Pending is not synonymous with unsure. |
| FAQ-12 | Publish the whole lab when the submission period has ended and every queued item has a TA decision. Repeating publish changes nothing. There is no unpublish. Later individual score corrections are separate work. |

T02 is Vuong's data contract for Phuc to consume in T03/T08. Phuc's draft is not a binding design input. T01 supplies the existing skeleton. T02 does not implement authentication, HTTP routes/errors, submissions selection, queue sampling, model calls, grading, database/ORM, accounts, or appeals.

## Model

Public exports: [data entrypoint](../../src/data/index.ts). Types/store have no Fastify dependency and add no packages.

| Type | Fields and meaning |
| --- | --- |
| Lab | id, classId, deadline |
| TaClassMembership | taId, classId; unique pair, many-to-many |
| ReviewQueueItem | id, labId, submissionId, constraintId, verdict, taDecision |
| PublicationSummary | queueItemCount, passDecisionCount, violationDecisionCount |
| ReviewState | Summary counts plus pendingCount |
| Publication | labId, publishedAt, publishedBy, summary; at most one per lab |
| SeedState | Arrays labs, memberships, queueItems, publications |

IDs are case-sensitive nonempty strings without leading/trailing whitespace, not necessarily UUIDs. Stored timestamps must be canonical UTC ISO strings, e.g. 2026-11-09T15:00:00.000Z. Submission/constraint IDs are fixture references; T02 does not build those entities. Membership may reference a class without a seeded lab; no class master table or user registry is implied.

The verdict type is pass | violation | unsure. The taDecision type is null | pass | violation, where null is pending. An omitted decision field is invalid seed data. A model violation overridden to TA pass is resolved and contributes to passDecisionCount. A sampled model pass without a TA decision remains pending.

Queue IDs and (labId, submissionId, constraintId) pairs are unique. Queue items represent only the current queue, not historical submissions or all verdicts. Seed producers supply the counted submissions and correctly selected queue; T02 cannot verify selection without the deferred pipeline. The store retains aggregate review state, without an individual-item read/edit API or a TA review workflow.

### Publication summary

The requester selected review statistics, not student scores. Summary counts TA decisions at publication time. Successful publication has passDecisionCount + violationDecisionCount === queueItemCount. An empty queue has all three counts zero. This is not a grade report, a count of all students or a deduction calculation.

The original summary, publisher and timestamp remain unchanged on repeat. Later score corrections do not mutate this snapshot and are outside T02.

## Runtime interface and transition

~~~ts
interface PublishStore {
  getLab(labId: string): Lab | undefined;
  isTaAssignedToClass(taId: string, classId: string): boolean;
  getReviewState(labId: string): ReviewState | undefined;
  getPublication(labId: string): Publication | undefined;
  publishLab(input: { labId: string; publishedBy: string }): PublishResult;
}
~~~

Methods are synchronous and return copies. Missing lab/review-state lookup returns undefined. Publication lookup returns undefined for both a missing lab and an unpublished lab; use lab lookup to distinguish them. Absent membership returns false.

PublishResult is a discriminated union, with conditions evaluated in this order:

| Condition | Result | Effect |
| --- | --- | --- |
| Lab does not exist | kind: lab_not_found | None |
| Publication exists | kind: already_published; publication | Return original; do not consult clock |
| now < deadline | kind: before_deadline; deadline | None |
| Queue has pending decisions | kind: pending_reviews; pendingCount | None |
| Otherwise | kind: published; publication | Save one publication and return a copy |

The chosen deadline boundary is now >= deadline; exactly at the deadline is eligible. Read the clock once for a new transition and use that instant for publishedAt. Empty queues are eligible after the deadline. Pending in another lab has no effect.

For a new transition, publishedBy must be a valid ID; invalid IDs throw TypeError without a write. The default clock is () => new Date(). An invalid or throwing clock does not create a publication. The injected clock is trusted, synchronous and must not re-enter the store or invoke reset. Repeat returns the original before validating new transition inputs or consulting the clock.

### Authorization handoff to T03/T08

The store does not authenticate callers or enforce role/membership. T03/T08 must resolve a trusted principal, verify TA role, look up the lab and check isTaAssignedToClass(principal.id, lab.classId) before exposing review/publication data or publishing. publishedBy comes from that principal, never directly from client identity fields. Repeat requests still require authorization. Lab-not-found/auth-error disclosure policy and HTTP response mapping belong to T03/T08.

The diagnostic getReviewState must not become the endpoint's sole precondition check: publishLab itself checks deadline/pending and writes the transition together. T02 does not prescribe HTTP status codes or headers.

## Lifecycle, validation and guarantees

~~~ts
createInMemoryPublishStore({ initialState?, clock? }): {
  store: PublishStore;
  reset(nextState?: SeedState): void;
}
~~~

No initialState means empty state. Reset without arguments empties it; reset with a seed replaces all state. Reset is fixture/setup control outside PublishStore; do not expose it via HTTP or treat it as a product unpublish operation. There is no runtime unpublish or review-edit method.

Validation precedes replacement. Reject invalid IDs/timestamps/arrays, duplicate IDs or membership/review pairs, unknown lab references, unsupported verdicts/decisions, duplicate lab publications, publications before deadline, publications with pending reviews, and summaries that differ from the resolved queue. A seeded publication does not depend on the current clock. Invalid typed seed data throws TypeError; failed reset retains the complete old state. These setup helpers expect the SeedState object shape; they are not an untrusted JSON ingestion API.

Input seeds and returned objects do not share mutable internal state. Mutating a seed, lookup result, publication result or nested summary cannot update the store. Fixture builders return fresh objects; fixed clocks return a fresh Date each time.

Each factory owns its maps/sets. After reading the trusted clock, publish condition checks and write execute synchronously without asynchronous work or external callbacks. Calls scheduled together in one JavaScript thread are serialized: one creates the publication and later calls return it. This does not claim cross-worker/process or distributed atomicity. State is not durable, is lost on restart and is not shared between application instances. No notifications or external side effects are performed.

## Fixture usage and integration

~~~ts
import {
  createFixedClock,
  createInMemoryPublishStore,
  createPublishSeed,
} from './data/index.js';

const fixture = createInMemoryPublishStore({
  initialState: createPublishSeed('pending'),
  clock: createFixedClock(),
});
fixture.store.getLab('lab-1'); // class-1
fixture.store.isTaAssignedToClass('ta-multi', 'class-1'); // true
fixture.store.isTaAssignedToClass('ta-multi', 'class-2'); // true
fixture.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-one' });
// { kind: 'pending_reviews', pendingCount: 1 }

fixture.reset(createPublishSeed('resolved')); // test setup only
const first = fixture.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-one' });
// published: 3 queue items, 2 TA pass decisions, 1 TA violation decision
const repeat = fixture.store.publishLab({ labId: 'lab-1', publishedBy: 'ta-multi' });
// already_published: same original timestamp, ta-one and summary
~~~

createPublishSeed defaults to resolved; pending, empty and published are also supported. It supplies fictional IDs, two classes/labs, single-class TAs and a TA assigned to both classes. createFixedClock defaults to one millisecond after FIXTURE_DEADLINE; tests inject before/at-deadline values explicitly.

Vy owns app composition, manifests/lockfile and shared runner changes. Construct one fixture/store per app or test; pass only fixture.store to Phuc's module through composition. Keep reset with test setup. T02 does not change createApp or introduce a singleton. Phuc owns authorization and endpoint integration.

Run npm run build, then node --test tests/data/publish-store.test.mjs and the existing T01 smoke suite. See [data tests](../../tests/data/publish-store.test.mjs) and [evidence](../evidence/PA02/T02/README.md). Data tests do not prove HTTP authorization, full T04 harness, CI or production persistence.
