import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../dist/app.js';
import {
  authorizePublishAccess,
  cloneProblemDetails,
  createBeforeDeadlineProblem,
  createForbiddenProblem,
  createInternalProblem,
  createInvalidJsonProblem,
  createNotFoundProblem,
  createPayloadTooLargeProblem,
  createPendingReviewsProblem,
  createPublishFixtureTokens,
  createTestHeaderIdentityResolver,
  createTokenIdentityResolver,
  createUnauthenticatedProblem,
  createUnsupportedMediaTypeProblem,
  createValidationProblem,
  isValidLabId,
  mapAccessDecisionToProblem,
  mapPublishResultToProblem,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPE_PREFIX,
  ProblemError,
  registerPublishErrorHandling,
  sendProblem,
  validatePrincipal,
  validatePublishRequestInput,
} from '../../dist/auth/index.js';
import {
  createFixedClock,
  createInMemoryPublishStore,
  createPublishSeed,
  FIXTURE_DEADLINE,
} from '../../dist/data/index.js';

function createPublishProbeApp({
  scenario = 'resolved',
  clock = createFixedClock(),
  identityResolver = createTokenIdentityResolver({
    tokens: createPublishFixtureTokens(),
  }),
  throwInternalError = false,
} = {}) {
  const fixture = createInMemoryPublishStore({
    initialState: createPublishSeed(scenario),
    clock,
  });

  const app = createApp({
    modules: {
      publish: async (scope) => {
        registerPublishErrorHandling(scope);

        scope.post(
          '/probe/limited',
          { bodyLimit: 32 },
          async () => ({ ok: true }),
        );
        scope.post(
          '/probe/schema',
          {
            schema: {
              body: {
                type: 'object',
                required: ['reason'],
                properties: {
                  reason: { type: 'string' },
                },
              },
            },
          },
          async () => ({ ok: true }),
        );

        scope.post('/labs/:labId/publish', async (request, reply) => {
          if (throwInternalError) {
            throw new Error(
              'Simulated failure at D:\\HCMUS\\secret\\config.json with key sk-secret-99999',
            );
          }

          const params = request.params ?? {};
          const labId = params.labId;

          const authDecision = authorizePublishAccess({
            headers: request.headers,
            labId: typeof labId === 'string' ? labId : '',
            store: fixture.store,
            identityResolver,
          });

          if (authDecision.kind === 'unauthenticated') {
            return sendProblem(reply, mapAccessDecisionToProblem(authDecision));
          }

          const validationIssues = validatePublishRequestInput({
            labId,
            body: request.body,
          });
          if (validationIssues.length > 0) {
            return sendProblem(
              reply,
              createValidationProblem(validationIssues),
            );
          }

          if (authDecision.kind !== 'authorized') {
            return sendProblem(reply, mapAccessDecisionToProblem(authDecision));
          }

          const publishResult = fixture.store.publishLab({
            labId: authDecision.lab.id,
            publishedBy: authDecision.principal.id,
          });

          if (
            publishResult.kind !== 'published' &&
            publishResult.kind !== 'already_published'
          ) {
            return sendProblem(reply, mapPublishResultToProblem(publishResult));
          }

          if (publishResult.kind === 'already_published') {
            reply.header('idempotent-replayed', 'true');
          }
          return reply.code(200).send(publishResult.publication);
        });
      },
    },
  });

  return { app, fixture };
}

test('token identity resolver authenticates valid bearer tokens and returns defensive copies', () => {
  const tokens = createPublishFixtureTokens();
  const resolver = createTokenIdentityResolver({ tokens });
  tokens['token-ta-one'].role = 'student';

  const first = resolver.resolve({ authorization: 'Bearer token-ta-one' });
  assert.deepEqual(first, {
    kind: 'authenticated',
    principal: { id: 'ta-one', role: 'TA' },
  });

  if (first.kind === 'authenticated') {
    first.principal.id = 'mutated';
  }
  const second = resolver.resolve({ AUTHORIZATION: 'bearer token-ta-one' });
  assert.deepEqual(second, {
    kind: 'authenticated',
    principal: { id: 'ta-one', role: 'TA' },
  });
});

for (const [label, headers, expectedReason] of [
  ['missing header', {}, 'missing_credentials'],
  ['undefined authorization', { authorization: undefined }, 'missing_credentials'],
  ['empty authorization', { authorization: '' }, 'malformed_credentials'],
  ['whitespace authorization', { authorization: '   ' }, 'malformed_credentials'],
  [
    'leading whitespace authorization',
    { authorization: ' Bearer token-ta-one' },
    'malformed_credentials',
  ],
  ['wrong auth scheme', { authorization: 'Basic dGEtb25l' }, 'malformed_credentials'],
  ['bearer without token', { authorization: 'Bearer' }, 'malformed_credentials'],
  ['bearer with extra segments', { authorization: 'Bearer a b' }, 'malformed_credentials'],
  [
    'array authorization header',
    { authorization: ['Bearer token-ta-one'] },
    'malformed_credentials',
  ],
  ['unknown bearer token', { authorization: 'Bearer unknown-token' }, 'invalid_credentials'],
]) {
  test(`token identity resolver rejects ${label} with ${expectedReason}`, () => {
    const resolver = createTokenIdentityResolver({
      tokens: createPublishFixtureTokens(),
    });
    assert.deepEqual(resolver.resolve(headers), {
      kind: 'unauthenticated',
      reason: expectedReason,
    });
  });
}

test('default token resolver has no implicit credentials and rejects all requests', () => {
  const resolver = createTokenIdentityResolver();
  assert.deepEqual(
    resolver.resolve({ authorization: 'Bearer token-ta-one' }),
    { kind: 'unauthenticated', reason: 'invalid_credentials' },
  );
});

test('test-header identity injection is disabled by default and cannot become a public bypass', () => {
  const defaultTestResolver = createTestHeaderIdentityResolver();
  assert.deepEqual(
    defaultTestResolver.resolve({
      'x-test-user-id': 'ta-one',
      'x-test-role': 'TA',
    }),
    { kind: 'unauthenticated', reason: 'missing_credentials' },
  );

  const explicitDisabledResolver = createTestHeaderIdentityResolver({
    allowTestHeader: false,
    fallbackResolver: createTokenIdentityResolver({
      tokens: createPublishFixtureTokens(),
    }),
  });
  assert.deepEqual(
    explicitDisabledResolver.resolve({
      'x-test-user-id': 'ta-one',
      'x-test-role': 'TA',
    }),
    { kind: 'unauthenticated', reason: 'missing_credentials' },
  );
  assert.deepEqual(
    explicitDisabledResolver.resolve({
      'x-test-user-id': 'student-one',
      'x-test-role': 'student',
      authorization: 'Bearer token-ta-one',
    }),
    {
      kind: 'authenticated',
      principal: { id: 'ta-one', role: 'TA' },
    },
  );
});

test('explicit programmatic test-header resolver validates headers when enabled in tests', () => {
  const resolver = createTestHeaderIdentityResolver({
    allowTestHeader: true,
    fallbackResolver: createTokenIdentityResolver({
      tokens: createPublishFixtureTokens(),
    }),
  });

  assert.deepEqual(
    resolver.resolve({ 'x-test-user-id': 'ta-one', 'x-test-role': 'TA' }),
    { kind: 'authenticated', principal: { id: 'ta-one', role: 'TA' } },
  );
  assert.deepEqual(
    resolver.resolve({ 'x-test-user-id': 'ta-one' }),
    { kind: 'unauthenticated', reason: 'malformed_credentials' },
  );
  assert.deepEqual(
    resolver.resolve({ 'x-test-user-id': ' ta-one', 'x-test-role': 'TA' }),
    { kind: 'unauthenticated', reason: 'malformed_credentials' },
  );
  assert.deepEqual(
    resolver.resolve({ 'x-test-user-id': 'ta-one', 'x-test-role': 'superuser' }),
    { kind: 'unauthenticated', reason: 'malformed_credentials' },
  );
  assert.deepEqual(
    resolver.resolve({ authorization: 'Bearer token-ta-other' }),
    { kind: 'authenticated', principal: { id: 'ta-other', role: 'TA' } },
  );
});

test('authorizePublishAccess enforces role TA, lab existence and T02 class ownership', () => {
  const { store } = createInMemoryPublishStore({
    initialState: createPublishSeed('resolved'),
    clock: createFixedClock(),
  });
  const identityResolver = createTokenIdentityResolver({
    tokens: createPublishFixtureTokens(),
  });

  // 1. Unauthenticated caller
  assert.deepEqual(
    authorizePublishAccess({
      headers: {},
      labId: 'lab-1',
      store,
      identityResolver,
    }),
    { kind: 'unauthenticated', reason: 'missing_credentials' },
  );

  // 2. Wrong role: student and admin are denied even if they target an existing lab
  for (const [token, id, role] of [
    ['token-student-one', 'student-one', 'student'],
    ['token-admin-one', 'admin-one', 'admin'],
  ]) {
    const decision = authorizePublishAccess({
      headers: { authorization: `Bearer ${token}` },
      labId: 'lab-1',
      store,
      identityResolver,
    });
    assert.deepEqual(decision, {
      kind: 'forbidden_role',
      principal: { id, role },
    });
  }

  // 3. Unknown lab for an authenticated TA
  assert.deepEqual(
    authorizePublishAccess({
      headers: { authorization: 'Bearer token-ta-one' },
      labId: 'lab-missing',
      store,
      identityResolver,
    }),
    { kind: 'lab_not_found', labId: 'lab-missing' },
  );

  // 4. Cross-class denial: ta-other belongs to class-2 and is denied on lab-1 (class-1)
  assert.deepEqual(
    authorizePublishAccess({
      headers: { authorization: 'Bearer token-ta-other' },
      labId: 'lab-1',
      store,
      identityResolver,
    }),
    {
      kind: 'forbidden_class',
      principal: { id: 'ta-other', role: 'TA' },
      labId: 'lab-1',
    },
  );

  // 5. Authorized TAs: ta-one on lab-1, ta-other on lab-2, ta-multi on both
  for (const [token, expectedId, labId, classId] of [
    ['token-ta-one', 'ta-one', 'lab-1', 'class-1'],
    ['token-ta-other', 'ta-other', 'lab-2', 'class-2'],
    ['token-ta-multi', 'ta-multi', 'lab-1', 'class-1'],
    ['token-ta-multi', 'ta-multi', 'lab-2', 'class-2'],
  ]) {
    const decision = authorizePublishAccess({
      headers: { authorization: `Bearer ${token}` },
      labId,
      store,
      identityResolver,
    });
    assert.deepEqual(decision, {
      kind: 'authorized',
      principal: { id: expectedId, role: 'TA' },
      lab: { id: labId, classId, deadline: FIXTURE_DEADLINE },
    });
  }
});

test('HTTP boundary rejects missing/invalid identity, wrong role and cross-class TA with RFC 9457 problem details', async (t) => {
  const { app, fixture } = createPublishProbeApp({ scenario: 'resolved' });
  t.after(() => app.close());

  // Missing credentials -> 401 with WWW-Authenticate challenge (RFC 9110 section 11.6.1)
  const missingAuth = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    payload: { userId: 'ta-one', role: 'TA', classId: 'class-1' },
  });
  assert.equal(missingAuth.statusCode, 401);
  assert.equal(missingAuth.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(missingAuth.headers['www-authenticate'], 'Bearer');
  assert.deepEqual(missingAuth.json(), {
    type: 'https://leetkob.example/problems/unauthenticated',
    title: 'Authentication required',
    status: 401,
    detail: 'Authentication credentials are required.',
  });

  // Malformed credentials -> 401 with WWW-Authenticate
  const malformedAuth = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
  });
  assert.equal(malformedAuth.statusCode, 401);
  assert.equal(malformedAuth.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(malformedAuth.headers['www-authenticate'], 'Bearer');
  assert.deepEqual(malformedAuth.json(), {
    type: 'https://leetkob.example/problems/unauthenticated',
    title: 'Authentication required',
    status: 401,
    detail: 'Authentication credentials are malformed.',
  });

  // Invalid credentials -> 401 with WWW-Authenticate
  const invalidAuth = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-unknown-123' },
  });
  assert.equal(invalidAuth.statusCode, 401);
  assert.equal(invalidAuth.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.equal(invalidAuth.headers['www-authenticate'], 'Bearer');
  assert.deepEqual(invalidAuth.json(), {
    type: 'https://leetkob.example/problems/unauthenticated',
    title: 'Authentication required',
    status: 401,
    detail: 'Authentication credentials are invalid.',
  });

  // Student role attempting to spoof TA in request body -> 403
  const wrongRole = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-student-one' },
    payload: { userId: 'ta-one', role: 'TA', publishedBy: 'ta-one' },
  });
  assert.equal(wrongRole.statusCode, 403);
  assert.equal(wrongRole.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(wrongRole.json(), {
    type: 'https://leetkob.example/problems/forbidden',
    title: 'Forbidden',
    status: 403,
    detail: 'Only an authenticated TA may publish lab grades.',
  });

  // Cross-class TA (ta-other in class-2 calling lab-1 in class-1) -> 403 without leaking class-1
  const crossClass = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-other' },
  });
  assert.equal(crossClass.statusCode, 403);
  assert.equal(crossClass.headers['content-type'], PROBLEM_CONTENT_TYPE);
  const crossClassBody = crossClass.json();
  assert.deepEqual(crossClassBody, {
    type: 'https://leetkob.example/problems/forbidden',
    title: 'Forbidden',
    status: 403,
    detail: 'The authenticated TA is not assigned to the class that owns this lab.',
  });
  assert.equal( crossClass.body.includes('class-1'), false);

  // Unknown lab -> 404
  const notFound = await app.inject({
    method: 'POST',
    url: '/labs/lab-999/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(notFound.statusCode, 404);
  assert.equal(notFound.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(notFound.json(), {
    type: 'https://leetkob.example/problems/not-found',
    title: 'Not found',
    status: 404,
    detail: 'The requested lab was not found.',
  });

  // Ensure none of the rejected requests created a publication
  assert.equal(fixture.store.getPublication('lab-1'), undefined);
});

test('HTTP boundary maps parser errors, validation errors, deadline/pending conflicts and internal errors to RFC 9457 without leaking internals', async (t) => {
  const { app, fixture } = createPublishProbeApp({ scenario: 'pending' });
  t.after(() => app.close());

  // Malformed JSON -> 400 invalid-json
  const badJson = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '{"unterminated": ',
  });
  assert.equal(badJson.statusCode, 400);
  assert.equal(badJson.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(badJson.json(), {
    type: 'https://leetkob.example/problems/invalid-json',
    title: 'Malformed JSON',
    status: 400,
    detail: 'The request body is not valid JSON.',
  });

  // Prototype pollution attempt -> rejected as 400 invalid-json without polluting Object.prototype
  const protoPollution = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '{"__proto__":{"polluted":true}}',
  });
  assert.equal(protoPollution.statusCode, 400);
  assert.equal(protoPollution.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(protoPollution.json(), {
    type: 'https://leetkob.example/problems/invalid-json',
    title: 'Malformed JSON',
    status: 400,
    detail: 'The request body is not valid JSON.',
  });
  assert.equal(Object.prototype.polluted, undefined);

  // Body exceeds payload limit -> 413 payload-too-large (does not collapse into 500)
  const tooLarge = await app.inject({
    method: 'POST',
    url: '/probe/limited',
    headers: {
      'content-type': 'application/json',
    },
    payload: JSON.stringify({ data: 'x'.repeat(100) }),
  });
  assert.equal(tooLarge.statusCode, 413);
  assert.equal(tooLarge.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(tooLarge.json(), {
    type: 'https://leetkob.example/problems/payload-too-large',
    title: 'Payload too large',
    status: 413,
    detail: 'Request payload exceeds the configured limit.',
  });

  // Unsupported media type -> 415 unsupported-media-type (does not collapse into 500)
  const unsupportedMedia = await app.inject({
    method: 'POST',
    url: '/probe/limited',
    headers: {
      'content-type': 'application/xml',
    },
    payload: '<xml></xml>',
  });
  assert.equal(unsupportedMedia.statusCode, 415);
  assert.equal(unsupportedMedia.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(unsupportedMedia.json(), {
    type: 'https://leetkob.example/problems/unsupported-media-type',
    title: 'Unsupported media type',
    status: 415,
    detail: 'The request payload content-type is unsupported.',
  });

  // Route schema validation failure -> 400 validation with structured issues (does not collapse into 500)
  const schemaError = await app.inject({
    method: 'POST',
    url: '/probe/schema',
    headers: {
      'content-type': 'application/json',
    },
    payload: JSON.stringify({ wrongField: 123 }),
  });
  assert.equal(schemaError.statusCode, 400);
  assert.equal(schemaError.headers['content-type'], PROBLEM_CONTENT_TYPE);
  const schemaJson = schemaError.json();
  assert.equal(schemaJson.type, 'https://leetkob.example/problems/validation');
  assert.equal(schemaJson.status, 400);
  assert.ok(Array.isArray(schemaJson.errors));
  assert.ok(schemaJson.errors.length > 0);

  // Non-object JSON body and invalid labId -> 400 validation with errors[]
  const invalidInputs = await app.inject({
    method: 'POST',
    url: '/labs/invalid$lab/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '["not-an-object"]',
  });
  assert.equal(invalidInputs.statusCode, 400);
  assert.equal(invalidInputs.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(invalidInputs.json(), {
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

  // Pending reviews -> 409 pending-reviews
  const pending = await app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: {
      authorization: 'Bearer token-ta-one',
      'content-type': 'application/json',
    },
    payload: '',
  });
  assert.equal(pending.statusCode, 409);
  assert.equal(pending.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(pending.json(), {
    type: 'https://leetkob.example/problems/pending-reviews',
    title: 'Pending reviews block publication',
    status: 409,
    detail: '1 required review queue item is still pending.',
    pendingCount: 1,
  });
  assert.equal(fixture.store.getPublication('lab-1'), undefined);

  // Before deadline -> 409 before-deadline
  const beforeDeadline = createPublishProbeApp({
    scenario: 'resolved',
    clock: createFixedClock('2026-11-09T14:59:59.000Z'),
  });
  t.after(() => beforeDeadline.app.close());
  const earlyResponse = await beforeDeadline.app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(earlyResponse.statusCode, 409);
  assert.equal(earlyResponse.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(earlyResponse.json(), {
    type: 'https://leetkob.example/problems/before-deadline',
    title: 'Lab deadline has not passed',
    status: 409,
    detail: 'Grades cannot be published before the lab deadline.',
    deadline: FIXTURE_DEADLINE,
  });

  // Unexpected internal error -> 500 internal with no secret/path/stack leakage
  const failing = createPublishProbeApp({ throwInternalError: true });
  t.after(() => failing.app.close());
  const internalResponse = await failing.app.inject({
    method: 'POST',
    url: '/labs/lab-1/publish',
    headers: { authorization: 'Bearer token-ta-one' },
  });
  assert.equal(internalResponse.statusCode, 500);
  assert.equal(internalResponse.headers['content-type'], PROBLEM_CONTENT_TYPE);
  assert.deepEqual(internalResponse.json(), {
    type: 'https://leetkob.example/problems/internal',
    title: 'Internal error',
    status: 500,
    detail: 'An unexpected internal error occurred.',
  });
  assert.equal(internalResponse.body.includes('sk-secret-99999'), false);
  assert.equal(internalResponse.body.includes('D:\\HCMUS'), false);
  assert.equal(internalResponse.body.includes('stack'), false);
});

test('problem factories validate inputs and return defensive copies', () => {
  assert.equal(PROBLEM_TYPE_PREFIX, 'https://leetkob.example/problems/');
  assert.equal(isValidLabId('lab-1_A'), true);
  assert.equal(isValidLabId(''), false);
  assert.equal(isValidLabId('a'.repeat(65)), false);

  assert.throws(() => validatePrincipal(null), /must be an object/);
  assert.throws(() => validatePrincipal({ id: ' ', role: 'TA' }), /id/);
  assert.throws(() => validatePrincipal({ id: 'ta-1', role: 'guest' }), /role/);
  assert.throws(
    () => createTokenIdentityResolver({ tokens: { 'bad token': { id: 'ta-1', role: 'TA' } } }),
    /Bearer token key/,
  );
  assert.throws(() => createValidationProblem([]), /at least one/);
  assert.throws(() => createBeforeDeadlineProblem(''), /deadline/);
  assert.throws(() => createPendingReviewsProblem(0), /pendingCount/);

  const issues = [{ parameter: 'labId', detail: 'invalid' }];
  const problem = createValidationProblem(issues);
  issues[0].detail = 'mutated';
  const cloned = cloneProblemDetails(problem);
  assert.equal(cloned.errors?.[0]?.detail, 'invalid');

  const error = new ProblemError(createPendingReviewsProblem(2));
  assert.equal(error.problem.pendingCount, 2);
  assert.equal(
    error.problem.detail,
    '2 required review queue items are still pending.',
  );
  assert.equal(createUnauthenticatedProblem().status, 401);
  assert.equal(createForbiddenProblem().status, 403);
  assert.equal(createInvalidJsonProblem().status, 400);
  assert.equal(createNotFoundProblem().status, 404);
  assert.equal(createPayloadTooLargeProblem().status, 413);
  assert.equal(createUnsupportedMediaTypeProblem().status, 415);
  assert.equal(createInternalProblem().status, 500);
});
