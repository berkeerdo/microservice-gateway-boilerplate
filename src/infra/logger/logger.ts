import type { Logger as PinoLogger } from 'pino';
import pino from 'pino';
import config from '../../config/env.js';

export type Logger = PinoLogger;

/**
 * Sensitive data paths to redact from logs
 */
const REDACT_PATHS = [
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'body.password',
  'body.token',
  'body.creditCard',
  'body.cardNumber',
  'body.cvv',
  'connectionString',
  'DB_PASSWORD',
  'REDIS_PASSWORD',
];

/**
 * Singleton Logger Factory
 */
class LoggerFactory {
  private static instance: Logger | null = null;

  static getInstance(): Logger {
    if (!this.instance) {
      this.instance = this.createLogger();
    }
    return this.instance;
  }

  private static createLogger(): Logger {
    const isDevelopment = config.NODE_ENV === 'development';
    const isTest = config.NODE_ENV === 'test';

    if (isTest) {
      return pino({ level: 'silent' });
    }

    if (isDevelopment) {
      return pino({
        level: config.LOG_LEVEL,
        redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      });
    }

    return pino({
      level: config.LOG_LEVEL,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      formatters: { level: (label) => ({ level: label }) },
      base: { service: config.SERVICE_NAME, env: config.NODE_ENV },
    });
  }

  static createChild(bindings: Record<string, unknown>): Logger {
    return this.getInstance().child(bindings);
  }

  static createRequestLogger(requestId: string): Logger {
    return this.createChild({ requestId });
  }

  static reset(): void {
    this.instance = null;
  }
}

const logger = LoggerFactory.getInstance();

export default logger;
export { LoggerFactory };
