import type { FastifyInstance } from 'fastify';
import logger from '../logger/logger.js';
import config from '../../config/env.js';

type ShutdownHandler = () => Promise<void>;

/**
 * GracefulShutdown - Manages clean application shutdown
 */
class GracefulShutdownManager {
  private handlers = new Map<string, ShutdownHandler>();
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  register(name: string, handler: ShutdownHandler): void {
    if (this.handlers.has(name)) {
      logger.warn({ name }, 'Shutdown handler already registered, replacing');
    }
    this.handlers.set(name, handler);
    logger.debug({ name }, 'Shutdown handler registered');
  }

  unregister(name: string): void {
    this.handlers.delete(name);
  }

  registerFastify(fastify: FastifyInstance): void {
    this.register('fastify', async () => {
      logger.info('Closing HTTP server...');
      await fastify.close();
      logger.info('HTTP server closed');
    });
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown && this.shutdownPromise) {
      logger.warn('Shutdown already in progress');
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown initiated');

    this.shutdownPromise = this.executeShutdown();
    return this.shutdownPromise;
  }

  private async executeShutdown(): Promise<void> {
    const timeout = config.SHUTDOWN_TIMEOUT_MS;
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${timeout}ms`));
      }, timeout);
    });

    try {
      await Promise.race([this.executeHandlers(), timeoutPromise]);
      const duration = Date.now() - startTime;
      logger.info({ duration }, 'Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ err: error, duration }, 'Graceful shutdown failed');
      process.exit(1);
    }
  }

  private async executeHandlers(): Promise<void> {
    const handlers = Array.from(this.handlers.entries()).reverse();

    for (const [name, handler] of handlers) {
      try {
        logger.info({ handler: name }, `Executing shutdown handler: ${name}`);
        await handler();
        logger.info({ handler: name }, `Shutdown handler completed: ${name}`);
      } catch (error) {
        logger.error({ err: error, handler: name }, `Shutdown handler failed: ${name}`);
      }
    }
  }

  setupSignalHandlers(): void {
    // SIGUSR2 is deliberately NOT handled: tsx/nodemon use it for restarts
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    for (const signal of signals) {
      process.on(signal, () => {
        void this.shutdown(signal);
      });
    }

    process.on('uncaughtException', (error) => {
      logger.fatal({ err: error }, 'Uncaught exception');
      void this.shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.fatal({ reason }, 'Unhandled rejection');
      void this.shutdown('unhandledRejection');
    });

    logger.info('Signal handlers registered');
  }

  isInProgress(): boolean {
    return this.isShuttingDown;
  }

  reset(): void {
    this.handlers.clear();
    this.isShuttingDown = false;
    this.shutdownPromise = null;
  }
}

export const gracefulShutdown = new GracefulShutdownManager();
