import type { AwilixContainer } from 'awilix';
import { createContainer, asValue, asClass, InjectionMode } from 'awilix';
import type { Logger } from './infra/logger/logger.js';
import logger from './infra/logger/logger.js';
import { ExampleServiceProxy } from './infra/clients/index.js';

/**
 * Container Cradle Interface
 * Defines all available dependencies with their types
 */
export interface Cradle {
  // Infrastructure
  logger: Logger;

  // Service Proxies (add your own proxies here)
  exampleServiceProxy: ExampleServiceProxy;
}

/**
 * Dependency Injection Tokens
 */
export const TOKENS = {
  Logger: 'logger',
  ExampleServiceProxy: 'exampleServiceProxy',
} as const;

/**
 * Create and configure the DI container
 */
export const container: AwilixContainer<Cradle> = createContainer<Cradle>({
  injectionMode: InjectionMode.PROXY,
  strict: true,
});

/**
 * Register all dependencies in the DI container
 */
export function registerDependencies(): AwilixContainer<Cradle> {
  container.register({
    // Infrastructure
    logger: asValue(logger),

    // Service Proxies
    exampleServiceProxy: asClass(ExampleServiceProxy).singleton(),
  });

  logger.info('Dependency injection container initialized');
  return container;
}

/**
 * Initialize all service connections
 */
export function initializeServiceProxies(): void {
  const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
  exampleProxy.initialize();

  logger.info('Service proxies initialized');
}

/**
 * Close all service connections
 */
export function closeServiceProxies(): void {
  const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
  exampleProxy.close();

  logger.info('Service proxies closed');
}
