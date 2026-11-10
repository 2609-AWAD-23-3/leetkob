import type { FastifyInstance, FastifyReply } from 'fastify';
import type {
  ProblemDetails,
  PublishAccessDecision,
  PublishResultProblem,
  UnauthenticatedReason,
  ValidationIssue,
} from './types.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';
export const PROBLEM_TYPE_PREFIX = 'https://leetkob.example/problems/';

const LAB_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function cloneValidationIssue(issue: ValidationIssue): ValidationIssue {
  if ('parameter' in issue) {
    return { parameter: issue.parameter, detail: issue.detail };
  }
  return { pointer: issue.pointer, detail: issue.detail };
}

export function cloneProblemDetails(problem: ProblemDetails): ProblemDetails {
  const copy: ProblemDetails = {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    detail: problem.detail,
    ...(problem.errors
      ? { errors: problem.errors.map(cloneValidationIssue) }
      : {}),
    ...(problem.deadline !== undefined ? { deadline: problem.deadline } : {}),
    ...(problem.pendingCount !== undefined
      ? { pendingCount: problem.pendingCount }
      : {}),
  };
  return copy;
}

export class ProblemError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ProblemError';
    this.problem = cloneProblemDetails(problem);
  }
}

export function createUnauthenticatedProblem(
  reason: UnauthenticatedReason = 'missing_credentials',
): ProblemDetails {
  const detailByReason: Readonly<Record<UnauthenticatedReason, string>> = {
    missing_credentials: 'Authentication credentials are required.',
    malformed_credentials: 'Authentication credentials are malformed.',
    invalid_credentials: 'Authentication credentials are invalid.',
  };
  return {
    type: 'https://leetkob.example/problems/unauthenticated',
    title: 'Authentication required',
    status: 401,
    detail: detailByReason[reason],
  };
}

export function createForbiddenProblem(
  reason: 'role' | 'class_membership' = 'role',
): ProblemDetails {
  const detail =
    reason === 'role'
      ? 'Only an authenticated TA may publish lab grades.'
      : 'The authenticated TA is not assigned to the class that owns this lab.';
  return {
    type: 'https://leetkob.example/problems/forbidden',
    title: 'Forbidden',
    status: 403,
    detail,
  };
}

export function createInvalidJsonProblem(): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/invalid-json',
    title: 'Malformed JSON',
    status: 400,
    detail: 'The request body is not valid JSON.',
  };
}

export function createValidationProblem(
  errors: readonly ValidationIssue[],
  detail?: string,
): ProblemDetails {
  if (!Array.isArray(errors) || errors.length === 0) {
    throw new TypeError(
      'Validation problem requires at least one validation issue',
    );
  }
  const cloned = errors.map(cloneValidationIssue);
  const summary =
    detail ??
    (cloned.length === 1
      ? '1 request input is invalid.'
      : `${cloned.length} request inputs are invalid.`);
  return {
    type: 'https://leetkob.example/problems/validation',
    title: 'Invalid request',
    status: 400,
    detail: summary,
    errors: cloned,
  };
}

export function createNotFoundProblem(
  detail = 'The requested lab was not found.',
): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/not-found',
    title: 'Not found',
    status: 404,
    detail,
  };
}

export function createBeforeDeadlineProblem(deadline: string): ProblemDetails {
  if (typeof deadline !== 'string' || deadline.trim().length === 0) {
    throw new TypeError('deadline must be a non-empty ISO timestamp string');
  }
  return {
    type: 'https://leetkob.example/problems/before-deadline',
    title: 'Lab deadline has not passed',
    status: 409,
    detail: 'Grades cannot be published before the lab deadline.',
    deadline,
  };
}

export function createPendingReviewsProblem(
  pendingCount: number,
): ProblemDetails {
  if (!Number.isInteger(pendingCount) || pendingCount < 1) {
    throw new TypeError('pendingCount must be a positive integer');
  }
  return {
    type: 'https://leetkob.example/problems/pending-reviews',
    title: 'Pending reviews block publication',
    status: 409,
    detail:
      pendingCount === 1
        ? '1 required review queue item is still pending.'
        : `${pendingCount} required review queue items are still pending.`,
    pendingCount,
  };
}

export function createInternalProblem(): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/internal',
    title: 'Internal error',
    status: 500,
    detail: 'An unexpected internal error occurred.',
  };
}

export function createPayloadTooLargeProblem(
  detail = 'Request payload exceeds the configured limit.',
): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/payload-too-large',
    title: 'Payload too large',
    status: 413,
    detail,
  };
}

export function createUnsupportedMediaTypeProblem(
  detail = 'The request payload content-type is unsupported.',
): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/unsupported-media-type',
    title: 'Unsupported media type',
    status: 415,
    detail,
  };
}

export function createConflictProblem(
  detail = 'The request could not be completed due to a conflict with current resource state.',
): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/conflict',
    title: 'Conflict',
    status: 409,
    detail,
  };
}

export function createUnprocessableContentProblem(
  detail = 'The request was well-formed but was unable to be followed due to semantic errors.',
): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/unprocessable-content',
    title: 'Unprocessable content',
    status: 422,
    detail,
  };
}

export function createRateLimitedProblem(
  detail = 'Too many requests have been sent. Please try again later.',
): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/rate-limited',
    title: 'Too many requests',
    status: 429,
    detail,
  };
}

export function createClientErrorProblem(
  status: 400 | 401 | 403 | 404 | 405 | 409 | 413 | 415 | 422 | 429 = 400,
  detail = 'A client error occurred processing the request.',
): ProblemDetails {
  return {
    type: 'https://leetkob.example/problems/client-error',
    title: 'Client error',
    status,
    detail,
  };
}

export function mapAccessDecisionToProblem(
  decision: Exclude<PublishAccessDecision, { kind: 'authorized' }>,
): ProblemDetails {
  switch (decision.kind) {
    case 'unauthenticated':
      return createUnauthenticatedProblem(decision.reason);
    case 'forbidden_role':
      return createForbiddenProblem('role');
    case 'lab_not_found':
      return createNotFoundProblem();
    case 'forbidden_class':
      return createForbiddenProblem('class_membership');
  }
}

export function mapPublishResultToProblem(
  result: PublishResultProblem,
): ProblemDetails {
  switch (result.kind) {
    case 'lab_not_found':
      return createNotFoundProblem();
    case 'before_deadline':
      return createBeforeDeadlineProblem(result.deadline);
    case 'pending_reviews':
      return createPendingReviewsProblem(result.pendingCount);
  }
}

export function isValidLabId(labId: unknown): labId is string {
  return typeof labId === 'string' && LAB_ID_PATTERN.test(labId);
}

export function validatePublishRequestInput(input: {
  readonly labId: unknown;
  readonly body?: unknown;
}): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isValidLabId(input.labId)) {
    issues.push({
      parameter: 'labId',
      detail: 'must be 1 to 64 ASCII letters, digits, hyphens or underscores',
    });
  }

  if (input.body !== undefined) {
    const isPlainObject =
      typeof input.body === 'object' &&
      input.body !== null &&
      !Array.isArray(input.body);
    if (!isPlainObject) {
      issues.push({
        pointer: '',
        detail: 'request body must be a JSON object or empty',
      });
    }
  }

  return issues;
}

export function sendProblem(
  reply: FastifyReply,
  problem: ProblemDetails,
): FastifyReply {
  const sanitized = cloneProblemDetails(problem);
  if (sanitized.status === 401) {
    reply.header('WWW-Authenticate', 'Bearer');
  }
  return reply.code(sanitized.status).type(PROBLEM_CONTENT_TYPE).send(sanitized);
}

function isMalformedJsonError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; statusCode?: unknown };
  if (
    candidate.code === 'FST_ERR_CTP_INVALID_JSON_BODY' ||
    candidate.code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
  ) {
    return true;
  }
  return error instanceof SyntaxError && candidate.statusCode === 400;
}

// Registers RFC 9457 JSON parsing, error serialization and not-found handling on a Fastify scope.
// Preserves Fastify default secure-json-parse protection against prototype pollution.
// Never leaks stack traces, internal file paths, store internals or secrets in responses.
export function registerPublishErrorHandling(scope: FastifyInstance): void {
  const defaultParser = scope.getDefaultJsonParser('error', 'error');

  scope.removeContentTypeParser('application/json');
  scope.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      const raw = typeof body === 'string' ? body : String(body);
      if (raw.trim().length === 0) {
        done(null, undefined);
        return;
      }
      defaultParser(request, raw, (err, parsed) => {
        if (err) {
          done(new ProblemError(createInvalidJsonProblem()), undefined);
          return;
        }
        done(null, parsed);
      });
    },
  );

  scope.setErrorHandler((error, _request, reply) => {
    if (error instanceof ProblemError) {
      return sendProblem(reply, error.problem);
    }
    if (isMalformedJsonError(error)) {
      return sendProblem(reply, createInvalidJsonProblem());
    }

    const candidate = error as {
      statusCode?: unknown;
      code?: unknown;
      validation?: unknown;
      message?: unknown;
    };

    if (
      candidate.statusCode === 413 ||
      candidate.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
    ) {
      return sendProblem(reply, createPayloadTooLargeProblem());
    }

    if (
      candidate.statusCode === 415 ||
      candidate.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE'
    ) {
      return sendProblem(reply, createUnsupportedMediaTypeProblem());
    }

    if (
      candidate.code === 'FST_ERR_VALIDATION' ||
      (Array.isArray(candidate.validation) && candidate.validation.length > 0)
    ) {
      const issues: ValidationIssue[] = Array.isArray(candidate.validation)
        ? candidate.validation.map((v: any) => {
            const pointer =
              typeof v?.instancePath === 'string' && v.instancePath.length > 0
                ? v.instancePath
                : v?.params && typeof v.params.missingProperty === 'string'
                ? `/${v.params.missingProperty}`
                : '';
            return {
              pointer,
              detail:
                typeof v?.message === 'string' ? v.message : 'validation failed',
            };
          })
        : [
            {
              pointer: '',
              detail: 'One or more request parameters failed validation.',
            },
          ];
      return sendProblem(reply, createValidationProblem(issues));
    }

    if (
      typeof candidate.statusCode === 'number' &&
      candidate.statusCode >= 400 &&
      candidate.statusCode < 500
    ) {
      switch (candidate.statusCode) {
        case 400:
          return sendProblem(
            reply,
            createValidationProblem(
              [
                {
                  pointer: '',
                  detail: 'The request parameters or payload are invalid.',
                },
              ],
              'Invalid request',
            ),
          );
        case 401:
          return sendProblem(
            reply,
            createUnauthenticatedProblem('missing_credentials'),
          );
        case 403:
          return sendProblem(reply, createForbiddenProblem('role'));
        case 404:
          return sendProblem(reply, createNotFoundProblem());
        case 409:
          return sendProblem(reply, createConflictProblem());
        case 413:
          return sendProblem(reply, createPayloadTooLargeProblem());
        case 415:
          return sendProblem(reply, createUnsupportedMediaTypeProblem());
        case 422:
          return sendProblem(reply, createUnprocessableContentProblem());
        case 429:
          return sendProblem(reply, createRateLimitedProblem());
        default:
          return sendProblem(
            reply,
            createClientErrorProblem(
              candidate.statusCode as any,
              'A client error occurred processing the request.',
            ),
          );
      }
    }

    return sendProblem(reply, createInternalProblem());
  });

  scope.setNotFoundHandler((_request, reply) => {
    return sendProblem(
      reply,
      createNotFoundProblem('The requested route was not found.'),
    );
  });
}
