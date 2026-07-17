import type { ZodError } from 'zod';

/**
 * Format Zod validation errors into a consistent structure.
 *
 * Note: request validation itself is handled by fastify-type-provider-zod's
 * validatorCompiler (see server.ts); failed validations carry `.validation`
 * and are rendered by the global error handler. No ajv schema error
 * formatter is needed (and the previous one produced opaque 500s).
 */
export function formatZodErrors(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
