# Gateway Boilerplate

Production-ready API Gateway: Fastify 5 HTTP edge, gRPC to downstream microservices.

## Tech Stack
- **Runtime**: Node.js 22.11+ / 24 LTS (ESM)
- **Framework**: Fastify 5 + fastify-type-provider-zod (zod v4 validation/serialization)
- **Downstream**: gRPC via grpc-resilient GatewayGrpcClient (retry, reconnect, TLS)
- **Rate limiting**: @fastify/rate-limit + Redis store (distributed), key = user id or IP
- **Auth**: @fastify/jwt local verification (`fastify.authenticateGrpc` preHandler)
- **Load shedding**: @fastify/under-pressure (503 + Retry-After)
- **Observability**: OpenTelemetry + Sentry preloaded via `--import ./src/instrumentation.ts`, Prometheus at `/metrics`
- **DI**: Awilix

## Architecture
```
src/
├── app/
│   ├── routes/        # zod-typed routes (withTypeProvider<ZodTypeProvider>)
│   ├── middlewares/   # correlationId, requestLogger, requestMetrics, rateLimiter, grpcAuth
│   └── plugins/       # swagger (jsonSchemaTransform)
├── infra/
│   ├── clients/       # GatewayGrpcClient subclasses + ServiceProxy per downstream
│   ├── redis/         # ioredis (rate-limit store)
│   ├── monitoring/    # metrics (prom-client), sentry
│   └── shutdown/      # graceful shutdown
├── grpc/protos/       # downstream contracts (microservice/service.proto)
└── shared/
    ├── errors/        # AppError classes + global error handler
    └── i18n/          # TR/EN translations
```

## Error mapping (the core gateway invariant)
Downstream business errors arrive as RESOLVED gRPC responses with an envelope
(`{ success: false, status_code, error }`) - the ServiceProxy maps them to typed
AppErrors (404 -> NotFoundError, 409 -> ConflictError, ...). Thrown transport
errors map by gRPC code (UNAVAILABLE -> 503, DEADLINE_EXCEEDED -> 504, other ->
502). Routes never inspect envelopes; the global errorHandler renders AppErrors.
A downstream outage must NEVER surface as 200/400/404.

## Retry policy
`callWithRetry` retries only transient transport codes. Non-idempotent methods
(Create/Update) pass `skipRetry: true` per RFC 9110; Delete/Get/List may retry.

## Downstream contract
`src/grpc/protos/microservice/service.proto` is byte-identical to the sibling
`microservice-boilerplate` proto - the two templates work together out of the
box (`EXAMPLE_SERVICE_GRPC_URL=localhost:50051`, downstream `GRPC_ENABLED=true`).

## Key Commands
```bash
npm run dev        # tsx watch, instrumentation preloaded
npm run build      # tsc + copy protos
npm test           # vitest run (unit + integration, no external deps needed)
npm run lint       # ESLint 10 flat config
npm run typecheck  # tsc --noEmit (TypeScript 6)
```

## Health Endpoints
- `/health` — liveness: process only, NEVER checks dependencies
- `/ready` — readiness: downstream/Redis checks gate traffic
- `/status` — full component report
- `/metrics` — Prometheus (rate-limit exempt, protect in production)

## Adding a new downstream service
1. Drop its proto under `src/grpc/protos/<name>/`
2. Subclass `GatewayGrpcClient` (see ExampleGrpcClient)
3. Wrap it in a ServiceProxy that maps envelope + transport errors to AppErrors
4. Register in container.ts, add routes with zod schemas
