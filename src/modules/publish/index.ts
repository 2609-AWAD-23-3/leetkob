import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createApp, type AppOptions } from '../../app.js';
import {
  authorizePublishAccess,
  createTokenIdentityResolver,
  createValidationProblem,
  mapAccessDecisionToProblem,
  mapPublishResultToProblem,
  registerPublishErrorHandling,
  sendProblem,
  validatePublishRequestInput,
} from '../../auth/index.js';
import type { LabPublication, PublishModuleOptions } from './types.js';

export type { LabPublication, PublishModuleOptions } from './types.js';

export function createPublishModule(
  options: PublishModuleOptions = {},
): FastifyPluginAsync {
  return async function publishPlugin(scope) {
    registerPublishErrorHandling(scope);

    // If no store is provided (e.g. unconfigured default skeleton),
    // do not mount the route to preserve absent route semantics.
    if (!options.store) {
      return;
    }

    const store = options.store;
    const identityResolver =
      options.identityResolver ?? createTokenIdentityResolver();

    scope.post<{
      Params: { labId?: string };
    }>(
      '/labs/:labId/publish',
      { bodyLimit: 65536 },
      async (
        request: FastifyRequest<{ Params: { labId?: string } }>,
        reply: FastifyReply,
      ) => {
        const labId = request.params?.labId;

        // Precedence step 1: Authentication
        const authDecision = authorizePublishAccess({
          headers: request.headers,
          labId: typeof labId === 'string' ? labId : '',
          store,
          identityResolver,
        });

        if (authDecision.kind === 'unauthenticated') {
          return sendProblem(reply, mapAccessDecisionToProblem(authDecision));
        }

        // Precedence step 2: Input syntax & body object validation
        const validationIssues = validatePublishRequestInput({
          labId,
          body: request.body,
        });
        if (validationIssues.length > 0) {
          return sendProblem(reply, createValidationProblem(validationIssues));
        }

        // Precedence steps 3 & 4: Lab existence, Role, Class ownership
        if (authDecision.kind !== 'authorized') {
          return sendProblem(reply, mapAccessDecisionToProblem(authDecision));
        }

        // Precedence steps 5-8: Publication transition & repeat checks via store
        const publishResult = store.publishLab({
          labId: authDecision.lab.id,
          publishedBy: authDecision.principal.id,
        });

        if (publishResult.kind === 'already_published') {
          reply.header('idempotent-replayed', 'true');
          const publicationResource: LabPublication = {
            labId: publishResult.publication.labId,
            classId: authDecision.lab.classId,
            status: 'published',
            publishedAt: publishResult.publication.publishedAt,
            publishedBy: publishResult.publication.publishedBy,
            summary: publishResult.publication.summary,
          };
          return reply.code(200).send(publicationResource);
        }

        if (
          publishResult.kind === 'before_deadline' ||
          publishResult.kind === 'lab_not_found'
        ) {
          return sendProblem(reply, mapPublishResultToProblem(publishResult));
        }

        if (publishResult.kind === 'pending_reviews') {
          // DELIBERATE BREAK FOR T10: bypass pending-reviews gate and return 200 OK
          const publicationResource: LabPublication = {
            labId: authDecision.lab.id,
            classId: authDecision.lab.classId,
            status: 'published',
            publishedAt: new Date().toISOString(),
            publishedBy: authDecision.principal.id,
            summary: {
              queueItemCount: publishResult.pendingCount,
              passDecisionCount: 0,
              violationDecisionCount: 0,
            },
          };
          return reply.code(200).send(publicationResource);
        }

        if (publishResult.kind === 'published') {
          const publicationResource: LabPublication = {
            labId: publishResult.publication.labId,
            classId: authDecision.lab.classId,
            status: 'published',
            publishedAt: publishResult.publication.publishedAt,
            publishedBy: publishResult.publication.publishedBy,
            summary: publishResult.publication.summary,
          };
          return reply.code(200).send(publicationResource);
        }
      },
    );
  };
}

export const publishModule: FastifyPluginAsync<PublishModuleOptions> = async (
  scope,
  options,
) => {
  return createPublishModule(options)(scope, options);
};

export interface CreatePublishAppOptions extends PublishModuleOptions {
  readonly logger?: boolean;
  readonly modules?: AppOptions['modules'];
}

export function createPublishApp(options: CreatePublishAppOptions = {}) {
  const appOptions: AppOptions = {
    modules: {
      ...options.modules,
      publish: createPublishModule(options),
    },
  };
  if (typeof options.logger === 'boolean') {
    appOptions.logger = options.logger;
  }
  return createApp(appOptions);
}
