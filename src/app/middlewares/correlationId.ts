import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id' as const;
export const REQUEST_ID_HEADER = 'x-request-id' as const;

function extractIdFromHeaders(headers: FastifyRequest['headers']): string | undefined {
  const correlationId = headers['x-correlation-id'];
  const requestId = headers['x-request-id'];

  if (typeof correlationId === 'string' && correlationId) {
    return correlationId;
  }
  if (typeof requestId === 'string' && requestId) {
    return requestId;
  }
  return undefined;
}

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    requestId: string;
  }
}

export function registerCorrelationId(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    const correlationId = extractIdFromHeaders(request.headers) ?? randomUUID();
    const requestId = randomUUID();

    request.correlationId = correlationId;
    request.requestId = requestId;
    request.id = requestId;

    void reply.header(CORRELATION_ID_HEADER, correlationId);
    void reply.header(REQUEST_ID_HEADER, requestId);

    done();
  });

  fastify.addHook('preHandler', (request: FastifyRequest, _reply: FastifyReply, done) => {
    request.log = request.log.child({
      correlationId: request.correlationId,
      requestId: request.requestId,
    });
    done();
  });
}

export function getCorrelationId(request: FastifyRequest): string {
  return request.correlationId;
}

export function getRequestId(request: FastifyRequest): string {
  return request.requestId;
}
