/**
 * ExampleServiceProxy error-mapping tests
 *
 * The proxy must translate:
 * - resolved envelopes with success=false into typed AppErrors by status_code
 * - thrown transport errors into 502/503/504-style AppErrors by gRPC code
 * so downstream failures are never surfaced as 200/400/404 by accident.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';

// Mock the gRPC client so no real connection is attempted
const mockClient = {
  getExample: vi.fn(),
  listExamples: vi.fn(),
  createExample: vi.fn(),
  updateExample: vi.fn(),
  deleteExample: vi.fn(),
  close: vi.fn(),
  getHealth: vi.fn(),
  isConnected: vi.fn(),
};

vi.mock('../../src/infra/clients/example/ExampleGrpcClient.js', () => ({
  // Must be constructable: `new ExampleGrpcClient()` returns the mock object
  ExampleGrpcClient: vi.fn(function () {
    return mockClient;
  }),
}));

import { ExampleServiceProxy } from '../../src/infra/clients/example/ExampleServiceProxy.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  TimeoutError,
  ExternalServiceError,
} from '../../src/shared/errors/index.js';

function grpcError(code: grpc.status, message = 'boom'): Error & { code: grpc.status } {
  const error = new Error(message) as Error & { code: grpc.status };
  error.code = code;
  return error;
}

describe('ExampleServiceProxy error mapping', () => {
  let proxy: ExampleServiceProxy;

  beforeEach(() => {
    vi.clearAllMocks();
    proxy = new ExampleServiceProxy();
  });

  describe('envelope (business) errors from resolved responses', () => {
    it('maps status_code 404 to NotFoundError', async () => {
      mockClient.getExample.mockResolvedValue({
        success: false,
        error: 'Example not found',
        status_code: 404,
      });

      await expect(proxy.getById(42)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('maps status_code 409 to ConflictError', async () => {
      mockClient.createExample.mockResolvedValue({
        success: false,
        error: 'Example already exists',
        status_code: 409,
      });

      await expect(proxy.create('duplicate')).rejects.toBeInstanceOf(ConflictError);
    });

    it('maps status_code 400 to ValidationError', async () => {
      mockClient.createExample.mockResolvedValue({
        success: false,
        error: 'Name is required',
        status_code: 400,
      });

      await expect(proxy.create('')).rejects.toBeInstanceOf(ValidationError);
    });

    it('maps unknown status_code to ExternalServiceError (502)', async () => {
      mockClient.getExample.mockResolvedValue({
        success: false,
        error: 'Something odd',
        status_code: 500,
      });

      const error = await proxy.getById(1).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).statusCode).toBe(502);
    });
  });

  describe('transport (thrown) gRPC errors', () => {
    it('maps UNAVAILABLE to ServiceUnavailableError (503)', async () => {
      mockClient.getExample.mockRejectedValue(grpcError(grpc.status.UNAVAILABLE));

      const error = await proxy.getById(1).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect((error as ServiceUnavailableError).statusCode).toBe(503);
    });

    it('maps DEADLINE_EXCEEDED to TimeoutError (504)', async () => {
      mockClient.listExamples.mockRejectedValue(grpcError(grpc.status.DEADLINE_EXCEEDED));

      const error = await proxy.list(20, 0).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).statusCode).toBe(504);
    });

    it('maps unknown transport errors to ExternalServiceError (502)', async () => {
      mockClient.deleteExample.mockRejectedValue(new Error('socket hang up'));

      const error = await proxy.delete(1).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).statusCode).toBe(502);
    });
  });

  describe('success paths', () => {
    it('unwraps example payload on success', async () => {
      const example = { id: 1, name: 'Test', created_at: 'x', updated_at: 'y' };
      mockClient.getExample.mockResolvedValue({ success: true, example });

      await expect(proxy.getById(1)).resolves.toEqual(example);
    });

    it('unwraps list payload with defaults', async () => {
      mockClient.listExamples.mockResolvedValue({
        success: true,
        examples: undefined,
        total: undefined,
      });

      await expect(proxy.list(20, 0)).resolves.toEqual({ items: [], total: 0 });
    });

    it('delete resolves to void on success', async () => {
      mockClient.deleteExample.mockResolvedValue({ success: true });

      await expect(proxy.delete(1)).resolves.toBeUndefined();
    });
  });
});
