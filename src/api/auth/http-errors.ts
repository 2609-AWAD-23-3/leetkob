import type { FastifyInstance } from 'fastify';
import { PasswordBusyError } from '../../shared/passwords.js';
import { LabSizeError } from '../../shared/lab-input.js';
import { ProblemError, sendProblem } from './problem-details.js';
import type { ProblemDetails, ProblemSlug } from './types.js';
import { AuthLimitError } from './rate-limit.js';
function isDatabaseUnavailable(error: unknown): boolean {
  if (
    error instanceof Error &&
    [
      'Connection terminated unexpectedly',
      'Connection terminated due to connection timeout',
      'timeout exceeded when trying to connect',
    ].includes(error.message)
  )
    return true;
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === 'string' &&
    (code.startsWith('08') ||
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EPIPE',
        'ENOTFOUND',
        '57P01',
        '57P02',
        '57P03',
        '53300',
      ].includes(code))
  );
}

export function registerApiErrorHandling(
  scope: FastifyInstance,
  unsupportedMediaTypeDetail = 'Content-Type must be application/json.',
  multipartErrors = false,
  rateLimitDetail = 'Too many authentication attempts.',
): void {
  scope.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number } | null)?.statusCode;
    if (error instanceof ProblemError) return sendProblem(reply, error.problem);
    let status: ProblemDetails['status'] = 500;
    let slug: ProblemSlug = 'internal';
    let detail = 'An internal error occurred.';
    if (error instanceof AuthLimitError) {
      status = error.status;
      slug = status === 429 ? 'rate-limited' : 'internal';
      detail =
        status === 429 ? rateLimitDetail : 'Service temporarily unavailable.';
      reply.header('Retry-After', error.retryAfter);
    } else if (
      error instanceof PasswordBusyError ||
      isDatabaseUnavailable(error)
    ) {
      status = 503;
      detail = 'Service temporarily unavailable.';
      if (error instanceof PasswordBusyError) reply.header('Retry-After', 1);
    } else if (error instanceof LabSizeError || statusCode === 413) {
      status = 413;
      slug = 'payload-too-large';
      detail = 'Request body is too large.';
    } else if (statusCode === 415) {
      status = 415;
      slug = 'unsupported-media-type';
      detail = unsupportedMediaTypeDetail;
    } else if (
      multipartErrors &&
      error instanceof Error &&
      [
        'Unexpected end of multipart data',
        'Part terminated early due to unexpected end of multipart data',
        'Header terminated early due to unexpected end of multipart data',
        'Multipart: Boundary not found',
      ].includes(error.message)
    ) {
      status = 400;
      slug = 'validation';
      detail = 'The multipart request is invalid or incomplete.';
    } else if (
      statusCode === 400 ||
      error instanceof SyntaxError ||
      (error as { code?: string })?.code === 'FST_INVALID_JSON_FIELD_ERROR'
    ) {
      status = 400;
      slug = 'invalid-json';
      detail = 'The request body is not valid JSON.';
    }
    return sendProblem(reply, {
      type: `https://leetkob.example/problems/${slug}`,
      title: detail,
      status,
      detail,
    });
  });
}
