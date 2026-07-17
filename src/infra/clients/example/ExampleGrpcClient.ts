/**
 * Example gRPC Client
 *
 * Speaks the microservice-boilerplate contract (proto package `microservice`,
 * envelope responses with success/error/status_code). Replace with your actual
 * service implementation.
 */
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

// ============================================
// Envelope types matching microservice service.proto
// ============================================

export interface ExampleData {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Common envelope fields every downstream response carries */
export interface ResponseEnvelope {
  success: boolean;
  message?: string;
  error?: string;
  status_code?: number;
}

export interface GetExampleResponse extends ResponseEnvelope {
  example?: ExampleData;
}

export interface CreateExampleResponse extends ResponseEnvelope {
  example?: ExampleData;
}

export interface ListExamplesResponse extends ResponseEnvelope {
  examples?: ExampleData[];
  total?: number;
}

export interface UpdateExampleResponse extends ResponseEnvelope {
  example?: ExampleData;
}

export type GenericResponse = ResponseEnvelope;

// Create a logger adapter for grpc-resilient
const grpcLogger: GatewayLogger = {
  info: (data: Record<string, unknown>, message?: string) => {
    logger.info(data, message);
  },
  warn: (data: Record<string, unknown>, message?: string) => {
    logger.warn(data, message);
  },
  error: (data: Record<string, unknown>, message?: string) => {
    logger.error(data, message);
  },
  debug: (data: Record<string, unknown>, message?: string) => {
    logger.debug(data, message);
  },
};

export class ExampleGrpcClient extends GatewayGrpcClient {
  constructor() {
    super(
      {
        serviceName: 'ExampleService',
        grpcUrl: config.EXAMPLE_SERVICE_GRPC_URL,
        protoFile: 'microservice/service.proto',
        packageName: 'microservice',
        serviceClassName: 'ExampleService',
        protosPath: PROTO_DIR,
        timeoutMs: config.GRPC_CLIENT_TIMEOUT_MS,
        retryCount: config.GRPC_CLIENT_RETRY_COUNT,
        retryDelayMs: config.GRPC_CLIENT_RETRY_DELAY_MS,
        // TLS configuration (optional)
        useTls: config.GRPC_USE_TLS,
        tlsCaCertPath: config.GRPC_TLS_CA_PATH,
        tlsClientCertPath: config.GRPC_TLS_CLIENT_CERT_PATH,
        tlsClientKeyPath: config.GRPC_TLS_CLIENT_KEY_PATH,
        // Keepalive settings
        keepaliveTimeMs: config.GRPC_KEEPALIVE_TIME_MS,
        keepaliveTimeoutMs: config.GRPC_KEEPALIVE_TIMEOUT_MS,
      },
      grpcLogger
    );
  }

  async getExample(id: number, options?: GatewayCallOptions): Promise<GetExampleResponse> {
    return this.callWithRetry<{ id: number }, GetExampleResponse>('GetExample', { id }, options);
  }

  async listExamples(
    limit: number,
    offset: number,
    options?: GatewayCallOptions
  ): Promise<ListExamplesResponse> {
    return this.callWithRetry<{ limit: number; offset: number }, ListExamplesResponse>(
      'ListExamples',
      { limit, offset },
      options
    );
  }

  async createExample(name: string, options?: GatewayCallOptions): Promise<CreateExampleResponse> {
    // Non-idempotent (RFC 9110): never auto-retried, a retry could create duplicates
    return this.callWithRetry<{ name: string }, CreateExampleResponse>(
      'CreateExample',
      { name },
      { ...options, skipRetry: true }
    );
  }

  async updateExample(
    id: number,
    name: string,
    options?: GatewayCallOptions
  ): Promise<UpdateExampleResponse> {
    // Not idempotent under concurrent writers; skip automatic retries
    return this.callWithRetry<{ id: number; name: string }, UpdateExampleResponse>(
      'UpdateExample',
      { id, name },
      { ...options, skipRetry: true }
    );
  }

  async deleteExample(id: number, options?: GatewayCallOptions): Promise<GenericResponse> {
    // Idempotent (RFC 9110): safe to retry on transient transport failures
    return this.callWithRetry<{ id: number }, GenericResponse>('DeleteExample', { id }, options);
  }
}
