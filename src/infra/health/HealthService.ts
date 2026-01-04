/**
 * Health Service
 * Centralized health checking for service proxies and dependencies
 */
import config from '../../config/env.js';
import { container } from '../../container.js';
import type { ExampleServiceProxy } from '../clients/index.js';
import { checkRedisHealth } from '../redis/redis.js';

export interface ComponentHealth {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'not_configured';
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  components: {
    exampleService?: ComponentHealth;
    redis?: ComponentHealth;
  };
}

class HealthServiceClass {
  checkExampleService(): ComponentHealth {
    try {
      const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
      const health = exampleProxy.getHealth();

      if (health.healthy) {
        return {
          status: 'healthy',
          latencyMs: health.latencyMs,
          message: 'gRPC connected',
          details: { state: health.state },
        };
      }

      return {
        status: 'unhealthy',
        message: 'gRPC disconnected',
        details: { state: health.state, error: health.error },
      };
    } catch {
      return { status: 'not_configured', message: 'Example service proxy not initialized' };
    }
  }

  async checkRedis(): Promise<ComponentHealth> {
    try {
      const result = await checkRedisHealth();

      if (!result.healthy) {
        return {
          status: 'unhealthy',
          message: result.message || 'Redis connection failed',
        };
      }

      if (result.message === 'Redis disabled') {
        return {
          status: 'not_configured',
          message: 'Redis is disabled',
        };
      }

      return {
        status: 'healthy',
        latencyMs: result.latencyMs,
        message: 'Redis connected',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: (error as Error).message,
      };
    }
  }

  async check(): Promise<HealthCheckResult> {
    const exampleService = this.checkExampleService();
    const redis = await this.checkRedis();

    const components = { exampleService, redis };
    const statuses = Object.values(components)
      .filter((c) => c.status !== 'not_configured')
      .map((c) => c.status);

    let overallStatus: HealthCheckResult['status'] = 'healthy';
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      uptime: process.uptime(),
      components,
    };
  }

  liveness(): { alive: boolean; uptime: number } {
    return {
      alive: true,
      uptime: process.uptime(),
    };
  }

  async readiness(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
    const result = await this.check();

    const checksEntries: [string, boolean][] = Object.entries(result.components)
      .filter(([, component]) => component && component.status !== 'not_configured')
      .map(([name, component]): [string, boolean] => [
        name,
        component.status === 'healthy' || component.status === 'degraded',
      ]);
    const checks: Record<string, boolean> = Object.fromEntries(checksEntries);

    const ready = result.status !== 'unhealthy';

    return { ready, checks };
  }
}

export const HealthService = new HealthServiceClass();
