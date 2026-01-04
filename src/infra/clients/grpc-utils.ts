/**
 * gRPC Utility Functions
 */
import * as grpc from '@grpc/grpc-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PROTO_DIR = join(__dirname, '../../grpc/protos');

export const PROTO_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_DIR],
};

/**
 * Safely get property from object
 */
export function safeGetProperty<T>(obj: Record<string, unknown>, key: string): T | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key] as T;
  }
  return undefined;
}

/**
 * Create gRPC channel options
 */
export function createChannelOptions(): grpc.ChannelOptions {
  return {
    'grpc.keepalive_time_ms': config.GRPC_KEEPALIVE_TIME_MS,
    'grpc.keepalive_timeout_ms': config.GRPC_KEEPALIVE_TIMEOUT_MS,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.min_time_between_pings_ms': 10000,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.initial_reconnect_backoff_ms': 1000,
    'grpc.max_reconnect_backoff_ms': 30000,
    'grpc.enable_retries': 1,
    'grpc.service_config': JSON.stringify({
      loadBalancingConfig: [{ round_robin: {} }],
      methodConfig: [
        {
          name: [{}],
          retryPolicy: {
            maxAttempts: 3,
            initialBackoff: '0.1s',
            maxBackoff: '1s',
            backoffMultiplier: 2,
            retryableStatusCodes: ['UNAVAILABLE', 'DEADLINE_EXCEEDED'],
          },
        },
      ],
    }),
  };
}

/**
 * Create gRPC metadata
 */
export function createGrpcMetadata(locale?: string, clientUrl?: string): grpc.Metadata {
  const metadata = new grpc.Metadata();

  if (locale) {
    metadata.set('x-locale', locale);
    metadata.set('accept-language', locale);
  }

  if (clientUrl) {
    metadata.set('x-client-url', clientUrl);
  }

  return metadata;
}
