/**
 * Base gRPC Client
 * Resilient gRPC client with lazy connection, auto-reconnect, and retry logic
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import logger from '../logger/logger.js';
import { DEFAULT_ERROR_MESSAGE } from '../../shared/errors/errorSanitizer.js';
import { createGrpcCredentials } from './GrpcCredentialsProvider.js';
import {
  isRetryableError,
  isConnectionError,
  calculateBackoffDelay,
  sleep,
  logRetryAttempt,
} from './GrpcRetryHandler.js';
import {
  ConnectionState,
  DEFAULT_CONFIG,
  type GrpcClientConfig,
  type GrpcCallOptions,
  type ServiceHealth,
  type ClientMetrics,
} from './grpc-types.js';
import { GrpcMetricsTracker } from './GrpcMetricsTracker.js';
import { PROTO_OPTIONS, PROTO_DIR, safeGetProperty, createChannelOptions, createGrpcMetadata } from './grpc-utils.js';

export abstract class BaseGrpcClient<TClient extends grpc.Client> extends EventEmitter {
  protected client: TClient | null = null;
  protected config: Required<GrpcClientConfig>;
  protected state: ConnectionState = ConnectionState.DISCONNECTED;
  protected reconnectAttempts = 0;
  protected reconnectTimer: NodeJS.Timeout | null = null;
  protected lastConnectedAt: Date | null = null;
  protected lastErrorAt: Date | null = null;
  protected lastError: string | null = null;
  protected lastLatencyMs = 0;
  protected connectPromise: Promise<void> | null = null;
  protected isShuttingDown = false;
  protected readonly metricsTracker: GrpcMetricsTracker;

  constructor(clientConfig: GrpcClientConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...clientConfig };
    this.metricsTracker = new GrpcMetricsTracker();
  }

  async ensureConnected(): Promise<boolean> {
    if (this.state === ConnectionState.CONNECTED && this.client) {
      return true;
    }

    if (this.connectPromise) {
      try {
        await this.connectPromise;
        return this.state === ConnectionState.CONNECTED;
      } catch {
        return false;
      }
    }

    this.connectPromise = this.connect();
    try {
      await this.connectPromise;
      return this.state === ConnectionState.CONNECTED;
    } catch {
      return false;
    } finally {
      this.connectPromise = null;
    }
  }

  private async handleRetryError(
    error: Error,
    methodName: string,
    attempt: number,
    maxAttempts: number
  ): Promise<boolean> {
    this.lastErrorAt = new Date();
    this.lastError = error.message;

    if (attempt > 0) {
      this.metricsTracker.recordRetry();
    }
    if (!isRetryableError(error) || attempt >= maxAttempts - 1) {
      return false;
    }
    if (isConnectionError(error)) {
      this.handleConnectionLost();
    }

    const delay = calculateBackoffDelay(this.config.retryDelayMs, attempt);
    logRetryAttempt(this.config.serviceName, methodName, attempt, maxAttempts, delay, error.message);
    await sleep(delay);
    return true;
  }

  public async callWithRetry<TRequest, TResponse>(
    methodName: string,
    request: TRequest,
    options?: GrpcCallOptions | string
  ): Promise<TResponse> {
    const callOptions: GrpcCallOptions =
      typeof options === 'string' ? { locale: options } : options || {};
    const { timeoutMs, locale, clientUrl, skipRetry } = callOptions;
    const maxAttempts = skipRetry ? 1 : this.config.retryCount + 1;
    let lastError: Error | null = null;

    this.metricsTracker.recordCallStart();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const connected = await this.ensureConnected();
        if (!connected) {
          throw new Error(`${this.config.serviceName} is not available`);
        }

        const startTime = Date.now();
        const response = await this.executeCall<TRequest, TResponse>(
          methodName,
          request,
          locale,
          timeoutMs,
          clientUrl
        );
        this.lastLatencyMs = Date.now() - startTime;
        this.metricsTracker.recordSuccess(this.lastLatencyMs);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const shouldRetry = await this.handleRetryError(lastError, methodName, attempt, maxAttempts);
        if (!shouldRetry) {
          break;
        }
      }
    }

    this.metricsTracker.recordFailure();
    throw lastError ?? new Error('Unknown gRPC error');
  }

  getHealth(): ServiceHealth {
    return {
      state: this.state,
      healthy: this.state === ConnectionState.CONNECTED,
      latencyMs: this.lastLatencyMs,
      lastCheck: new Date(),
      lastConnectedAt: this.lastConnectedAt,
      lastErrorAt: this.lastErrorAt,
      error: this.lastError ?? undefined,
      reconnectAttempts: this.reconnectAttempts,
      metrics: this.metricsTracker.getMetrics(),
    };
  }

  getMetrics(): ClientMetrics {
    return this.metricsTracker.getMetrics();
  }

  resetMetrics(): void {
    this.metricsTracker.reset();
  }

  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED && this.client !== null;
  }

  close(): void {
    this.isShuttingDown = true;
    this.stopReconnectTimer();

    if (this.client) {
      this.client.close();
      this.client = null;
    }

    this.state = ConnectionState.DISCONNECTED;
    this.emit('disconnected');
    logger.info({ service: this.config.serviceName }, 'gRPC client closed');
  }

  private createGrpcClient(): TClient {
    const protoPath = join(PROTO_DIR, this.config.protoFile);
    const packageDefinition = protoLoader.loadSync(protoPath, PROTO_OPTIONS);
    const proto = grpc.loadPackageDefinition(packageDefinition);

    const packageParts = this.config.packageName.split('.');
    let current: grpc.GrpcObject = proto;
    for (const part of packageParts) {
      const next = safeGetProperty<grpc.GrpcObject>(current as Record<string, unknown>, part);
      if (!next) {
        throw new Error(`Package part '${part}' not found in proto`);
      }
      current = next;
    }

    const ServiceClass = safeGetProperty<grpc.ServiceClientConstructor>(
      current as Record<string, unknown>,
      this.config.serviceClassName
    );
    if (!ServiceClass) {
      throw new Error(`Service class '${this.config.serviceClassName}' not found`);
    }

    const credentials = createGrpcCredentials({ serviceName: this.config.serviceName });
    return new ServiceClass(this.config.grpcUrl, credentials, createChannelOptions()) as unknown as TClient;
  }

  private handleConnectError(error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.lastErrorAt = new Date();
    this.lastError = errorMessage;
    this.state = ConnectionState.DISCONNECTED;
    this.emit('error', error);
    logger.warn(
      {
        service: this.config.serviceName,
        url: this.config.grpcUrl,
        error: errorMessage,
        reconnectAttempts: this.reconnectAttempts,
      },
      'gRPC client connection failed, will retry in background'
    );
    this.scheduleReconnect();
    throw error;
  }

  private async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Client is shutting down');
    }

    this.state = this.reconnectAttempts > 0 ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING;
    this.emit('connecting');

    try {
      this.client = this.createGrpcClient();
      await this.waitForReady();

      this.state = ConnectionState.CONNECTED;
      this.lastConnectedAt = new Date();
      this.reconnectAttempts = 0;
      this.lastError = null;
      this.emit('connected');
      logger.info({ service: this.config.serviceName, url: this.config.grpcUrl }, 'gRPC client connected');
      this.monitorConnection();
    } catch (error) {
      this.handleConnectError(error);
    }
  }

  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client not initialized'));
        return;
      }

      const deadline = new Date(Date.now() + this.config.timeoutMs);
      this.client.waitForReady(deadline, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private monitorConnection(): void {
    if (!this.client) {
      return;
    }

    const channel = this.client.getChannel();
    const checkState = (): void => {
      if (this.isShuttingDown || !this.client) {
        return;
      }

      const state = channel.getConnectivityState(false);

      if (
        state === grpc.connectivityState.TRANSIENT_FAILURE ||
        state === grpc.connectivityState.SHUTDOWN
      ) {
        this.handleConnectionLost();
      } else if (state === grpc.connectivityState.READY) {
        setTimeout(checkState, 5000);
      } else {
        setTimeout(checkState, 1000);
      }
    };

    setTimeout(checkState, 5000);
  }

  private handleConnectionLost(): void {
    if (this.state !== ConnectionState.CONNECTED) {
      return;
    }

    this.state = ConnectionState.DISCONNECTED;
    this.emit('disconnected');
    logger.warn({ service: this.config.serviceName }, 'gRPC connection lost, reconnecting...');

    if (this.client) {
      try {
        this.client.close();
      } catch {
        // Ignore close errors
      }
      this.client = null;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error(
        { service: this.config.serviceName, attempts: this.reconnectAttempts },
        'Max reconnect attempts reached, giving up'
      );
      return;
    }

    const baseDelay = this.config.initialReconnectDelayMs * Math.pow(2, this.reconnectAttempts);
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.config.maxReconnectDelayMs);

    this.reconnectAttempts++;

    logger.debug(
      { service: this.config.serviceName, attempt: this.reconnectAttempts, delayMs: Math.round(delay) },
      'Scheduling reconnect'
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // connect() will schedule another reconnect on failure
      }
    }, delay);
  }

  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private executeCall<TRequest, TResponse>(
    methodName: string,
    request: TRequest,
    locale?: string,
    timeoutMs?: number,
    clientUrl?: string
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error(`${this.config.serviceName} client not connected`));
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const method = safeGetProperty<(...args: any[]) => void>(
        this.client as unknown as Record<string, unknown>,
        methodName
      );

      if (!method) {
        reject(new Error(`Method ${methodName} not found on ${this.config.serviceName}`));
        return;
      }

      const deadline = new Date(Date.now() + (timeoutMs ?? this.config.timeoutMs));
      method.call(
        this.client,
        request,
        createGrpcMetadata(locale, clientUrl),
        { deadline },
        (error: grpc.ServiceError | null, response: TResponse) => {
          if (error) {
            reject(this.mapGrpcError(error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  private mapGrpcError(error: grpc.ServiceError): Error {
    const errorMessage = error.details || error.message || DEFAULT_ERROR_MESSAGE;
    const mappedError = new Error(errorMessage);
    (mappedError as Error & { code: number }).code = error.code;
    (mappedError as Error & { grpcCode: number }).grpcCode = error.code;
    return mappedError;
  }
}

export { ConnectionState } from './grpc-types.js';
export type { GrpcClientConfig, ServiceHealth, GrpcCallOptions } from './grpc-types.js';
