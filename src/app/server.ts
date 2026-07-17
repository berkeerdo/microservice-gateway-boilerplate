import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import Fastify from 'fastify';
import helmet, { type FastifyHelmetOptions } from '@fastify/helmet';
import cors, { type FastifyCorsOptions } from '@fastify/cors';
import cookie from '@fastify/cookie';
import underPressure from '@fastify/under-pressure';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { stdTimeFunctions } from 'pino';
import config from '../config/env.js';
import { errorHandler, notFoundHandler } from '../shared/errors/errorHandler.js';
import { registerRoutes } from './routes/index.js';
import {
  registerCorrelationId,
  registerRateLimiter,
  registerRequestLogger,
  registerRequestMetrics,
  registerGrpcAuth,
} from './middlewares/index.js';
import { registerSwagger } from './plugins/index.js';
import { gracefulShutdown } from '../infra/shutdown/gracefulShutdown.js';
import logger from '../infra/logger/logger.js';

function parseTrustProxy(value: string): boolean | number | string | string[] {
  const trimmed = value.trim().toLowerCase();

  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === 'true') {
    return true;
  }

  if (['loopback', 'linklocal', 'uniquelocal'].includes(trimmed)) {
    return trimmed;
  }

  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 0) {
    return num;
  }

  return value.includes(',') ? value.split(',').map((ip) => ip.trim()) : value.trim();
}

function createLoggerConfig(
  isDevelopment: boolean,
  isTest: boolean
): FastifyServerOptions['logger'] {
  if (isTest) {
    return false;
  }

  if (isDevelopment) {
    return {
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    };
  }

  return {
    level: config.LOG_LEVEL,
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
    base: { service: config.SERVICE_NAME, version: config.SERVICE_VERSION },
  };
}

function getHelmetConfig(isDevelopment: boolean): FastifyHelmetOptions {
  return {
    hsts: isDevelopment ? false : { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: isDevelopment ? null : [],
      },
    },
    frameguard: { action: 'deny' as const },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
    xssFilter: true,
    ieNoOpen: true,
    dnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' as const },
  };
}

function getAllowedOrigins(isDevelopment: boolean): string[] {
  const corsOrigins =
    config.CORS_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) || [];

  const developmentOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

  return isDevelopment ? (corsOrigins.length > 0 ? corsOrigins : developmentOrigins) : corsOrigins;
}

function getCorsConfig(allowedOrigins: string[]): FastifyCorsOptions {
  return {
    origin:
      allowedOrigins.length > 0
        ? (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              logger.warn({ origin }, 'CORS blocked request from unauthorized origin');
              callback(new Error('CORS: Origin not allowed'), false);
            }
          }
        : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
      'Accept-Language',
      'X-Language',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-Correlation-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 3600,
    optionsSuccessStatus: 204,
    preflightContinue: false,
  };
}

async function registerSecurityPlugins(
  fastify: FastifyInstance,
  isDevelopment: boolean
): Promise<void> {
  await fastify.register(helmet, getHelmetConfig(isDevelopment));

  const allowedOrigins = getAllowedOrigins(isDevelopment);
  if (!isDevelopment && allowedOrigins.length === 0) {
    logger.warn('CORS_ORIGINS is not set - CORS will reject all cross-origin requests');
  }

  await fastify.register(cors, getCorsConfig(allowedOrigins));
  await fastify.register(cookie, {
    parseOptions: {
      domain: config.COOKIE_DOMAIN,
      secure: config.COOKIE_SECURE,
      sameSite: config.COOKIE_SAME_SITE,
      httpOnly: true,
      path: '/',
    },
  });
}

async function registerMiddlewares(fastify: FastifyInstance): Promise<void> {
  registerCorrelationId(fastify);
  registerRequestLogger(fastify);
  registerRequestMetrics(fastify);
  await registerRateLimiter(fastify);
  await registerGrpcAuth(fastify);
}

export async function createServer(): Promise<FastifyInstance> {
  const isDevelopment = config.NODE_ENV === 'development';
  const isTest = config.NODE_ENV === 'test';

  const fastify = Fastify({
    logger: createLoggerConfig(isDevelopment, isTest),
    bodyLimit: 1048576, // 1MB
    trustProxy: parseTrustProxy(config.TRUST_PROXY),
    // Bound slow clients and upstream stalls. Fastify's keepAliveTimeout
    // default (72s) is deliberately above common LB idle timeouts (60s) -
    // keep app keep-alive ABOVE the LB's, and requestTimeout BELOW it.
    requestTimeout: config.REQUEST_TIMEOUT_MS,
    connectionTimeout: 0,
  });

  // Zod-powered validation and serialization (fastify-type-provider-zod)
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Load shedding: reply 503 + Retry-After when the event loop or memory
  // is saturated, instead of queueing requests until everything times out
  await fastify.register(underPressure, {
    maxEventLoopDelay: config.BACKPRESSURE_MAX_EVENT_LOOP_DELAY,
    maxHeapUsedBytes: config.BACKPRESSURE_MAX_HEAP_USED_BYTES,
    maxRssBytes: config.BACKPRESSURE_MAX_RSS_BYTES,
    message: 'Service overloaded, retry shortly',
    retryAfter: config.BACKPRESSURE_RETRY_AFTER,
  });

  await registerSecurityPlugins(fastify, isDevelopment);
  await registerMiddlewares(fastify);
  await registerSwagger(fastify);

  registerRoutes(fastify);
  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);
  gracefulShutdown.registerFastify(fastify);

  logger.info(
    { service: config.SERVICE_NAME, version: config.SERVICE_VERSION, env: config.NODE_ENV },
    'Server configured'
  );

  return fastify;
}
