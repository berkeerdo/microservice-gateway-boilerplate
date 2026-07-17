/**
 * Gateway Boilerplate
 * Production-ready API Gateway with Fastify and gRPC
 */

// Observability bootstrap: normally preloaded via `node --import ./dist/instrumentation.js`.
// Importing it first here is a fallback so Sentry/OTel still initialize (with reduced
// ESM auto-instrumentation coverage) if the process is started without the preload flag.
import { shutdownTracing } from './instrumentation.js';

// Application imports
import { createServer } from './app/server.js';
import {
  registerDependencies,
  initializeServiceProxies,
  closeServiceProxies,
} from './container.js';
import config from './config/env.js';
import logger from './infra/logger/logger.js';
import { gracefulShutdown } from './infra/shutdown/gracefulShutdown.js';
import { flushSentry, closeSentry } from './infra/monitoring/sentry.js';
import { initializeRedis, closeRedis } from './infra/redis/redis.js';

function logStartup(): void {
  logger.info(
    {
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      env: config.NODE_ENV,
      nodeVersion: process.version,
    },
    'Starting Gateway service...'
  );
}

function registerShutdownHandlers(): void {
  gracefulShutdown.register('opentelemetry', () => shutdownTracing());
  gracefulShutdown.register('sentry', async () => {
    await flushSentry();
    await closeSentry();
  });
}

async function initializeInfrastructure(): Promise<void> {
  // Sentry + OpenTelemetry are already initialized in the instrumentation.ts preload
  gracefulShutdown.setupSignalHandlers();
  registerShutdownHandlers();
  await initializeRedis();
  gracefulShutdown.register('redis', closeRedis);
}

function initializeServices(): void {
  registerDependencies();
  initializeServiceProxies();
  gracefulShutdown.register('service-proxies', () => {
    closeServiceProxies();
    return Promise.resolve();
  });
}

function logServerStarted(): void {
  logger.info(
    {
      port: config.PORT,
      docs: config.NODE_ENV !== 'production' ? `http://localhost:${config.PORT}/docs` : undefined,
    },
    'Gateway HTTP server started'
  );
  logger.info(
    { service: config.SERVICE_NAME, version: config.SERVICE_VERSION, pid: process.pid },
    'Gateway service started successfully'
  );
}

async function main(): Promise<void> {
  try {
    logStartup();
    await initializeInfrastructure();
    initializeServices();

    const server = await createServer();
    await server.listen({ port: config.PORT, host: '0.0.0.0' });

    logServerStarted();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start Gateway service');
    process.exit(1);
  }
}

void main();
