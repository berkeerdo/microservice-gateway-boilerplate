import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import logger from '../../infra/logger/logger.js';

/**
 * Register validation error handler for Zod schema validation
 */
export function registerValidationErrorHandler(fastify: FastifyInstance): void {
  fastify.setSchemaErrorFormatter((errors, dataVar) => {
    logger.debug({ errors, dataVar }, 'Schema validation error');

    const formattedErrors = errors.map((err) => ({
      field: err.instancePath || dataVar,
      message: err.message || 'Validation failed',
      keyword: err.keyword,
    }));

    return new Error(JSON.stringify(formattedErrors));
  });
}

/**
 * Format Zod validation errors into a consistent structure
 */
export function formatZodErrors(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
