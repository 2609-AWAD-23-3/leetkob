import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AuthStore } from '../../../db/auth-store.js';
import type { LabStore } from '../../../db/lab-store.js';
import { normalizeLabKey } from '../../../db/lab-creation.js';
import { requireId } from '../../../db/validation.js';
import { labPhase, type Lab, type User } from '../../../shared/domain/index.js';
import { LAB_INPUT_LIMITS, LabSizeError } from '../../../shared/lab-input.js';
import {
  createSessionIdentityResolver,
  hasClassRole,
} from '../../auth/session.js';
import { registerApiErrorHandling } from '../../auth/http-errors.js';
import { ProblemError } from '../../auth/problem-details.js';
import type { ProblemDetails, ProblemSlug } from '../../auth/types.js';
import { normalizeLabPayload, readLabPayload } from './input.js';
import { registerUploadParsing } from '../../upload-parsing.js';

export interface LabsOptions {
  store: AuthStore & LabStore;
  clock?: () => Date;
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

function invalidInput(error: unknown): never {
  if (error instanceof LabSizeError || error instanceof ProblemError)
    throw error;
  if (
    error instanceof Error &&
    [
      'Unexpected end of multipart data',
      'Part terminated early due to unexpected end of multipart data',
      'Header terminated early due to unexpected end of multipart data',
    ].includes(error.message)
  )
    fail(400, 'validation', 'The multipart request is invalid or incomplete.');
  if (
    ['FST_FIELDS_LIMIT', 'FST_FILES_LIMIT', 'FST_PARTS_LIMIT'].includes(
      (error as { code?: string })?.code ?? '',
    )
  )
    fail(400, 'validation', 'Unexpected or duplicate multipart parts.');
  if (error instanceof SyntaxError)
    fail(400, 'invalid-json', 'The lab JSON is invalid.');
  if (error instanceof TypeError) fail(400, 'validation', error.message);
  throw error;
}

function detail(lab: Lab, role: User['role'], now: Date) {
  const phase = labPhase(lab, now);
  if (role === 'TA') return { ...lab, phase };
  const {
    id,
    classId,
    title,
    statement,
    opensAt,
    deadline,
    limits,
    constraints,
  } = lab;
  return {
    id,
    classId,
    title,
    statement,
    opensAt,
    deadline,
    limits,
    constraints,
    phase,
  };
}

export function createLabsModule(options: LabsOptions): FastifyPluginAsync {
  return async (scope) => {
    registerUploadParsing(scope, LAB_INPUT_LIMITS.requestBytes);
    registerApiErrorHandling(
      scope,
      'Content-Type must be application/json or multipart/form-data.',
      true,
    );
    const identity = createSessionIdentityResolver(options.store);
    const principals = new WeakMap<FastifyRequest, User>();
    const times = new WeakMap<FastifyRequest, Date>();
    const keys = new WeakMap<FastifyRequest, string>();
    const clock = options.clock ?? (() => new Date());
    scope.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const user = await identity.resolve(request.headers);
      if (!user)
        fail(
          401,
          'unauthenticated',
          'Authentication credentials are invalid or missing.',
        );
      const params = request.params as { classId?: string; labId?: string };
      try {
        requireId(params.classId ?? params.labId, 'path ID');
      } catch (error) {
        invalidInput(error);
      }
      if (
        user.role === 'admin' ||
        (request.method === 'POST' && user.role !== 'TA')
      )
        fail(403, 'forbidden', 'This role cannot access this lab operation.');
      if (
        params.classId &&
        !(await hasClassRole(
          options.store,
          user,
          params.classId,
          user.role as 'TA' | 'student',
        ))
      )
        fail(404, 'not-found', 'Class or lab not found.');
      if (request.method === 'POST') {
        try {
          keys.set(
            request,
            normalizeLabKey(request.headers['idempotency-key'] as string),
          );
        } catch (error) {
          invalidInput(error);
        }
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
      principals.set(request, user);
      if (request.method !== 'POST') times.set(request, clock());
    });
    scope.post<{ Params: { classId: string } }>(
      '/classes/:classId/labs',
      { bodyLimit: LAB_INPUT_LIMITS.requestBytes },
      async (request, reply) => {
        let input;
        try {
          input = normalizeLabPayload(
            await readLabPayload(request),
            request.params.classId,
            principals.get(request)!.id,
          );
        } catch (error) {
          reply.header('Connection', 'close');
          request.raw.resume();
          invalidInput(error);
        }
        const result = await options.store.createLabIdempotently(
          input,
          keys.get(request)!,
        );
        if (result.kind === 'conflict')
          fail(
            409,
            'conflict',
            'Idempotency-Key was already used with different lab data.',
          );
        if (result.kind === 'invalid-time')
          fail(
            400,
            'validation',
            'A new lab must have a future deadline and open before it.',
          );
        if (result.kind === 'replayed')
          reply.header('Idempotent-Replayed', 'true');
        return reply
          .code(201)
          .header('Location', `/labs/${result.lab.id}`)
          .send({ lab: detail(result.lab, 'TA', clock()) });
      },
    );
    scope.get<{ Params: { classId: string } }>(
      '/classes/:classId/labs',
      async (request) => {
        const user = principals.get(request)!;
        const now = times.get(request)!;
        const labs = await options.store.listLabSummariesForClass(
          request.params.classId,
        );
        return {
          labs: labs
            .filter(
              (lab) => user.role === 'TA' || labPhase(lab, now) !== 'draft',
            )
            .map((lab) => ({ ...lab, phase: labPhase(lab, now) })),
        };
      },
    );
    scope.get<{ Params: { labId: string } }>(
      '/labs/:labId',
      async (request) => {
        const user = principals.get(request)!;
        const now = times.get(request)!;
        const lab = await options.store.getLab(request.params.labId);
        if (
          !lab ||
          !(await hasClassRole(
            options.store,
            user,
            lab.classId,
            user.role as 'TA' | 'student',
          )) ||
          (user.role === 'student' && labPhase(lab, now) === 'draft')
        )
          fail(404, 'not-found', 'Class or lab not found.');
        return { lab: detail(lab, user.role, now) };
      },
    );
  };
}
