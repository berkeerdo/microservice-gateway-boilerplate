/**
 * gRPC Retry Handler
 * Handles retry logic and error classification for gRPC calls
 */
import * as grpc from '@grpc/grpc-js';
import logger from '../logger/logger.js';

const RETRYABLE_STATUS_CODES = [
  grpc.status.UNAVAILABLE,
  grpc.status.DEADLINE_EXCEEDED,
  grpc.status.RESOURCE_EXHAUSTED,
  grpc.status.ABORTED,
  grpc.status.INTERNAL,
];

const CONNECTION_ERROR_CODES = [grpc.status.UNAVAILABLE, grpc.status.DEADLINE_EXCEEDED];

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const code = (error as Error & { code?: number }).code;
  if (code === undefined) {
    return false;
  }
  return RETRYABLE_STATUS_CODES.includes(code);
}

/**
 * Check if error indicates connection loss
 */
export function isConnectionError(error: Error): boolean {
  const code = (error as Error & { code?: number }).code;
  if (code === undefined) {
    return false;
  }
  return CONNECTION_ERROR_CODES.includes(code);
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(baseDelayMs: number, attempt: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponentialDelay + jitter, 30000);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log retry attempt
 */
export function logRetryAttempt(
  serviceName: string,
  methodName: string,
  attempt: number,
  maxAttempts: number,
  delayMs: number,
  errorMessage: string
): void {
  logger.warn(
    {
      service: serviceName,
      method: methodName,
      attempt: attempt + 1,
      maxAttempts,
      retryInMs: Math.round(delayMs),
      error: errorMessage,
    },
    'Retrying gRPC call'
  );
}
