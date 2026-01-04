import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HealthService } from '../../infra/health/HealthService.js';
import { metrics } from '../../infra/monitoring/metrics.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Liveness probe - is the process running?
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        response: {
          200: {
            type: 'object',
            properties: {
              alive: { type: 'boolean' },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(HealthService.liveness());
    }
  );

  // Readiness probe - can we accept traffic?
  fastify.get(
    '/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        response: {
          200: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              checks: { type: 'object' },
            },
          },
          503: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              checks: { type: 'object' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await HealthService.readiness();
      const statusCode = result.ready ? 200 : 503;
      return reply.status(statusCode).send(result);
    }
  );

  // Full health check with component details
  fastify.get(
    '/status',
    {
      schema: {
        tags: ['Health'],
        summary: 'Full health status',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
              timestamp: { type: 'string' },
              service: { type: 'string' },
              version: { type: 'string' },
              uptime: { type: 'number' },
              components: { type: 'object' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await HealthService.check();
      return reply.send(result);
    }
  );

  // Prometheus metrics endpoint
  fastify.get(
    '/metrics',
    {
      schema: {
        tags: ['Health'],
        summary: 'Prometheus metrics',
        produces: ['text/plain'],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const metricsData = await metrics.getMetrics();
      return reply.header('Content-Type', metrics.contentType).send(metricsData);
    }
  );
}
