/**
 * Centralized Error Handler for Gateway
 */
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import logger from '../../infra/logger/logger.js';
import { captureException } from '../../infra/monitoring/sentry.js';
import { AppError } from './AppError.js';
import { sanitizeError } from './errorSanitizer.js';
import { t, parseLocale, type SupportedLocale } from '../i18n/index.js';

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

function getLocaleFromRequest(request: FastifyRequest): SupportedLocale {
  const xLang = request.headers['x-language'];
  if (typeof xLang === 'string') {
    return parseLocale(xLang);
  }
  const acceptLang = request.headers['accept-language'];
  if (typeof acceptLang === 'string') {
    return parseLocale(acceptLang);
  }
  return 'en';
}

function formatZodError(
  error: ZodError,
  locale: SupportedLocale
): { field: string; message: string }[] {
  const issues = (error as { issues?: unknown[] }).issues || [];
  return issues.map((issue) => {
    const iss = issue as { path?: unknown[]; message?: string };
    return {
      field: Array.isArray(iss.path) ? iss.path.map(String).join('.') : '',
      message: iss.message || t('validation.error', locale),
    };
  });
}

function createErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  requestId?: string,
  details?: unknown
): ErrorResponse {
  return {
    error: code,
    message,
    statusCode,
    details,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

interface ErrorContext {
  requestId: string;
  correlationId: string;
  locale: SupportedLocale;
  reply: FastifyReply;
}

function handleAppError(error: AppError, ctx: ErrorContext): void {
  const sanitizedMessage = sanitizeError(error);
  logger.warn({
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    error: error.code,
    originalMessage: error.message,
    sanitizedMessage,
    statusCode: error.statusCode,
    details: error.details,
  });
  void ctx.reply
    .status(error.statusCode)
    .send(
      createErrorResponse(
        error.code,
        sanitizedMessage,
        error.statusCode,
        ctx.requestId,
        error.details
      )
    );
}

function handleZodError(error: ZodError, ctx: ErrorContext): void {
  const details = formatZodError(error, ctx.locale);
  const message = t('validation.failed', ctx.locale);
  logger.warn({
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    error: 'VALIDATION_ERROR',
    details,
  });
  void ctx.reply
    .status(HttpStatus.BAD_REQUEST)
    .send(
      createErrorResponse(
        'VALIDATION_ERROR',
        message,
        HttpStatus.BAD_REQUEST,
        ctx.requestId,
        details
      )
    );
}

function handleFastifyValidationError(error: FastifyError, ctx: ErrorContext): void {
  const message = t('validation.failed', ctx.locale);
  logger.warn({
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    error: 'VALIDATION_ERROR',
    validation: error.validation,
  });
  void ctx.reply
    .status(HttpStatus.BAD_REQUEST)
    .send(
      createErrorResponse(
        'VALIDATION_ERROR',
        message,
        HttpStatus.BAD_REQUEST,
        ctx.requestId,
        error.validation
      )
    );
}

function handleJwtError(error: Error, ctx: ErrorContext): void {
  const message =
    error.name === 'TokenExpiredError'
      ? t('auth.sessionExpired', ctx.locale)
      : t('auth.invalidToken', ctx.locale);
  logger.warn({
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    error: 'AUTHENTICATION_ERROR',
    errorName: error.name,
  });
  void ctx.reply
    .status(HttpStatus.UNAUTHORIZED)
    .send(
      createErrorResponse('AUTHENTICATION_ERROR', message, HttpStatus.UNAUTHORIZED, ctx.requestId)
    );
}

function handleUnknownError(error: Error, ctx: ErrorContext, request: FastifyRequest): void {
  logger.error({
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    error: error.message,
    stack: error.stack,
    name: error.name,
  });
  captureException(error, {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    url: request.url,
    method: request.method,
  });
  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev ? error.message : t('common.internalError', ctx.locale);
  void ctx.reply
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .send(
      createErrorResponse(
        'INTERNAL_ERROR',
        message,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ctx.requestId
      )
    );
}

/**
 * Global error handler for Fastify
 */
export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;
  // Single source of truth: the correlationId middleware already resolved
  // (or generated) the id; only fall back to headers when it did not run
  const correlationId =
    request.correlationId || (request.headers['x-correlation-id'] as string) || requestId;
  const locale = getLocaleFromRequest(request);
  const ctx: ErrorContext = { requestId, correlationId, locale, reply };

  if (error instanceof AppError) {
    handleAppError(error, ctx);
    return;
  }

  if (error instanceof ZodError) {
    handleZodError(error, ctx);
    return;
  }

  if ('validation' in error && error.validation) {
    handleFastifyValidationError(error, ctx);
    return;
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    handleJwtError(error, ctx);
    return;
  }

  handleUnknownError(error, ctx, request);
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): void {
  const requestId = request.id;
  const locale = getLocaleFromRequest(request);
  const message = t('route.notFound', { method: request.method, url: request.url }, locale);
  void reply
    .status(HttpStatus.NOT_FOUND)
    .send(createErrorResponse('ROUTE_NOT_FOUND', message, HttpStatus.NOT_FOUND, requestId));
}
