/**
 * gRPC Client Type Definitions
 */

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
}

export interface GrpcClientConfig {
  serviceName: string;
  grpcUrl: string;
  protoFile: string;
  packageName: string;
  serviceClassName: string;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  maxReconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export interface GrpcCallOptions {
  timeoutMs?: number;
  locale?: string;
  clientUrl?: string;
  skipRetry?: boolean;
}

export interface ClientMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  retriedCalls: number;
  averageLatencyMs: number;
  lastCallTime: Date | null;
}

export interface ServiceHealth {
  state: ConnectionState;
  healthy: boolean;
  latencyMs: number;
  lastCheck: Date;
  lastConnectedAt: Date | null;
  lastErrorAt: Date | null;
  error?: string;
  reconnectAttempts: number;
  metrics: ClientMetrics;
}

export const DEFAULT_CONFIG = {
  timeoutMs: 5000,
  retryCount: 3,
  retryDelayMs: 1000,
  maxReconnectAttempts: 10,
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
};
