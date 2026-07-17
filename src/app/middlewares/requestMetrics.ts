/**
 * HTTP metrics middleware
 *
 * Feeds the Prometheus recorders in infra/monitoring/metrics.ts:
 * request count + duration per method/route/status, and an active-requests
 * gauge. Without these hooks /metrics would only expose process defaults.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { metrics } from '../../infra/monitoring/metrics.js';

const METRICS_EXEMPT_PATHS = new Set(['/metrics']);

export function registerRequestMetrics(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done) => {
    if (!METRICS_EXEMPT_PATHS.has(request.url)) {
      metrics.incrementActiveRequests();
    }
    done();
  });

  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    if (!METRICS_EXEMPT_PATHS.has(request.url)) {
      metrics.decrementActiveRequests();
      // routeOptions.url is the route pattern (/examples/:id), not the raw URL,
      // which keeps metric label cardinality bounded
      const route = request.routeOptions?.url ?? request.url;
      metrics.recordHttpRequest(request.method, route, reply.statusCode, reply.elapsedTime);
    }
    done();
  });
}
