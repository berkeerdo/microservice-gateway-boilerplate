/**
 * Redis Client for Gateway
 * Used for distributed rate limiting and caching
 */
import { Redis } from 'ioredis';
import config from '../../config/env.js';
import logger from '../logger/logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!config.REDIS_ENABLED) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    host: config.REDIS_SERVER,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    db: 0,
    keyPrefix: 'gateway:',
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    keepAlive: 30000,
    noDelay: true,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('Redis max retries reached, giving up');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    maxRetriesPerRequest: 3,
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    },
    enableOfflineQueue: true,
  });

  redisClient.on('connect', () => {
    logger.info('Gateway Redis connected');
  });

  redisClient.on('ready', () => {
    logger.info('Gateway Redis ready');
  });

  redisClient.on('error', (err: Error) => {
    logger.error({ err }, 'Gateway Redis error');
  });

  redisClient.on('close', () => {
    logger.warn('Gateway Redis connection closed');
  });

  return redisClient;
}

export async function initializeRedis(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    logger.info('Redis is disabled, skipping initialization');
    return false;
  }

  try {
    await client.connect();
    logger.info('Gateway Redis initialized');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Gateway Redis');
    return false;
  }
}

export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  message?: string;
}> {
  const client = getRedisClient();
  if (!client) {
    return { healthy: true, message: 'Redis disabled' };
  }

  try {
    const start = Date.now();
    await client.ping();
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { healthy: false, message: (error as Error).message };
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Gateway Redis connection closed');
    } catch (error) {
      logger.error({ err: error }, 'Error closing Gateway Redis');
    }
  }
}
