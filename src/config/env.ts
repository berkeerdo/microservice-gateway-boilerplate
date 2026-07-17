import dotenv from 'dotenv';
import { z } from 'zod';
import { envSchema } from './env.schema.js';
import type { EnvConfig } from './env.schema.js';
import packageJson from '../../package.json' with { type: 'json' };

dotenv.config();

const packageJsonSchema = z.object({
  version: z.string(),
  name: z.string().optional(),
});

const pkg = packageJsonSchema.parse(packageJson);

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

function parseInt(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseFloat(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

let config: EnvConfig;

try {
  config = envSchema.parse({
    // Application
    NODE_ENV: process.env.NODE_ENV,
    PORT: parseInt(process.env.PORT),
    LOG_LEVEL: process.env.LOG_LEVEL,
    SERVICE_NAME: process.env.SERVICE_NAME,
    SERVICE_VERSION: pkg.version,

    // Security
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_ISSUER: process.env.JWT_ISSUER,
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX),
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
    RATE_LIMIT_AUTH_MAX: parseInt(process.env.RATE_LIMIT_AUTH_MAX),
    RATE_LIMIT_AUTH_WINDOW_MS: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS),
    TRUST_PROXY: process.env.TRUST_PROXY,

    // Microservice Endpoints
    EXAMPLE_SERVICE_GRPC_URL: process.env.EXAMPLE_SERVICE_GRPC_URL,

    // gRPC Client Settings
    GRPC_CLIENT_TIMEOUT_MS: parseInt(process.env.GRPC_CLIENT_TIMEOUT_MS),
    GRPC_CLIENT_RETRY_COUNT: parseInt(process.env.GRPC_CLIENT_RETRY_COUNT),
    GRPC_CLIENT_RETRY_DELAY_MS: parseInt(process.env.GRPC_CLIENT_RETRY_DELAY_MS),
    GRPC_USE_TLS: parseBoolean(process.env.GRPC_USE_TLS, false),
    GRPC_TLS_CA_PATH: process.env.GRPC_TLS_CA_PATH,
    GRPC_TLS_CLIENT_CERT_PATH: process.env.GRPC_TLS_CLIENT_CERT_PATH,
    GRPC_TLS_CLIENT_KEY_PATH: process.env.GRPC_TLS_CLIENT_KEY_PATH,
    GRPC_KEEPALIVE_TIME_MS: parseInt(process.env.GRPC_KEEPALIVE_TIME_MS),
    GRPC_KEEPALIVE_TIMEOUT_MS: parseInt(process.env.GRPC_KEEPALIVE_TIMEOUT_MS),

    // HTTP Server Hardening
    REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS),
    BACKPRESSURE_MAX_EVENT_LOOP_DELAY: parseInt(process.env.BACKPRESSURE_MAX_EVENT_LOOP_DELAY),
    BACKPRESSURE_MAX_HEAP_USED_BYTES: parseInt(process.env.BACKPRESSURE_MAX_HEAP_USED_BYTES),
    BACKPRESSURE_MAX_RSS_BYTES: parseInt(process.env.BACKPRESSURE_MAX_RSS_BYTES),
    BACKPRESSURE_RETRY_AFTER: parseInt(process.env.BACKPRESSURE_RETRY_AFTER),

    // Redis
    REDIS_SERVER: process.env.REDIS_SERVER,
    REDIS_PORT: parseInt(process.env.REDIS_PORT),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_ENABLED: parseBoolean(process.env.REDIS_ENABLED, true),

    // Observability
    OTEL_ENABLED: parseBoolean(process.env.OTEL_ENABLED, false),
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE),

    // Cookie Settings
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
    COOKIE_SECURE: parseBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
    COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none' | undefined,
    COOKIE_ACCESS_TOKEN_MAX_AGE: parseInt(process.env.COOKIE_ACCESS_TOKEN_MAX_AGE),
    COOKIE_REFRESH_TOKEN_MAX_AGE: parseInt(process.env.COOKIE_REFRESH_TOKEN_MAX_AGE),

    // Misc
    TIMEZONE: process.env.TIMEZONE,
    SHUTDOWN_TIMEOUT_MS: parseInt(process.env.SHUTDOWN_TIMEOUT_MS),
  });
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Environment validation failed:', error);
  process.exit(1);
}

export default config;
export type { EnvConfig };
