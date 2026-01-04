import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './healthRoutes.js';
import { exampleRoutes } from './exampleRoutes.js';
import logger from '../../infra/logger/logger.js';

export function registerRoutes(fastify: FastifyInstance): void {
  // Health routes (no prefix)
  void fastify.register(healthRoutes);

  // Example routes
  void fastify.register(exampleRoutes, { prefix: '/examples' });

  // Add more routes here:
  // void fastify.register(authRoutes, { prefix: '/auth' });
  // void fastify.register(userRoutes, { prefix: '/users' });

  logger.info('Routes registered');
}
