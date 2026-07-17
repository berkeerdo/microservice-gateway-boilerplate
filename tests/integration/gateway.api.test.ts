/**
 * Gateway API integration tests
 *
 * Boots the real Fastify server (zod validation, error handler, middlewares)
 * with a stubbed ExampleServiceProxy in the DI container - no gRPC, no Redis.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { asValue } from 'awilix';
import type { FastifyInstance } from 'fastify';

// Mock Sentry to prevent side effects
vi.mock('../../src/infra/monitoring/sentry.js', () => ({
  initializeSentry: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  clearUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  flushSentry: vi.fn().mockResolvedValue(true),
  closeSentry: vi.fn().mockResolvedValue(undefined),
}));

import { createServer } from '../../src/app/server.js';
import { container, registerDependencies } from '../../src/container.js';
import {
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
} from '../../src/shared/errors/index.js';

const mockProxy = {
  initialize: vi.fn(),
  close: vi.fn(),
  getHealth: vi.fn().mockReturnValue({ healthy: true, state: 'CONNECTED' }),
  isConnected: vi.fn().mockReturnValue(true),
  getById: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('Gateway API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    registerDependencies();
    container.register({ exampleServiceProxy: asValue(mockProxy as never) });
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /examples/:id', () => {
    it('returns the example on success', async () => {
      const example = { id: 1, name: 'Test', created_at: '2026-01-01', updated_at: '2026-01-02' };
      mockProxy.getById.mockResolvedValue(example);

      const response = await app.inject({ method: 'GET', url: '/examples/1' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(example);
      expect(mockProxy.getById).toHaveBeenCalledWith(1, 'en');
    });

    it('returns 404 when the proxy throws NotFoundError', async () => {
      mockProxy.getById.mockRejectedValue(new NotFoundError('Example', 99));

      const response = await app.inject({ method: 'GET', url: '/examples/99' });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('NOT_FOUND');
    });

    it('returns 503 when the downstream is unavailable (never 404/200)', async () => {
      mockProxy.getById.mockRejectedValue(new ServiceUnavailableError('ExampleService'));

      const response = await app.inject({ method: 'GET', url: '/examples/1' });

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.payload).error).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns 400 for a non-numeric id (zod validation)', async () => {
      const response = await app.inject({ method: 'GET', url: '/examples/abc' });

      expect(response.statusCode).toBe(400);
      expect(mockProxy.getById).not.toHaveBeenCalled();
    });
  });

  describe('POST /examples', () => {
    it('creates and returns 201', async () => {
      const example = { id: 2, name: 'New', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockProxy.create.mockResolvedValue(example);

      const response = await app.inject({
        method: 'POST',
        url: '/examples',
        payload: { name: 'New' },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(example);
    });

    it('returns 409 when the downstream reports a conflict', async () => {
      mockProxy.create.mockRejectedValue(new ConflictError('Example already exists'));

      const response = await app.inject({
        method: 'POST',
        url: '/examples',
        payload: { name: 'Duplicate' },
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.payload).error).toBe('CONFLICT');
    });

    it('returns 400 for an empty name without calling downstream', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/examples',
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
      expect(mockProxy.create).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /examples/:id', () => {
    it('returns 204 on success', async () => {
      mockProxy.delete.mockResolvedValue(undefined);

      const response = await app.inject({ method: 'DELETE', url: '/examples/1' });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('GET /examples (list)', () => {
    it('passes pagination defaults to the proxy', async () => {
      mockProxy.list.mockResolvedValue({ items: [], total: 0 });

      const response = await app.inject({ method: 'GET', url: '/examples' });

      expect(response.statusCode).toBe(200);
      expect(mockProxy.list).toHaveBeenCalledWith(20, 0, 'en');
    });

    it('rejects limit above 100', async () => {
      const response = await app.inject({ method: 'GET', url: '/examples?limit=500' });

      expect(response.statusCode).toBe(400);
      expect(mockProxy.list).not.toHaveBeenCalled();
    });
  });

  describe('health endpoints', () => {
    it('GET /health is liveness-only and always 200', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).alive).toBe(true);
    });

    it('GET /metrics exposes Prometheus metrics', async () => {
      const response = await app.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.payload).toContain('gateway_');
    });

    it('unknown routes return 404 via notFoundHandler', async () => {
      const response = await app.inject({ method: 'GET', url: '/nope' });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('ROUTE_NOT_FOUND');
    });
  });
});
