import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { createAuthOpenApi } from './auth-openapi.js';

export function registerApiDocs(app: FastifyInstance): void {
  app.register(swagger, {
    mode: 'static',
    specification: { document: createAuthOpenApi() },
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
