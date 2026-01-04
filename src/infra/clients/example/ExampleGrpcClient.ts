/**
 * Example gRPC Client
 * Replace with your actual service implementation
 */
import * as grpc from '@grpc/grpc-js';
import { BaseGrpcClient } from '../BaseGrpcClient.js';
import type { GrpcCallOptions } from '../grpc-types.js';
import config from '../../../config/env.js';

// Example request/response types - replace with your actual types
export interface ExampleRequest {
  id: string;
  name?: string;
}

export interface ExampleResponse {
  id: string;
  name: string;
  createdAt: string;
}

export interface ListRequest {
  page?: number;
  limit?: number;
}

export interface ListResponse {
  items: ExampleResponse[];
  total: number;
}

export class ExampleGrpcClient extends BaseGrpcClient<grpc.Client> {
  constructor() {
    super({
      serviceName: 'ExampleService',
      grpcUrl: config.EXAMPLE_SERVICE_GRPC_URL,
      protoFile: 'example/example_service.proto',
      packageName: 'example',
      serviceClassName: 'ExampleService',
      timeoutMs: config.GRPC_CLIENT_TIMEOUT_MS,
      retryCount: config.GRPC_CLIENT_RETRY_COUNT,
      retryDelayMs: config.GRPC_CLIENT_RETRY_DELAY_MS,
    });
  }

  async getById(request: ExampleRequest, options?: GrpcCallOptions): Promise<ExampleResponse> {
    return this.callWithRetry<ExampleRequest, ExampleResponse>('GetById', request, options);
  }

  async list(request: ListRequest, options?: GrpcCallOptions): Promise<ListResponse> {
    return this.callWithRetry<ListRequest, ListResponse>('List', request, options);
  }

  async create(request: ExampleRequest, options?: GrpcCallOptions): Promise<ExampleResponse> {
    return this.callWithRetry<ExampleRequest, ExampleResponse>('Create', request, options);
  }

  async update(request: ExampleRequest, options?: GrpcCallOptions): Promise<ExampleResponse> {
    return this.callWithRetry<ExampleRequest, ExampleResponse>('Update', request, options);
  }

  async delete(request: ExampleRequest, options?: GrpcCallOptions): Promise<void> {
    return this.callWithRetry<ExampleRequest, void>('Delete', request, options);
  }
}
