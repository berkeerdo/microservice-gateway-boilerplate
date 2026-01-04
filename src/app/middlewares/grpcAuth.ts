/**
 * gRPC-based Authentication Middleware
 *
 * This is a template - customize based on your auth service implementation
 */
import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { container } from '../../container.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import logger from '../../infra/logger/logger.js';
import { metrics } from '../../infra/monitoring/metrics.js';
import type { ExampleServiceProxy } from '../../infra/clients/example/ExampleServiceProxy.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    grpcUser?: AuthenticatedUser;
    accessToken?: string;
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
  return cookies['access_token'] || null;
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

/**
 * Authenticate request via gRPC token validation
 * NOTE: This is a template - implement your actual auth logic
 */
export const authenticateGrpc = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  // Get proxy from DI container
  const _exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');

  const cookieToken = getAccessTokenFromCookie(request);
  const headerToken = extractBearerToken(request.headers.authorization);
  const token = cookieToken || headerToken;
  const tokenSource: 'cookie' | 'header' | 'query' = cookieToken ? 'cookie' : 'header';

  if (!token) {
    metrics.recordAuthFailure('TOKEN_MISSING', request.url);
    metrics.recordTokenValidation('failure', tokenSource);

    logger.warn(
      { correlationId: request.correlationId, path: request.url },
      'Missing authentication (no cookie or authorization header)'
    );
    throw new UnauthorizedError('Authentication required');
  }

  // TODO: Implement your actual token validation logic here
  // Example:
  // const validation = await authProxy.validateToken(token);
  // if (!validation.success) { throw new UnauthorizedError('Invalid token'); }
  // request.grpcUser = transformUser(validation.data.user);

  // For now, just store the token
  request.accessToken = token;
  metrics.recordTokenValidation('success', tokenSource);
};

/**
 * Optional authentication - doesn't throw if no token
 */
export const authenticateGrpcOptional = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  const token =
    getAccessTokenFromCookie(request) || extractBearerToken(request.headers.authorization);

  if (!token) {
    return;
  }

  try {
    // TODO: Implement your actual token validation logic here
    request.accessToken = token;
  } catch (error) {
    logger.debug(
      { correlationId: request.correlationId, error },
      'Optional auth: token validation failed'
    );
  }
};

export function registerGrpcAuth(fastify: FastifyInstance): void {
  fastify.decorate('authenticateGrpc', authenticateGrpc);
  fastify.decorate('authenticateGrpcOptional', authenticateGrpcOptional);

  logger.info('gRPC authentication middleware registered');
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
