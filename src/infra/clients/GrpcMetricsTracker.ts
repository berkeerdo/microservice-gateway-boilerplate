/**
 * gRPC Metrics Tracker
 * Tracks metrics for gRPC client calls
 */
import type { ClientMetrics } from './grpc-types.js';

export class GrpcMetricsTracker {
  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private retriedCalls = 0;
  private totalLatencyMs = 0;
  private lastCallTime: Date | null = null;

  recordCallStart(): void {
    this.totalCalls++;
    this.lastCallTime = new Date();
  }

  recordSuccess(latencyMs: number): void {
    this.successfulCalls++;
    this.totalLatencyMs += latencyMs;
  }

  recordFailure(): void {
    this.failedCalls++;
  }

  recordRetry(): void {
    this.retriedCalls++;
  }

  getMetrics(): ClientMetrics {
    const averageLatencyMs =
      this.successfulCalls > 0 ? this.totalLatencyMs / this.successfulCalls : 0;

    return {
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      retriedCalls: this.retriedCalls,
      averageLatencyMs,
      lastCallTime: this.lastCallTime,
    };
  }

  reset(): void {
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.retriedCalls = 0;
    this.totalLatencyMs = 0;
    this.lastCallTime = null;
  }
}
