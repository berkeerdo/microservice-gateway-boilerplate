/**
 * Authentication Middleware
 *
 * Verifies JWTs locally via @fastify/jwt (JWT_SECRET must be set).
 * Attach to routes as a preHandler:
 *
 *   fastify.get('/private', { preHandler: [fastify.authenticateGrpc] }, handler)
 *
 * For remote validation against an auth service, replace the local
 * verification inside authenticateGrpc with a gRPC ValidateToken call.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import jwt from '@fastify/jwt';
import config from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import logger from '../../infra/logger/logger.js';
import { metrics } from '../../infra/monitoring/metrics.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface JwtPayload {
  sub?: string | number;
  userId?: string | number;
  email?: string;
  [key: string]: unknown;
}

declare module 'fastify' {
  interface FastifyRequest {
    grpcUser?: AuthenticatedUser;
    accessToken?: string;
    /** Set after successful authentication; used for per-user rate limiting */
    userId?: string;
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

export function getAccessTokenFromCookie(request: FastifyRequest): string | null {
  const cookies = request.cookies as Record<string, string> | undefined;
  if (!cookies) {
    return null;
  }
  return cookies.access_token || null;
}

export const requireBearerToken = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    throw new UnauthorizedError('Authorization header required');
  }
  request.accessToken = token;
};

export function getAccessToken(request: FastifyRequest): string {
  if (!request.accessToken) {
    throw new UnauthorizedError('Access token not found');
  }
  return request.accessToken;
}

function verifyToken(request: FastifyRequest, token: string): JwtPayload {
  // Throws on invalid signature, expiry, or issuer mismatch
  return request.server.jwt.verify<JwtPayload>(token);
}

/**
 * Authenticate the request by verifying the JWT (cookie or bearer header).
 * Rejects when no token is present, the token is invalid, or JWT_SECRET
 * is not configured - it NEVER passes an unvalidated token through.
 */
export const authenticateGrpc = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  const cookieToken = getAccessTokenFromCookie(request);
  const headerToken = extractBearerToken(request.headers.authorization);
  const token = cookieToken || headerToken;
  const tokenSource: 'cookie' | 'header' = cookieToken ? 'cookie' : 'header';

  if (!token) {
    metrics.recordAuthFailure('TOKEN_MISSING', request.url);
    metrics.recordTokenValidation('failure', tokenSource);

    logger.warn(
      { correlationId: request.correlationId, path: request.url },
      'Missing authentication (no cookie or authorization header)'
    );
    throw new UnauthorizedError('Authentication required');
  }

  if (!config.JWT_SECRET) {
    metrics.recordAuthFailure('JWT_NOT_CONFIGURED', request.url);
    logger.error('authenticateGrpc used without JWT_SECRET configured');
    throw new UnauthorizedError('Authentication is not configured');
  }

  try {
    const payload = verifyToken(request, token);
    request.accessToken = token;
    const subject = payload.sub ?? payload.userId;
    if (subject !== undefined) {
      request.userId = String(subject);
    }
    metrics.recordTokenValidation('success', tokenSource);
  } catch (error) {
    metrics.recordAuthFailure('TOKEN_INVALID', request.url);
    metrics.recordTokenValidation('failure', tokenSource);
    logger.warn(
      { correlationId: request.correlationId, path: request.url, err: error },
      'Token verification failed'
    );
    throw new UnauthorizedError('Invalid or expired token');
  }
};

/**
 * Optional authentication - verifies the token when present, but never throws
 */
export const authenticateGrpcOptional = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  const cookieToken = getAccessTokenFromCookie(request);
  const token = cookieToken || extractBearerToken(request.headers.authorization);

  if (!token || !config.JWT_SECRET) {
    return;
  }

  try {
    const payload = verifyToken(request, token);
    request.accessToken = token;
    const subject = payload.sub ?? payload.userId;
    if (subject !== undefined) {
      request.userId = String(subject);
    }
  } catch (error) {
    logger.debug(
      { correlationId: request.correlationId, err: error },
      'Optional auth: token validation failed'
    );
  }
};

export async function registerGrpcAuth(fastify: FastifyInstance): Promise<void> {
  if (config.JWT_SECRET) {
    await fastify.register(jwt, {
      secret: config.JWT_SECRET,
      verify: { allowedIss: config.JWT_ISSUER },
    });
    logger.info('JWT verification enabled (@fastify/jwt)');
  } else {
    logger.warn('JWT_SECRET not set - authenticateGrpc will reject all requests');
  }

  fastify.decorate('authenticateGrpc', authenticateGrpc);
  fastify.decorate('authenticateGrpcOptional', authenticateGrpcOptional);

  logger.info('Authentication middleware registered');
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticateGrpc: preHandlerHookHandler;
    authenticateGrpcOptional: preHandlerHookHandler;
  }
}

export function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.grpcUser) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.grpcUser;
}

export function getAuthUserOptional(request: FastifyRequest): AuthenticatedUser | null {
  return request.grpcUser || null;
}
