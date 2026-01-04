/**
 * Prometheus Metrics Service
 */
import client, { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import config from '../../config/env.js';

const registry = new Registry();

registry.setDefaultLabels({
  service: config.SERVICE_NAME,
  version: config.SERVICE_VERSION,
});

collectDefaultMetrics({
  register: registry,
  prefix: 'gateway_',
});

const httpRequestsTotal = new Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

const httpRequestDuration = new Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const grpcCallsTotal = new Counter({
  name: 'gateway_grpc_calls_total',
  help: 'Total number of gRPC calls to backend services',
  labelNames: ['service', 'method', 'status'] as const,
  registers: [registry],
});

const grpcCallDuration = new Histogram({
  name: 'gateway_grpc_call_duration_seconds',
  help: 'gRPC call duration in seconds',
  labelNames: ['service', 'method', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const circuitBreakerState = new Gauge({
  name: 'gateway_circuit_breaker_state',
  help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
  labelNames: ['service'] as const,
  registers: [registry],
});

const activeRequests = new Gauge({
  name: 'gateway_active_requests',
  help: 'Number of currently active HTTP requests',
  registers: [registry],
});

const rateLimitHitsTotal = new Counter({
  name: 'gateway_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['key_type', 'endpoint'] as const,
  registers: [registry],
});

const authFailuresTotal = new Counter({
  name: 'gateway_auth_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['error_code', 'endpoint'] as const,
  registers: [registry],
});

const tokenValidationTotal = new Counter({
  name: 'gateway_token_validation_total',
  help: 'Total number of token validation attempts',
  labelNames: ['result', 'source'] as const,
  registers: [registry],
});

function normalizeRoute(route: string): string {
  if (!route) {
    return 'unknown';
  }
  return route
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\?.*$/, '')
    .replace(/^([^/])/, '/$1');
}

export const metrics = {
  get contentType(): string {
    return client.contentType;
  },

  async getMetrics(): Promise<string> {
    return registry.metrics();
  },

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = {
      method: method.toUpperCase(),
      route: normalizeRoute(route),
      status_code: String(statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationMs / 1000);
  },

  recordGrpcCall(service: string, method: string, status: 'success' | 'error', durationMs: number): void {
    const labels = { service, method, status };
    grpcCallsTotal.inc(labels);
    grpcCallDuration.observe(labels, durationMs / 1000);
  },

  updateCircuitBreaker(service: string, state: 'CLOSED' | 'HALF_OPEN' | 'OPEN'): void {
    const stateValue = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    circuitBreakerState.set({ service }, stateValue);
  },

  incrementActiveRequests(): void {
    activeRequests.inc();
  },

  decrementActiveRequests(): void {
    activeRequests.dec();
  },

  recordRateLimitHit(keyType: 'user' | 'ip' | 'correlation_id', endpoint: string): void {
    rateLimitHitsTotal.inc({ key_type: keyType, endpoint: normalizeRoute(endpoint) });
  },

  recordAuthFailure(errorCode: string, endpoint: string): void {
    authFailuresTotal.inc({ error_code: errorCode, endpoint: normalizeRoute(endpoint) });
  },

  recordTokenValidation(
    result: 'success' | 'failure' | 'expired' | 'invalid',
    source: 'cookie' | 'header' | 'query'
  ): void {
    tokenValidationTotal.inc({ result, source });
  },

  reset(): void {
    registry.resetMetrics();
  },
};

export default metrics;
