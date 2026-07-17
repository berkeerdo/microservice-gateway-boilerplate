import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { HealthService } from '../../infra/health/HealthService.js';
import { metrics } from '../../infra/monitoring/metrics.js';

const livenessSchema = z.object({
  alive: z.boolean(),
  uptime: z.number(),
});

const readinessSchema = z.object({
  ready: z.boolean(),
  checks: z.record(z.string(), z.boolean()),
});

const statusSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string(),
  service: z.string(),
  version: z.string(),
  uptime: z.number(),
  components: z.record(z.string(), z.unknown()),
});

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Liveness probe - process only, NEVER checks dependencies
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        response: { 200: livenessSchema },
      },
    },
    async (_request, reply) => {
      return reply.send(HealthService.liveness());
    }
  );

  // Readiness probe - dependency checks gate traffic
  app.get(
    '/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        response: { 200: readinessSchema, 503: readinessSchema },
      },
    },
    async (_request, reply) => {
      const result = await HealthService.readiness();
      const statusCode = result.ready ? 200 : 503;
      return reply.status(statusCode).send(result);
    }
  );

  // Full health check with component details
  app.get(
    '/status',
    {
      schema: {
        tags: ['Health'],
        summary: 'Full health status',
        response: { 200: statusSchema },
      },
    },
    async (_request, reply) => {
      const result = await HealthService.check();
      return reply.send(result);
    }
  );

  // Prometheus metrics endpoint (text/plain, no schema)
  fastify.get(
    '/metrics',
    {
      schema: {
        tags: ['Health'],
        summary: 'Prometheus metrics',
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const metricsData = await metrics.getMetrics();
      return reply.header('Content-Type', metrics.contentType).send(metricsData);
    }
  );
}
