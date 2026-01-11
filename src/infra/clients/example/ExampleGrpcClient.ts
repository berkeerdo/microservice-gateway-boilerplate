/**
 * Example gRPC Client
 * Replace with your actual service implementation
 */
import * as grpc from '@grpc/grpc-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  GatewayGrpcClient,
  type GatewayCallOptions,
  type GatewayLogger,
} from 'grpc-resilient/gateway';
import config from '../../../config/env.js';
import logger from '../../logger/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTO_DIR = join(__dirname, '../../../grpc/protos');

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

// Create a logger adapter for grpc-resilient
const grpcLogger: GatewayLogger = {
  info: (data: Record<string, unknown>, message: string) => logger.info(data, message),
  warn: (data: Record<string, unknown>, message: string) => logger.warn(data, message),
  error: (data: Record<string, unknown>, message: string) => logger.error(data, message),
  debug: (data: Record<string, unknown>, message: string) => logger.debug(data, message),
};

export class ExampleGrpcClient extends GatewayGrpcClient<grpc.Client> {
  constructor() {
    super(
      {
        serviceName: 'ExampleService',
        grpcUrl: config.EXAMPLE_SERVICE_GRPC_URL,
        protoFile: 'example/example_service.proto',
        packageName: 'example',
        serviceClassName: 'ExampleService',
        protosPath: PROTO_DIR,
        timeoutMs: config.GRPC_CLIENT_TIMEOUT_MS,
        retryCount: config.GRPC_CLIENT_RETRY_COUNT,
        retryDelayMs: config.GRPC_CLIENT_RETRY_DELAY_MS,
        // TLS configuration (optional)
        useTls: config.GRPC_USE_TLS,
        tlsCaPath: config.GRPC_TLS_CA_PATH,
        tlsClientCertPath: config.GRPC_TLS_CLIENT_CERT_PATH,
        tlsClientKeyPath: config.GRPC_TLS_CLIENT_KEY_PATH,
        // Keepalive settings
        keepaliveTimeMs: config.GRPC_KEEPALIVE_TIME_MS,
        keepaliveTimeoutMs: config.GRPC_KEEPALIVE_TIMEOUT_MS,
      },
      grpcLogger
    );
  }

  async getById(request: ExampleRequest, options?: GatewayCallOptions): Promise<ExampleResponse> {
    return this.callWithRetry<ExampleRequest, ExampleResponse>('GetById', request, options);
  }

  async list(request: ListRequest, options?: GatewayCallOptions): Promise<ListResponse> {
    return this.callWithRetry<ListRequest, ListResponse>('List', request, options);
  }

  async create(request: ExampleRequest, options?: GatewayCallOptions): Promise<ExampleResponse> {
    return this.callWithRetry<ExampleRequest, ExampleResponse>('Create', request, options);
  }

  async update(request: ExampleRequest, options?: GatewayCallOptions): Promise<ExampleResponse> {
    return this.callWithRetry<ExampleRequest, ExampleResponse>('Update', request, options);
  }

  async delete(request: ExampleRequest, options?: GatewayCallOptions): Promise<void> {
    return this.callWithRetry<ExampleRequest, void>('Delete', request, options);
  }
}
