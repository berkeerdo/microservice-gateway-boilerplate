import { z } from 'zod';

/**
 * Environment variable validation schema using Zod
 * Gateway-specific configuration - stateless (no database)
 */
export const envSchema = z.object({
  // ============================================
  // APPLICATION
  // ============================================
  NODE_ENV: z.enum(['development', 'production', 'staging', 'test']).default('development'),
  PORT: z.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SERVICE_NAME: z.string().min(1).default('gateway-boilerplate'),
  SERVICE_VERSION: z.string().min(1),

  // ============================================
  // SECURITY
  // ============================================
  CORS_ORIGINS: z.string().optional().default(''),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().default('gateway'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.number().int().positive().default(60000),
  RATE_LIMIT_AUTH_MAX: z.number().int().positive().default(20),
  RATE_LIMIT_AUTH_WINDOW_MS: z.number().int().positive().default(60000),

  // Trust Proxy
  TRUST_PROXY: z.string().default('loopback'),

  // ============================================
  // MICROSERVICE ENDPOINTS
  // ============================================
  // Example Service - Replace with your actual services
  EXAMPLE_SERVICE_GRPC_URL: z.string().default('localhost:50051'),

  // ============================================
  // gRPC CLIENT SETTINGS
  // ============================================
  GRPC_CLIENT_TIMEOUT_MS: z.number().int().positive().default(5000),
  GRPC_CLIENT_RETRY_COUNT: z.number().int().min(0).default(3),
  GRPC_CLIENT_RETRY_DELAY_MS: z.number().int().positive().default(1000),
  GRPC_USE_TLS: z.boolean().default(false),
  GRPC_TLS_CA_PATH: z.string().optional(),
  GRPC_TLS_CLIENT_CERT_PATH: z.string().optional(),
  GRPC_TLS_CLIENT_KEY_PATH: z.string().optional(),
  GRPC_KEEPALIVE_TIME_MS: z.number().int().positive().default(10000),
  GRPC_KEEPALIVE_TIMEOUT_MS: z.number().int().positive().default(5000),

  // ============================================
  // HTTP SERVER HARDENING
  // ============================================
  // End-to-end request timeout; keep BELOW the load balancer's timeout
  REQUEST_TIMEOUT_MS: z.number().int().positive().default(30000),

  // Load shedding (@fastify/under-pressure); 0 disables a check
  BACKPRESSURE_MAX_EVENT_LOOP_DELAY: z.number().int().min(0).default(1000),
  BACKPRESSURE_MAX_HEAP_USED_BYTES: z.number().int().min(0).default(0),
  BACKPRESSURE_MAX_RSS_BYTES: z.number().int().min(0).default(0),
  BACKPRESSURE_RETRY_AFTER: z.number().int().positive().default(10),

  // ============================================
  // REDIS
  // ============================================
  REDIS_SERVER: z.string().min(1).default('localhost'),
  REDIS_PORT: z.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_ENABLED: z.boolean().default(true),

  // ============================================
  // OBSERVABILITY
  // ============================================
  OTEL_ENABLED: z.boolean().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),

  SENTRY_DSN: z.url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.number().min(0).max(1).optional(),

  // ============================================
  // COOKIE SETTINGS
  // ============================================
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.boolean().default(true),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  COOKIE_ACCESS_TOKEN_MAX_AGE: z.number().int().positive().default(900),
  COOKIE_REFRESH_TOKEN_MAX_AGE: z.number().int().positive().default(604800),

  // ============================================
  // MISC
  // ============================================
  TIMEZONE: z.string().default('+00:00'),
  SHUTDOWN_TIMEOUT_MS: z.number().int().positive().default(30000),
});

export type EnvConfig = z.infer<typeof envSchema>;
