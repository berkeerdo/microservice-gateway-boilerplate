import type { Redis } from 'ioredis';
import type { FastifyRateLimitOptions } from '@fastify/rate-limit';

declare module '@fastify/rate-limit' {
  export interface RateLimitOptionsWithRedis extends FastifyRateLimitOptions {
    redis?: Redis | null;
  }
}

export interface RateLimitOptionsWithRedis extends FastifyRateLimitOptions {
  redis?: Redis | null;
}
