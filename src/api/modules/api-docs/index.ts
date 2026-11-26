import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { createAuthOpenApi } from './auth-openapi.js';
import { addLabsOpenApi } from './labs-openapi.js';
import { addReviewOpenApi } from './review-openapi.js';
import { addSubmissionsOpenApi } from './submissions-openapi.js';

export function registerApiDocs(
  app: FastifyInstance,
  options: {
    auth: boolean;
    labs: boolean;
    submissions?: boolean;
    reviewQueue?: boolean;
    publish?: boolean;
  },
): void {
  const document = createAuthOpenApi();
  if (!options.auth) {
    document.paths = {};
    document.info.description =
      'Lab API. Authenticate with a server-issued Bearer token.';
  }
  if (options.labs) addLabsOpenApi(document);
  if (options.submissions) addSubmissionsOpenApi(document);
  if (options.reviewQueue || options.publish)
    addReviewOpenApi(document, {
      reviewQueue: Boolean(options.reviewQueue),
      publish: Boolean(options.publish),
    });
  document.info.title = 'LeeTKOB API';
  app.register(swagger, {
    mode: 'static',
    specification: { document },
  });
  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      persistAuthorization: false,
      deepLinking: true,
    },
    // No external spec validator; all UI assets are served by the local API.
    validatorUrl: false,
    staticCSP: true,
  });
}
