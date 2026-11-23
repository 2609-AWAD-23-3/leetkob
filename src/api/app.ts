import Fastify from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import {
  submissionsModule,
  createSubmissionsModule,
  type SubmissionsOptions,
} from './modules/submissions/index.js';
import {
  createReviewQueueModule,
  reviewQueueModule,
  type ReviewQueueOptions,
} from './modules/review-queue/index.js';
import {
  createPublishModule,
  publishModule,
  type PublishModuleOptions,
} from './modules/publish/index.js';
import { createAuthModule, type AuthOptions } from './modules/auth/index.js';
import { registerApiDocs } from './modules/api-docs/index.js';
import { createLabsModule, type LabsOptions } from './modules/labs/index.js';

export interface AppModules {
  submissions: FastifyPluginAsync;
  reviewQueue: FastifyPluginAsync;
  publish: FastifyPluginAsync;
}

export interface AppOptions {
  submissions?: SubmissionsOptions;
  labs?: LabsOptions;
  auth?: AuthOptions;
  reviewQueue?: ReviewQueueOptions;
  publish?: PublishModuleOptions;
  logger?: boolean;
  trustProxy?: false | string | readonly string[] | undefined;
  modules?: Partial<AppModules>;
}

// Construction only: caller owns ready/listen/close. Importing never opens a socket.
// Module replacement is a programmatic composition seam, never an HTTP option.
export function createApp(options: AppOptions = {}) {
  const trustProxy =
    options.trustProxy === undefined || options.trustProxy === false
      ? false
      : typeof options.trustProxy === 'string'
        ? options.trustProxy
        : [...options.trustProxy];
  const app = Fastify({
    logger: options.logger
      ? {
          redact: [
            'req.headers.authorization',
            'req.body',
            'res.headers["set-cookie"]',
          ],
        }
      : false,
    trustProxy,
  });

  app.get('/health', async () => ({ status: 'ok' }));
  if (options.submissions && options.modules?.submissions)
    throw new TypeError('Choose submissions dependencies or a module override');
  if (options.reviewQueue && options.modules?.reviewQueue)
    throw new TypeError(
      'Choose review queue dependencies or a module override',
    );
  if (options.publish && options.modules?.publish)
    throw new TypeError('Choose publish dependencies or a module override');
  if (
    options.auth ||
    options.labs ||
    options.submissions ||
    options.reviewQueue ||
    options.publish
  )
    registerApiDocs(app, {
      auth: Boolean(options.auth),
      labs: Boolean(options.labs),
      submissions: Boolean(options.submissions),
      reviewQueue: Boolean(options.reviewQueue),
      publish: Boolean(options.publish),
    });
  if (options.auth) app.register(createAuthModule(options.auth));
  if (options.labs) app.register(createLabsModule(options.labs));

  app.register(
    options.modules?.submissions ??
      (options.submissions
        ? createSubmissionsModule(options.submissions)
        : submissionsModule),
  );
  app.register(
    options.modules?.reviewQueue ??
      (options.reviewQueue
        ? createReviewQueueModule(options.reviewQueue)
        : reviewQueueModule),
  );
  app.register(
    options.modules?.publish ??
      (options.publish ? createPublishModule(options.publish) : publishModule),
  );

  return app;
}
