import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublishApp } from '../../dist/modules/publish/index.js';
import {
  createPublishFixtureTokens,
  createTokenIdentityResolver,
  PROBLEM_CONTENT_TYPE,
} from '../../dist/auth/index.js';
import {
  createFixedClock,
  createInMemoryPublishStore,
  createPublishSeed,
  FIXTURE_AFTER_DEADLINE,
  FIXTURE_DEADLINE,
} from '../../dist/data/index.js';

function createHarness({
  scenario = 'resolved',
  clock = createFixedClock(FIXTURE_AFTER_DEADLINE),
  tokens = createPublishFixtureTokens(),
} = {}) {
  const storeFixture = createInMemoryPublishStore({
    initialState: createPublishSeed(scenario),
    clock,
  });

  const identityResolver = createTokenIdentityResolver({ tokens });

  const app = createPublishApp({
    store: storeFixture.store,
    identityResolver,
  });

  return { app, store: storeFixture.store, reset: storeFixture.reset };
}

test('POST /labs/{labId}/publish — 401 unauthenticated when credentials are missing, malformed, or invalid', async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  // 1. Missing Authorization header
  const missing = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
  });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(missing.headers['www-authenticate'], 'Bearer');
  assert.deepEqual(missing.json(), {
    type: 'https://leetkob.example/problems/unauthenticated',
    title: 'Authentication required',
    status: 401,
    detail: 'Authentication credentials are required.',
  });

  // 2. Malformed scheme (Basic instead of Bearer)
  const malformed = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
  });
  assert.equal(malformed.statusCode, 401);
  assert.equal(malformed.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(malformed.headers['www-authenticate'], 'Bearer');
  assert.deepEqual(malformed.json(), {
    type: 'https://leetkob.example/problems/unauthenticated',
    title: 'Authentication required',
    status: 401,
    detail: 'Authentication credentials are malformed.',
  });

  // 3. Unknown Bearer token
  const unknownToken = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-does-not-exist' },
  });
  assert.equal(unknownToken.statusCode, 401);
  assert.equal(unknownToken.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(unknownToken.headers['www-authenticate'], 'Bearer');
  assert.deepEqual(unknownToken.json(), {
    type: 'https://leetkob.example/problems/unauthenticated',
    title: 'Authentication required',
    status: 401,
    detail: 'Authentication credentials are invalid.',
  });
});

test('POST /labs/{labId}/publish — 400 invalid-json for malformed JSON or prototype pollution payload', async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  // 1. Broken JSON syntax
  const malformedJson = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '{"broken": }',
  });
  assert.equal(malformedJson.statusCode, 400);
  assert.equal(malformedJson.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(malformedJson.json(), {
    type: 'https://leetkob.example/problems/invalid-json',
    title: 'Malformed JSON',
    status: 400,
    detail: 'The request body is not valid JSON.',
  });

  // 2. Prototype pollution defense: __proto__ payload rejected
  const prototypePayload = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '{"__proto__":{"polluted":true}}',
  });
  assert.equal(prototypePayload.statusCode, 400);
  assert.equal(prototypePayload.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(prototypePayload.json(), {
    type: 'https://leetkob.example/problems/invalid-json',
    title: 'Malformed JSON',
    status: 400,
    detail: 'The request body is not valid JSON.',
  });
  assert.equal(Object.prototype.polluted, undefined);
});

test('POST /labs/{labId}/publish — 400 validation for invalid labId syntax or non-object JSON body', async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  // 1. Invalid labId format (contains $ not in ^[a-zA-Z0-9_-]{1,64}$)
  const invalidLabId = await app.inject({
    method: 'POST',
    url: '/labs/invalid$lab/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(invalidLabId.statusCode, 400);
  assert.equal(invalidLabId.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(invalidLabId.json(), {
    type: 'https://leetkob.example/problems/validation',
    title: 'Invalid request',
    status: 400,
    detail: '1 request input is invalid.',
    errors: [
      {
        parameter: 'labId',
        detail: 'must be 1 to 64 ASCII letters, digits, hyphens or underscores',
      },
    ],
  });

  // 2. Non-object JSON body (e.g. array)
  const arrayBody = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '["an", "array"]',
  });
  assert.equal(arrayBody.statusCode, 400);
  assert.equal(arrayBody.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(arrayBody.json(), {
    type: 'https://leetkob.example/problems/validation',
    title: 'Invalid request',
    status: 400,
    detail: '1 request input is invalid.',
    errors: [
      {
        pointer: '',
        detail: 'request body must be a JSON object or empty',
      },
    ],
  });

  // 3. Combined: Invalid labId AND non-object JSON body
  const combined = await app.inject({
    method: 'POST',
    url: '/labs/invalid$lab/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '["not-an-object"]',
  });
  assert.equal(combined.statusCode, 400);
  assert.equal(combined.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(combined.json(), {
    type: 'https://leetkob.example/problems/validation',
    title: 'Invalid request',
    status: 400,
    detail: '2 request inputs are invalid.',
    errors: [
      {
        parameter: 'labId',
        detail: 'must be 1 to 64 ASCII letters, digits, hyphens or underscores',
      },
      {
        pointer: '',
        detail: 'request body must be a JSON object or empty',
      },
    ],
  });
});

test('POST /labs/{labId}/publish — 404 not-found when target lab does not exist', async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/labs/lab-non-existent/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(response.json(), {
    type: 'https://leetkob.example/problems/not-found',
    title: 'Not found',
    status: 404,
    detail: 'The requested lab was not found.',
  });
});

test('POST /labs/{labId}/publish — 403 forbidden for student, admin, or cross-class TA', async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  // 1. Caller with role 'student' is rejected
  const student = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-student-one' },
  });
  assert.equal(student.statusCode, 403);
  assert.equal(student.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(student.json(), {
    type: 'https://leetkob.example/problems/forbidden',
    title: 'Forbidden',
    status: 403,
    detail: 'Only an authenticated TA may publish lab grades.',
  });

  // 2. Caller with role 'admin' is rejected (publish strictly requires TA)
  const admin = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-admin-one' },
  });
  assert.equal(admin.statusCode, 403);
  assert.equal(admin.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(admin.json(), {
    type: 'https://leetkob.example/problems/forbidden',
    title: 'Forbidden',
    status: 403,
    detail: 'Only an authenticated TA may publish lab grades.',
  });

  // 3. Cross-class TA: ta-other is assigned to class-2, but lab-1 belongs to class-1
  const crossClassTa = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-other' },
  });
  assert.equal(crossClassTa.statusCode, 403);
  assert.equal(crossClassTa.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(crossClassTa.json(), {
    type: 'https://leetkob.example/problems/forbidden',
    title: 'Forbidden',
    status: 403,
    detail:
      'The authenticated TA is not assigned to the class that owns this lab.',
  });
});

test('POST /labs/{labId}/publish — 409 before-deadline when server time is before deadline', async (t) => {
  const clockBefore = createFixedClock('2026-11-09T14:59:59.999Z');
  const { app } = createHarness({ clock: clockBefore });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(response.json(), {
    type: 'https://leetkob.example/problems/before-deadline',
    title: 'Lab deadline has not passed',
    status: 409,
    detail: 'Grades cannot be published before the lab deadline.',
    deadline: FIXTURE_DEADLINE,
  });
});

test('POST /labs/{labId}/publish — 409 pending-reviews with pendingCount member when reviews remain pending', async (t) => {
  const { app, store } = createHarness({ scenario: 'pending' });
  t.after(() => app.close());

  // Confirm store has 1 pending item
  assert.equal(store.getReviewState('lab-1')?.pendingCount, 1);

  const response = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(response.json(), {
    type: 'https://leetkob.example/problems/pending-reviews',
    title: 'Pending reviews block publication',
    status: 409,
    detail: '1 required review queue item is still pending.',
    pendingCount: 1,
  });

  // Verification: No publication was recorded
  assert.equal(store.getPublication('lab-1'), undefined);
});

test('POST /labs/{labId}/publish — 200 OK initial publication succeeds and returns LabPublication resource', async (t) => {
  const { app, store } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: { comment: 'TA publication note' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.headers['content-type'],
    'application/json; charset=utf-8',
  );
  // Initial publication must NOT have Idempotent-Replayed header
  assert.equal(response.headers['idempotent-replayed'], undefined);

  const expectedPublication = {
    labId: 'lab-1',
    classId: 'class-1',
    status: 'published',
    publishedAt: FIXTURE_AFTER_DEADLINE,
    publishedBy: 'ta-one',
    summary: {
      queueItemCount: 3,
      passDecisionCount: 2,
      violationDecisionCount: 1,
    },
  };
  assert.deepEqual(response.json(), expectedPublication);

  // Store verification: Exactly 1 publication recorded matching expected
  const stored = store.getPublication('lab-1');
  assert.ok(stored);
  assert.equal(stored.labId, 'lab-1');
  assert.equal(stored.publishedAt, FIXTURE_AFTER_DEADLINE);
  assert.equal(stored.publishedBy, 'ta-one');
  assert.deepEqual(stored.summary, expectedPublication.summary);
});

test('POST /labs/{labId}/publish — 200 OK repeated call is naturally idempotent with Idempotent-Replayed: true', async (t) => {
  const { app, store } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  // 1. Initial publication by ta-one
  const first = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['idempotent-replayed'], undefined);
  const initialBody = first.json();

  // 2. Repeat call by a DIFFERENT authorized TA of the same class (ta-multi)
  const second = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-multi' },
  });
  assert.equal(second.statusCode, 200);
  // Repeat call MUST include the Idempotent-Replayed: true header
  assert.equal(second.headers['idempotent-replayed'], 'true');

  // Body must be identical to the original publication (preserved publishedBy: ta-one, same publishedAt, same summary)
  assert.deepEqual(second.json(), initialBody);
  assert.equal(second.json().publishedBy, 'ta-one');
  assert.equal(second.json().publishedAt, FIXTURE_AFTER_DEADLINE);

  // 3. Repeat call by ta-one again
  const third = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(third.statusCode, 200);
  assert.equal(third.headers['idempotent-replayed'], 'true');
  assert.deepEqual(third.json(), initialBody);

  // Verify store has still only the single original publication record
  const stored = store.getPublication('lab-1');
  assert.equal(stored.publishedBy, 'ta-one');
  assert.equal(stored.publishedAt, FIXTURE_AFTER_DEADLINE);
});

test('POST /labs/{labId}/publish — client cannot spoof caller identity, role, or state in body', async (t) => {
  const { app } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  // A student tries to spoof TA identity and publishedAt in body
  const spoofAttempt = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-student-one' },
    payload: {
      userId: 'ta-one',
      role: 'TA',
      classId: 'class-1',
      publishedAt: '2026-01-01T00:00:00.000Z',
      force: true,
    },
  });
  // Server refuses based strictly on the trusted Bearer token principal (role: student)
  assert.equal(spoofAttempt.statusCode, 403);
  assert.deepEqual(
    spoofAttempt.json().type,
    'https://leetkob.example/problems/forbidden',
  );
});

test('POST /labs/{labId}/publish — empty request body or omitted body succeeds', async (t) => {
  const { app } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  // Request with omitted payload entirely
  const resOmitted = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(resOmitted.statusCode, 200);
  assert.equal(resOmitted.json().status, 'published');
});

test('POST /labs/{labId}/publish — 413 payload-too-large when body exceeds 64 KB limit', async (t) => {
  const { app } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  const largePayload = JSON.stringify({ padding: 'x'.repeat(70000) });
  const res = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: largePayload,
  });

  assert.equal(res.statusCode, 413);
  assert.equal(res.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(res.json(), {
    type: 'https://leetkob.example/problems/payload-too-large',
    title: 'Payload too large',
    status: 413,
    detail: 'Request payload exceeds the configured limit.',
  });
});

test('POST /labs/{labId}/publish — 415 unsupported-media-type when content-type is unsupported (application/xml, text/plain)', async (t) => {
  const { app } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  // 1. application/xml with credentials -> 415
  const xmlRes = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/xml',
    },
    payload: '<publish />',
  });

  assert.equal(xmlRes.statusCode, 415);
  assert.equal(xmlRes.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(xmlRes.json(), {
    type: 'https://leetkob.example/problems/unsupported-media-type',
    title: 'Unsupported media type',
    status: 415,
    detail: 'The request payload content-type is unsupported.',
  });

  // 2. text/plain with credentials -> 415 (not 400 validation)
  const plainRes = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'text/plain',
    },
    payload: '{}',
  });

  assert.equal(plainRes.statusCode, 415);
  assert.equal(plainRes.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(plainRes.json(), {
    type: 'https://leetkob.example/problems/unsupported-media-type',
    title: 'Unsupported media type',
    status: 415,
    detail: 'The request payload content-type is unsupported.',
  });

  // 3. text/plain; charset=utf-8 with credentials -> 415
  const plainCharsetRes = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'text/plain; charset=utf-8',
    },
    payload: 'plain payload',
  });

  assert.equal(plainCharsetRes.statusCode, 415);
  assert.equal(plainCharsetRes.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(
    plainCharsetRes.json().type,
    'https://leetkob.example/problems/unsupported-media-type',
  );
});

test('POST /labs/{labId}/publish — precedence: unsupported content-type (text/plain) is rejected with 415 before authentication', async (t) => {
  const { app } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  // Request with NO Authorization header and text/plain content-type
  const res = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      'content-type': 'text/plain',
    },
    payload: '{}',
  });

  // Transport parser runs before route auth handler -> 415 unsupported-media-type (NOT 401)
  assert.equal(res.statusCode, 415);
  assert.equal(res.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(res.headers['www-authenticate'], undefined);
  assert.deepEqual(res.json(), {
    type: 'https://leetkob.example/problems/unsupported-media-type',
    title: 'Unsupported media type',
    status: 415,
    detail: 'The request payload content-type is unsupported.',
  });
});

test('POST /labs/{labId}/publish — precedence: malformed JSON body is rejected with 400 invalid-json before authentication', async (t) => {
  const { app } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  // Request with NO Authorization header and malformed JSON body
  const res = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      'content-type': 'application/json',
    },
    payload: '{"broken": json',
  });

  // Parser runs before route auth handler -> 400 invalid-json
  assert.equal(res.statusCode, 400);
  assert.equal(res.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(res.headers['www-authenticate'], undefined);
  assert.deepEqual(res.json(), {
    type: 'https://leetkob.example/problems/invalid-json',
    title: 'Malformed JSON',
    status: 400,
    detail: 'The request body is not valid JSON.',
  });
});

test('POST /labs/{labId}/publish — precedence: caller role check precedes lab lookup (anti-enumeration defense)', async (t) => {
  const { app } = createHarness({ scenario: 'resolved' });
  t.after(() => app.close());

  // 1. Student calls with non-existent lab -> 403 forbidden (NOT 404)
  const studentRes = await app.inject({
    method: 'POST',
    url: '/labs/non-existent-lab/publish',
    headers: { authorization: 'Bearer token-student-one' },
  });
  assert.equal(studentRes.statusCode, 403);
  assert.equal(
    studentRes.json().type,
    'https://leetkob.example/problems/forbidden',
  );
  assert.equal(
    studentRes.json().detail,
    'Only an authenticated TA may publish lab grades.',
  );

  // 2. Admin calls with non-existent lab -> 403 forbidden (NOT 404)
  const adminRes = await app.inject({
    method: 'POST',
    url: '/labs/non-existent-lab/publish',
    headers: { authorization: 'Bearer token-admin-one' },
  });
  assert.equal(adminRes.statusCode, 403);
  assert.equal(
    adminRes.json().type,
    'https://leetkob.example/problems/forbidden',
  );
  assert.equal(
    adminRes.json().detail,
    'Only an authenticated TA may publish lab grades.',
  );

  // 3. Authenticated TA calls with non-existent lab -> 404 not-found
  const taRes = await app.inject({
    method: 'POST',
    url: '/labs/non-existent-lab/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(taRes.statusCode, 404);
  assert.equal(taRes.json().type, 'https://leetkob.example/problems/not-found');
  assert.equal(taRes.json().detail, 'The requested lab was not found.');

  // 4. Authenticated TA calls with existent lab belonging to unassigned class -> 403 forbidden (class_membership)
  const unassignedTaRes = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-other' },
  });
  assert.equal(unassignedTaRes.statusCode, 403);
  assert.equal(
    unassignedTaRes.json().type,
    'https://leetkob.example/problems/forbidden',
  );
  assert.equal(
    unassignedTaRes.json().detail,
    'The authenticated TA is not assigned to the class that owns this lab.',
  );
});
