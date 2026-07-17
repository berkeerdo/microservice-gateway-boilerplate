# Gateway Boilerplate

Production-ready API Gateway boilerplate with Fastify and gRPC.

## Features

- **Fastify 5** - High-performance web framework
- **gRPC Clients** - Resilient gRPC clients (grpc-resilient) with retry and auto-reconnect; non-idempotent calls are never auto-retried
- **Awilix DI** - Dependency injection with PROXY mode
- **Zod v4 Validation** - fastify-type-provider-zod: schemas validate, type AND document routes
- **Pino Logging** - Structured logging with redaction
- **Redis Rate Limiting** - Distributed rate limiting
- **OpenTelemetry** - Distributed tracing
- **Sentry** - Error tracking and performance monitoring
- **Prometheus Metrics** - Application metrics
- **i18n** - Internationalization support (EN, TR)
- **Load Shedding** - @fastify/under-pressure returns 503 + Retry-After under saturation
- **Graceful Shutdown** - Clean resource cleanup
- **TypeScript** - Full type safety

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Pairs with berkeerdo/microservice-boilerplate as the downstream:
# run it with GRPC_ENABLED=true (gRPC on :50051) and the /examples
# routes work end-to-end out of the box

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/
│   ├── routes/           # HTTP routes
│   ├── middlewares/      # Request middlewares
│   └── plugins/          # Fastify plugins (Swagger)
├── config/               # Environment configuration
├── infra/
│   ├── clients/          # gRPC clients
│   ├── health/           # Health checks
│   ├── logger/           # Logging
│   ├── monitoring/       # Metrics, Sentry, Tracing
│   ├── redis/            # Redis client
│   └── shutdown/         # Graceful shutdown
├── shared/
│   ├── errors/           # Error classes & handler
│   ├── i18n/             # Translations
│   └── utils/            # Utilities
├── grpc/
│   └── protos/           # Protocol Buffer definitions
├── types/                # Type definitions
├── container.ts          # DI container
├── index.ts              # Entry point
└── instrumentation.ts    # OpenTelemetry setup
```

## Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness probe |
| `GET /ready` | Readiness probe |
| `GET /status` | Full health status |
| `GET /metrics` | Prometheus metrics |
| `GET /docs` | Swagger UI (dev only) |

## Configuration

All configuration is done via environment variables. See `.env.example` for available options.

### Key Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |
| `REDIS_ENABLED` | Enable Redis | `true` |
| `GRPC_USE_TLS` | Enable gRPC TLS | `false` |
| `OTEL_ENABLED` | Enable OpenTelemetry | `false` |

## Adding a New Service

1. **Create Proto File**
   ```bash
   src/grpc/protos/myservice/my_service.proto
   ```

2. **Create gRPC Client**
   ```bash
   src/infra/clients/myservice/MyServiceGrpcClient.ts
   src/infra/clients/myservice/MyServiceProxy.ts
   ```

3. **Register in Container**
   ```typescript
   // src/container.ts
   myServiceProxy: asClass(MyServiceProxy).singleton(),
   ```

4. **Create Routes**
   ```bash
   src/app/routes/myRoutes.ts
   ```

5. **Update Environment Schema**
   ```typescript
   // src/config/env.schema.ts
   MY_SERVICE_GRPC_URL: z.string().default('localhost:50052'),
   ```

## Scripts

```bash
npm run dev          # Development with hot reload (observability preloaded)
npm run build        # Build for production
npm start            # Production server (observability preloaded)
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint check
npm run lint:fix     # ESLint fix
npm run typecheck    # TypeScript check
```

## gRPC Client Features

- **Lazy Connection** - Connects on first call
- **Auto-Reconnect** - Reconnects on connection loss
- **Retry with Backoff** - Exponential backoff with jitter
- **Metrics** - Success/failure/latency tracking
- **TLS/mTLS Support** - Secure connections

## Observability

### Logging
- Structured JSON logs in production
- Pretty-printed in development
- Sensitive data redaction

### Metrics
- HTTP request duration/count
- gRPC call duration/count
- Rate limit hits
- Active requests

### Tracing
- OpenTelemetry integration
- Automatic instrumentation
- OTLP exporter

### Error Tracking
- Sentry integration
- Smart sampling
- Request context

## License

MIT
