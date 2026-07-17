/**
 * Sentry Error Tracking and Performance Monitoring
 */
import * as Sentry from '@sentry/node';
import type { SamplingContext } from '@sentry/core';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import config from '../../config/env.js';
import logger from '../logger/logger.js';

interface SafeSamplingContext {
  name?: string;
  parentSampled?: boolean;
  attributes?: Record<string, unknown>;
}

let isInitialized = false;

function getDefaultSampleRate(): number {
  switch (config.NODE_ENV) {
    case 'development':
      return 1.0;
    case 'test':
      return 0.0;
    case 'staging':
      return 0.2;
    case 'production':
      return 0.05;
  }
}

function extractUrlFromAttributes(attributes: Record<string, unknown> | undefined): string {
  if (!attributes) {
    return '';
  }
  const httpTarget = attributes['http.target'];
  return typeof httpTarget === 'string' ? httpTarget : '';
}

function tracesSampler(samplingContext: SamplingContext): number {
  const ctx = samplingContext as unknown as SafeSamplingContext;
  const { name, parentSampled, attributes } = ctx;

  if (parentSampled !== undefined) {
    return parentSampled ? 1.0 : 0;
  }

  const url: string = name || extractUrlFromAttributes(attributes);

  if (url.includes('/health') || url.includes('/ready') || url.includes('/status')) {
    return 0;
  }

  if (url.includes('/metrics') || url.includes('/_')) {
    return 0;
  }

  const configuredRate = config.SENTRY_TRACES_SAMPLE_RATE;
  if (configuredRate !== undefined && configuredRate >= 0) {
    return configuredRate;
  }

  return getDefaultSampleRate();
}

export interface InitializeSentryOptions {
  /**
   * Set to true when the application runs its own OpenTelemetry NodeSDK
   * (see src/instrumentation.ts). Sentry then skips its internal OTel setup
   * and its sampler/processor/propagator are wired into the app's SDK instead.
   * @see https://docs.sentry.io/platforms/javascript/guides/node/opentelemetry/custom-setup/
   */
  skipOpenTelemetrySetup?: boolean;
}

export function initializeSentry(options: InitializeSentryOptions = {}): void {
  if (!config.SENTRY_DSN) {
    logger.info('Sentry DSN not configured, error tracking disabled');
    return;
  }

  if (isInitialized) {
    logger.warn('Sentry already initialized');
    return;
  }

  const effectiveSampleRate = config.SENTRY_TRACES_SAMPLE_RATE ?? getDefaultSampleRate();

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT || config.NODE_ENV,
    release: `${config.SERVICE_NAME}@${config.SERVICE_VERSION}`,
    tracesSampler,
    profilesSampleRate: effectiveSampleRate,
    enabled: config.NODE_ENV !== 'test',

    // When the app owns the OTel SDK, Sentry must not install a second one
    skipOpenTelemetrySetup: options.skipOpenTelemetrySetup ?? false,
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
      Sentry.httpIntegration({ spans: true }),
      Sentry.redisIntegration(),
      nodeProfilingIntegration(),
    ],
    beforeSend(event) {
      event.tags = {
        ...event.tags,
        service: config.SERVICE_NAME,
        environment: config.NODE_ENV,
      };
      return event;
    },
    beforeSendTransaction(event) {
      event.tags = {
        ...event.tags,
        service: config.SERVICE_NAME,
      };
      return event;
    },
  });

  isInitialized = true;
  logger.info(
    `Sentry initialized (env: ${config.NODE_ENV}, traces: ${effectiveSampleRate * 100}%)`
  );
}

export function captureException(error: Error, context?: Record<string, unknown>): string {
  if (!isInitialized) {
    logger.error({ err: error, context }, 'Error captured but Sentry not initialized');
    return '';
  }

  return Sentry.captureException(error, { extra: context });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  if (!isInitialized) {
    logger.info({ message, level, context }, 'Message captured but Sentry not initialized');
    return '';
  }

  return Sentry.captureMessage(message, { level, extra: context });
}

export function setUser(user: { id: string; email?: string; username?: string }): void {
  if (isInitialized) {
    Sentry.setUser(user);
  }
}

export function clearUser(): void {
  if (isInitialized) {
    Sentry.setUser(null);
  }
}

export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  if (isInitialized) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!isInitialized) {
    return true;
  }

  logger.info('Flushing Sentry events...');
  return Sentry.flush(timeout);
}

export async function closeSentry(): Promise<void> {
  if (isInitialized) {
    await Sentry.close();
    isInitialized = false;
    logger.info('Sentry closed');
  }
}
