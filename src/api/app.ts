import Fastify from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import { submissionsModule } from './modules/submissions/index.js';
import { reviewQueueModule } from './modules/review-queue/index.js';
import { publishModule } from './modules/publish/index.js';

export interface AppModules {
  submissions: FastifyPluginAsync;
  reviewQueue: FastifyPluginAsync;
  publish: FastifyPluginAsync;
}

export interface AppOptions {
  logger?: boolean;
  modules?: Partial<AppModules>;
}

// Construction only: caller owns ready/listen/close. Importing never opens a socket.
// Module replacement is a programmatic composition seam, never an HTTP option.
export function createApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(options.modules?.submissions ?? submissionsModule);
  app.register(options.modules?.reviewQueue ?? reviewQueueModule);
  app.register(options.modules?.publish ?? publishModule);

  return app;
}
