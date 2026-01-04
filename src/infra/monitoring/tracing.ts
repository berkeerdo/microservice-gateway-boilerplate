/**
 * OpenTelemetry Tracing - Re-export
 *
 * All OpenTelemetry configuration is in src/instrumentation.ts
 * OpenTelemetry is initialized via --import flag in package.json
 */

export { shutdownTracing } from '../../instrumentation.js';
