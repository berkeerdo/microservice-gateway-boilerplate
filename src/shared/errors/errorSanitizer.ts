/**
 * Error Sanitizer
 * Sanitizes error messages for safe client exposure
 */

import { AppError } from './AppError.js';

export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Patterns that indicate internal/sensitive error information
 */
const SENSITIVE_PATTERNS = [
  /sql/i,
  /database/i,
  /connection refused/i,
  /econnrefused/i,
  /timeout/i,
  /internal server/i,
  /stack trace/i,
  /at \w+\s*\(/i,
  /node_modules/i,
  /\.ts:\d+/i,
  /\.js:\d+/i,
];

/**
 * Check if message contains sensitive information
 */
function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sanitize error message for client exposure
 * - Operational errors (AppError with isOperational=true) are trusted
 * - Unknown errors are sanitized to prevent information leakage
 */
export function sanitizeError(error: Error | AppError): string {
  // AppError instances are considered safe if operational
  if (error instanceof AppError && error.isOperational) {
    // Still check for accidental sensitive info
    if (containsSensitiveInfo(error.message)) {
      return DEFAULT_ERROR_MESSAGE;
    }
    return error.message;
  }

  // For unknown errors, always use default message in production
  if (process.env.NODE_ENV === 'production') {
    return DEFAULT_ERROR_MESSAGE;
  }

  // In development, return the original message if not sensitive
  if (containsSensitiveInfo(error.message)) {
    return DEFAULT_ERROR_MESSAGE;
  }

  return error.message;
}

/**
 * Create a sanitized error response object
 */
export function createSanitizedErrorResponse(
  error: Error | AppError,
  requestId?: string
): Record<string, unknown> {
  const message = sanitizeError(error);
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';

  return {
    error: code,
    message,
    statusCode,
    requestId,
    timestamp: new Date().toISOString(),
  };
}
