/**
 * Example Service Proxy
 *
 * Translates downstream results into gateway domain terms:
 * - Business errors arrive as RESOLVED responses carrying an envelope
 *   ({ success: false, status_code, error }) and are mapped to typed AppErrors.
 * - Transport errors (thrown gRPC ServiceError) are mapped by gRPC status code
 *   to 502/503/504-style AppErrors so downstream outages never surface as
 *   404/400 or fake 200s.
 *
 * Routes simply await these methods; the global error handler renders AppErrors.
 */
import * as grpc from '@grpc/grpc-js';
import { ExampleGrpcClient } from './ExampleGrpcClient.js';
import type { ExampleData, ResponseEnvelope } from './ExampleGrpcClient.js';
import type { GatewayServiceHealth, GatewayCallOptions } from 'grpc-resilient/gateway';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ServiceUnavailableError,
  TimeoutError,
  ExternalServiceError,
} from '../../../shared/errors/index.js';
import config from '../../../config/env.js';
import logger from '../../logger/logger.js';
import { metrics } from '../../monitoring/metrics.js';

const SERVICE = 'ExampleService';

export interface ExampleListResult {
  items: ExampleData[];
  total: number;
}

/**
 * Map a business-error envelope (resolved response, success=false) to an AppError
 */
function envelopeToError(
  envelope: ResponseEnvelope,
  resource: string,
  id?: string | number
): AppError {
  const message = envelope.error || envelope.message || 'Downstream error';

  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- default covers all other downstream codes
  switch (envelope.status_code) {
    case 400:
      return new ValidationError(message);
    case 401:
      return new UnauthorizedError(message);
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(resource, id);
    case 409:
      return new ConflictError(message);
    case 422:
      return new BusinessRuleError(message);
    default:
      return new ExternalServiceError(SERVICE, message);
  }
}

/**
 * Map a transport-level gRPC error (thrown) to an AppError
 */
function grpcErrorToAppError(error: unknown, operation: string): AppError {
  const grpcError = error as Partial<grpc.ServiceError> & Error;

  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- default maps all remaining gRPC codes to 502
  switch (grpcError.code) {
    case grpc.status.UNAVAILABLE:
      return new ServiceUnavailableError(SERVICE);
    case grpc.status.DEADLINE_EXCEEDED:
      return new TimeoutError(`${SERVICE}.${operation}`, config.GRPC_CLIENT_TIMEOUT_MS);
    case grpc.status.UNAUTHENTICATED:
      return new UnauthorizedError();
    case grpc.status.PERMISSION_DENIED:
      return new ForbiddenError();
    case grpc.status.NOT_FOUND:
      return new NotFoundError(SERVICE);
    case grpc.status.RESOURCE_EXHAUSTED:
      return new ServiceUnavailableError(SERVICE, 'Downstream capacity exhausted');
    default:
      return new ExternalServiceError(SERVICE, grpcError.message || 'gRPC call failed');
  }
}

export class ExampleServiceProxy {
  private grpcClient: ExampleGrpcClient;

  constructor() {
    this.grpcClient = new ExampleGrpcClient();
  }

  initialize(): void {
    logger.info('ExampleServiceProxy initialized');
  }

  close(): void {
    this.grpcClient.close();
    logger.info('ExampleServiceProxy closed');
  }

  getHealth(): GatewayServiceHealth {
    return this.grpcClient.getHealth();
  }

  isConnected(): boolean {
    return this.grpcClient.isConnected();
  }

  private async call<T extends ResponseEnvelope>(
    operation: string,
    resource: string,
    id: string | number | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let response: T;
    try {
      response = await fn();
      metrics.recordGrpcCall(SERVICE, operation, 'success', Date.now() - startTime);
    } catch (error) {
      metrics.recordGrpcCall(SERVICE, operation, 'error', Date.now() - startTime);
      // AppErrors thrown deliberately upstream pass through untouched
      if (error instanceof AppError) {
        throw error;
      }
      const mapped = grpcErrorToAppError(error, operation);
      logger.error(
        { err: error, operation, mappedStatus: mapped.statusCode },
        `${SERVICE}.${operation} transport failure`
      );
      throw mapped;
    }

    if (!response.success) {
      const mapped = envelopeToError(response, resource, id);
      logger.warn(
        { operation, downstreamStatus: response.status_code, mappedStatus: mapped.statusCode },
        `${SERVICE}.${operation} returned business error`
      );
      throw mapped;
    }

    return response;
  }

  async getById(id: number, locale?: string): Promise<ExampleData> {
    const options: GatewayCallOptions = { locale };
    const response = await this.call('GetExample', 'Example', id, () =>
      this.grpcClient.getExample(id, options)
    );
    if (!response.example) {
      throw new NotFoundError('Example', id);
    }
    return response.example;
  }

  async list(limit: number, offset: number, locale?: string): Promise<ExampleListResult> {
    const options: GatewayCallOptions = { locale };
    const response = await this.call('ListExamples', 'Example', undefined, () =>
      this.grpcClient.listExamples(limit, offset, options)
    );
    return {
      items: response.examples ?? [],
      total: response.total ?? 0,
    };
  }

  async create(name: string, locale?: string): Promise<ExampleData> {
    const options: GatewayCallOptions = { locale };
    const response = await this.call('CreateExample', 'Example', undefined, () =>
      this.grpcClient.createExample(name, options)
    );
    if (!response.example) {
      throw new ExternalServiceError(SERVICE, 'Create returned no payload');
    }
    return response.example;
  }

  async update(id: number, name: string, locale?: string): Promise<ExampleData> {
    const options: GatewayCallOptions = { locale };
    const response = await this.call('UpdateExample', 'Example', id, () =>
      this.grpcClient.updateExample(id, name, options)
    );
    if (!response.example) {
      throw new ExternalServiceError(SERVICE, 'Update returned no payload');
    }
    return response.example;
  }

  async delete(id: number, locale?: string): Promise<void> {
    const options: GatewayCallOptions = { locale };
    await this.call('DeleteExample', 'Example', id, () =>
      this.grpcClient.deleteExample(id, options)
    );
  }
}
