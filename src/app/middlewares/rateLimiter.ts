import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import config from '../../config/env.js';
import logger from '../../infra/logger/logger.js';
import { getRedisClient } from '../../infra/redis/redis.js';
import { metrics } from '../../infra/monitoring/metrics.js';

interface RateLimitError {
  statusCode: number;
  error: string;
  message: string;
  retryAfter: number;
}

const RATE_LIMITS = {
  auth: { max: config.RATE_LIMIT_AUTH_MAX, timeWindow: config.RATE_LIMIT_AUTH_WINDOW_MS },
  api: { max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS },
};

function rateLimitKeyGenerator(request: FastifyRequest): string {
  const userId = (request as FastifyRequest & { userId?: string }).userId;
  if (userId) {
    return `user:${userId}`;
  }
  return (request as FastifyRequest & { correlationId?: string }).correlationId || request.ip;
}

function isRateLimitAllowed(request: FastifyRequest): boolean {
  return request.url === '/health' || request.url === '/ready' || request.url === '/';
}

function buildRateLimitErrorResponse(
  request: FastifyRequest,
  context: { max: number; ttl: number }
): RateLimitError {
  const userId = (request as FastifyRequest & { userId?: string }).userId;
  const keyType: 'user' | 'ip' | 'correlation_id' = userId
    ? 'user'
    : (request as FastifyRequest & { correlationId?: string }).correlationId
      ? 'correlation_id'
      : 'ip';

  metrics.recordRateLimitHit(keyType, request.url);

  logger.warn(
    {
      ip: request.ip,
      correlationId: (request as FastifyRequest & { correlationId?: string }).correlationId,
      max: context.max,
      remaining: 0,
      keyType,
    },
    'Rate limit exceeded'
  );

  return {
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
    retryAfter: Math.ceil(context.ttl / 1000),
  };
}

export async function registerRateLimiter(fastify: FastifyInstance): Promise<void> {
  const redisClient = getRedisClient();

  interface RateLimitOptions {
    max: number;
    timeWindow: number;
    keyGenerator: (request: FastifyRequest) => string;
    errorResponseBuilder: (request: FastifyRequest, context: { max: number; ttl: number }) => RateLimitError;
    addHeaders: Record<string, boolean>;
    allowList: (request: FastifyRequest) => boolean;
    redis?: ReturnType<typeof getRedisClient>;
  }

  const rateLimitOptions: RateLimitOptions = {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: rateLimitKeyGenerator,
    errorResponseBuilder: buildRateLimitErrorResponse,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    allowList: isRateLimitAllowed,
  };

  if (redisClient) {
    rateLimitOptions.redis = redisClient;
    logger.info('Rate limiter using Redis store (distributed)');
  } else {
    logger.warn('Rate limiter using in-memory store (not distributed)');
  }

  await fastify.register(rateLimit, rateLimitOptions);
  logger.info(
    {
      max: config.RATE_LIMIT_MAX,
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      store: redisClient ? 'redis' : 'memory',
    },
    'Rate limiter registered'
  );
}

export function getAuthRateLimitConfig(): { max: number; timeWindow: number } {
  return RATE_LIMITS.auth;
}
