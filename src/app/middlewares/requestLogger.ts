import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../infra/logger/logger.js';

const SKIP_PATHS = ['/health', '/ready', '/metrics', '/'];

function shouldSkipLogging(url: string): boolean {
  return SKIP_PATHS.some((path) => url === path || url.startsWith(path + '?'));
}

function getLogLevel(statusCode: number): 'info' | 'warn' | 'error' {
  if (statusCode >= 500) {
    return 'error';
  }
  if (statusCode >= 400) {
    return 'warn';
  }
  return 'info';
}

export function registerRequestLogger(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done) => {
    if (!shouldSkipLogging(request.url)) {
      logger.info(
        {
          correlationId: request.correlationId,
          method: request.method,
          url: request.url,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        },
        'Incoming request'
      );
    }
    done();
  });

  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    if (!shouldSkipLogging(request.url)) {
      const level = getLogLevel(reply.statusCode);
      logger[level](
        {
          correlationId: request.correlationId,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          elapsedMs: reply.elapsedTime,
        },
        'Request completed'
      );
    }
    done();
  });
}
