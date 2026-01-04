import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import config from '../../config/env.js';
import logger from '../../infra/logger/logger.js';

export async function registerSwagger(fastify: FastifyInstance): Promise<void> {
  // Skip Swagger in production for security
  if (config.NODE_ENV === 'production') {
    logger.info('Swagger disabled in production');
    return;
  }

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: config.SERVICE_NAME,
        description: 'API Gateway - Routes requests to microservices via gRPC',
        version: config.SERVICE_VERSION,
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'access_token',
          },
        },
      },
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Example', description: 'Example service endpoints' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  logger.info(`Swagger UI available at http://localhost:${config.PORT}/docs`);
}
