/**
 * gRPC Clients Module
 *
 * Re-exports from grpc-resilient/gateway package with example client.
 *
 * The gateway module is optimized for API Gateway/Proxy services that need to:
 * - Proxy requests to multiple microservices
 * - Handle resilient connections with auto-reconnect
 * - Support TLS/mTLS for secure communication
 * - Track metrics and health status
 */

// Re-export gateway types and utilities from grpc-resilient
export {
  // Gateway Client
  GatewayGrpcClient,

  // Metrics Tracker
  GatewayMetricsTracker,

  // Credentials Provider
  createGatewayCredentials,
  validateTlsConfig,

  // Retry Handler utilities
  isRetryableError,
  isConnectionError,
  calculateBackoffDelay,
  sleep,
  getErrorDescription,

  // Types
  GatewayConnectionState,
  GATEWAY_DEFAULT_CONFIG,
  GATEWAY_DEFAULT_METRICS,
  type GatewayClientConfig,
  type GatewayCallOptions,
  type GatewayServiceHealth,
  type GatewayClientMetrics,
  type GatewayLogger,
  type TlsCredentialsOptions,
} from 'grpc-resilient/gateway';

// Example Service (replace with your actual services)
export { ExampleGrpcClient } from './example/ExampleGrpcClient.js';
export { ExampleServiceProxy, type ProxyResult } from './example/ExampleServiceProxy.js';

// Legacy exports for backward compatibility (will be removed in future versions)
// Use imports from grpc-resilient/gateway instead
export { GatewayGrpcClient as BaseGrpcClient } from 'grpc-resilient/gateway';
export { GatewayConnectionState as ConnectionState } from 'grpc-resilient/gateway';
export type { GatewayClientConfig as GrpcClientConfig } from 'grpc-resilient/gateway';
export type { GatewayServiceHealth as ServiceHealth } from 'grpc-resilient/gateway';
export type { GatewayCallOptions as GrpcCallOptions } from 'grpc-resilient/gateway';
