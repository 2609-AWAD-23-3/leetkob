import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AuthStore } from '../../../db/auth-store.js';
import type { LabStore } from '../../../db/lab-store.js';
import type { SubmissionStore } from '../../../db/submission-store.js';
import { normalizeLabKey } from '../../../db/lab-creation.js';
import { requireId } from '../../../db/validation.js';
import {
  labPhase,
  type Submission,
  type User,
} from '../../../shared/domain/index.js';
import { LabSizeError } from '../../../shared/lab-input.js';
import {
  SUBMISSION_BODY_BYTES,
  SUBMISSION_NOTICE,
} from '../../../shared/submission-input.js';
import {
  createSessionIdentityResolver,
  hasClassRole,
} from '../../auth/session.js';
import { registerApiErrorHandling } from '../../auth/http-errors.js';
import { ProblemError } from '../../auth/problem-details.js';
import type { ProblemDetails, ProblemSlug } from '../../auth/types.js';
import { registerUploadParsing } from '../../upload-parsing.js';
import { readSubmissionCode } from './input.js';
import { submissionQuery, encodeSubmissionCursor } from './pagination.js';
import { SubmissionLimiter } from './limiter.js';

export interface SubmissionsOptions {
  store: AuthStore & LabStore & SubmissionStore;
  clock?: () => Date;
  limiter?: SubmissionLimiter;
}
function fail(
  status: ProblemDetails['status'],
  slug: ProblemSlug,
  detail: string,
): never {
  throw new ProblemError({
    type: `https://leetkob.example/problems/${slug}`,
    title: detail,
    status,
    detail,
  });
}
function inputError(error: unknown): never {
  if (error instanceof LabSizeError || error instanceof ProblemError)
    throw error;
  if (
    ['FST_FIELDS_LIMIT', 'FST_FILES_LIMIT', 'FST_PARTS_LIMIT'].includes(
      (error as { code?: string })?.code ?? '',
    )
  )
    fail(400, 'validation', 'Exactly one codeFile file is required.');
  if (error instanceof TypeError || error instanceof SyntaxError)
    fail(400, 'validation', 'The submission request is invalid.');
  throw error;
}
function dto(s: Submission): Submission {
  return {
    id: s.id,
    labId: s.labId,
    studentId: s.studentId,
    code: s.code,
    submittedAt: s.submittedAt,
    status: s.status,
    judgeResult: s.judgeResult
      ? {
          verdict: s.judgeResult.verdict,
          tests: s.judgeResult.tests.map(({ testId, verdict }) => ({
            testId,
            verdict,
          })),
        }
      : null,
  };
}

// T04 owns HTTP intake/reads. T06 owns execution, leasing, retries and results.
export function createSubmissionsModule(
  options: SubmissionsOptions,
): FastifyPluginAsync {
  return async (scope) => {
    registerUploadParsing(scope, SUBMISSION_BODY_BYTES);
    registerApiErrorHandling(
      scope,
      'Content-Type must be application/json or multipart/form-data.',
      true,
      'Too many submission requests.',
    );
    const clock = options.clock ?? (() => new Date());
    const limiter =
      options.limiter ?? new SubmissionLimiter(() => clock().getTime());
    const identity = createSessionIdentityResolver(options.store);
    const users = new WeakMap<FastifyRequest, User>();
    const keys = new WeakMap<FastifyRequest, string>();
    const details = new WeakMap<FastifyRequest, Submission>();
    scope.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const user = await identity.resolve(request.headers);
      if (!user)
        fail(
          401,
          'unauthenticated',
          'Authentication credentials are invalid or missing.',
        );
      const params = request.params as {
        labId?: string;
        submissionId?: string;
      };
      try {
        requireId(params.labId ?? params.submissionId, 'path ID');
      } catch (error) {
        inputError(error);
      }
      const mine = request.routeOptions.url?.endsWith('/mine');
      const allowed = params.submissionId
        ? ['TA', 'student']
        : request.method === 'POST' || mine
          ? ['student']
          : ['TA'];
      if (!allowed.includes(user.role))
        fail(
          403,
          'forbidden',
          'This role cannot access this submission operation.',
        );
      let labId = params.labId;
      if (params.submissionId) {
        const submission = await options.store.getSubmission(
          params.submissionId,
        );
        if (
          !submission ||
          (user.role === 'student' && submission.studentId !== user.id)
        )
          fail(404, 'not-found', 'Lab or submission not found.');
        details.set(request, submission);
        labId = submission.labId;
      }
      const lab = await options.store.getLabSummary(labId!);
      if (
        !lab ||
        !(await hasClassRole(
          options.store,
          user,
          lab.classId,
          user.role as 'TA' | 'student',
        )) ||
        (user.role === 'student' && labPhase(lab, clock()) === 'draft')
      )
        fail(404, 'not-found', 'Lab or submission not found.');
      if (request.method === 'POST') {
        try {
          keys.set(
            request,
            normalizeLabKey(request.headers['idempotency-key'] as string),
          );
        } catch (error) {
          inputError(error);
        }
        limiter.request(user.id);
        const type = request.headers['content-type']
          ?.split(';', 1)[0]
          ?.trim()
          .toLowerCase();
        if (type !== 'application/json' && type !== 'multipart/form-data')
          fail(
            415,
            'unsupported-media-type',
            'Content-Type must be application/json or multipart/form-data.',
          );
      }
      users.set(request, user);
    });
    scope.post<{ Params: { labId: string } }>(
      '/labs/:labId/submissions',
      { bodyLimit: SUBMISSION_BODY_BYTES },
      async (request, reply) => {
        let code: string;
        try {
          code = await readSubmissionCode(request);
        } catch (error) {
          reply.header('Connection', 'close');
          request.raw.resume();
          inputError(error);
        }
        const result = await options.store.submitIdempotently(
          {
            labId: request.params.labId,
            studentId: users.get(request)!.id,
            code,
          },
          keys.get(request)!,
        );
        if (result.kind === 'not-found')
          fail(404, 'not-found', 'Lab or submission not found.');
        if (result.kind === 'not-open')
          fail(409, 'conflict', 'The lab is not accepting new submissions.');
        if (result.kind === 'conflict')
          fail(
            409,
            'conflict',
            'Idempotency-Key was already used with different code.',
          );
        if (result.kind === 'replayed')
          reply.header('Idempotent-Replayed', 'true');
        return reply
          .code(201)
          .header('Location', `/submissions/${result.submission.id}`)
          .send({
            submission: dto(result.submission),
            notice: SUBMISSION_NOTICE,
          });
      },
    );
    const list = async (
      request: FastifyRequest<{ Params: { labId: string } }>,
      mine: boolean,
    ) => {
      let query;
      try {
        query = submissionQuery(
          request.query,
          request.params.labId,
          mine ? users.get(request)!.id : undefined,
        );
      } catch (error) {
        inputError(error);
      }
      const page = await options.store.listSubmissionSummaries(query);
      return {
        submissions: page.submissions,
        nextCursor: encodeSubmissionCursor(query, page.next ?? undefined),
      };
    };
    scope.get<{ Params: { labId: string } }>(
      '/labs/:labId/submissions/mine',
      (request) => list(request, true),
    );
    scope.get<{ Params: { labId: string } }>(
      '/labs/:labId/submissions',
      (request) => list(request, false),
    );
    scope.get('/submissions/:submissionId', async (request) => ({
      submission: dto(details.get(request)!),
    }));
  };
}

// Preserve the PA02 app composition seam: no implicit runtime Store or routes.
export const submissionsModule: FastifyPluginAsync = async () => {};
