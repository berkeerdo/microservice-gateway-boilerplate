/**
 * Example Service Proxy
 * Wraps the gRPC client with additional functionality
 */
import { ExampleGrpcClient } from './ExampleGrpcClient.js';
import type { ExampleRequest, ExampleResponse, ListRequest, ListResponse } from './ExampleGrpcClient.js';
import type { ServiceHealth, GrpcCallOptions } from '../grpc-types.js';
import logger from '../../logger/logger.js';

export interface ProxyResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
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

  getHealth(): ServiceHealth {
    return this.grpcClient.getHealth();
  }

  isConnected(): boolean {
    return this.grpcClient.isConnected();
  }

  async getById(id: string, locale?: string): Promise<ProxyResult<ExampleResponse>> {
    try {
      const options: GrpcCallOptions = { locale };
      const response = await this.grpcClient.getById({ id }, options);
      return { success: true, data: response };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error, id }, 'Failed to get example by ID');
      return { success: false, error: errorMessage, code: 'GRPC_ERROR' };
    }
  }

  async list(page?: number, limit?: number, locale?: string): Promise<ProxyResult<ListResponse>> {
    try {
      const options: GrpcCallOptions = { locale };
      const response = await this.grpcClient.list({ page, limit }, options);
      return { success: true, data: response };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error }, 'Failed to list examples');
      return { success: false, error: errorMessage, code: 'GRPC_ERROR' };
    }
  }

  async create(request: ExampleRequest, locale?: string): Promise<ProxyResult<ExampleResponse>> {
    try {
      const options: GrpcCallOptions = { locale };
      const response = await this.grpcClient.create(request, options);
      return { success: true, data: response };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error, request }, 'Failed to create example');
      return { success: false, error: errorMessage, code: 'GRPC_ERROR' };
    }
  }

  async update(request: ExampleRequest, locale?: string): Promise<ProxyResult<ExampleResponse>> {
    try {
      const options: GrpcCallOptions = { locale };
      const response = await this.grpcClient.update(request, options);
      return { success: true, data: response };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error, request }, 'Failed to update example');
      return { success: false, error: errorMessage, code: 'GRPC_ERROR' };
    }
  }

  async delete(id: string, locale?: string): Promise<ProxyResult<void>> {
    try {
      const options: GrpcCallOptions = { locale };
      await this.grpcClient.delete({ id }, options);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error, id }, 'Failed to delete example');
      return { success: false, error: errorMessage, code: 'GRPC_ERROR' };
    }
  }
}
