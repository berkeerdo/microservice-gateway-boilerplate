/**
 * gRPC Credentials Provider
 * Handles TLS/mTLS configuration for gRPC clients
 */
import * as grpc from '@grpc/grpc-js';
import * as fs from 'fs';
import config from '../../config/env.js';
import logger from '../logger/logger.js';

interface CredentialOptions {
  serviceName: string;
}

/**
 * Create gRPC credentials based on configuration
 */
export function createGrpcCredentials(options: CredentialOptions): grpc.ChannelCredentials {
  if (!config.GRPC_USE_TLS) {
    logger.debug({ service: options.serviceName }, 'Using insecure gRPC credentials');
    return grpc.credentials.createInsecure();
  }

  try {
    let rootCerts: Buffer | null = null;
    let privateKey: Buffer | null = null;
    let certChain: Buffer | null = null;

    // Load CA certificate if provided
    if (config.GRPC_TLS_CA_PATH) {
      rootCerts = fs.readFileSync(config.GRPC_TLS_CA_PATH);
      logger.debug({ service: options.serviceName }, 'Loaded CA certificate');
    }

    // Load client certificate and key for mTLS
    if (config.GRPC_TLS_CLIENT_CERT_PATH && config.GRPC_TLS_CLIENT_KEY_PATH) {
      certChain = fs.readFileSync(config.GRPC_TLS_CLIENT_CERT_PATH);
      privateKey = fs.readFileSync(config.GRPC_TLS_CLIENT_KEY_PATH);
      logger.debug({ service: options.serviceName }, 'Loaded client certificate for mTLS');
    }

    logger.info({ service: options.serviceName }, 'Using TLS gRPC credentials');
    return grpc.credentials.createSsl(rootCerts, privateKey, certChain);
  } catch (error) {
    logger.error({ service: options.serviceName, err: error }, 'Failed to load TLS credentials');
    throw error;
  }
}
