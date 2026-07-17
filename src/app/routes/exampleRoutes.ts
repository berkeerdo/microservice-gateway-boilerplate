/**
 * Example Routes - Replace with your actual routes
 *
 * Uses fastify-type-provider-zod: zod schemas validate AND type the routes,
 * and feed @fastify/swagger via jsonSchemaTransform (see plugins/swagger.ts).
 * Errors thrown by the proxy are typed AppErrors rendered by the global
 * error handler - routes never inspect envelopes or map statuses themselves.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { container } from '../../container.js';
import type { ExampleServiceProxy } from '../../infra/clients/index.js';

// Request schemas
const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const createBodySchema = z.object({
  name: z.string().min(1).max(100),
});

const updateBodySchema = z.object({
  name: z.string().min(1).max(100),
});

// Response schemas (microservice contract: snake_case timestamps)
const exampleSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const listResponseSchema = z.object({
  items: z.array(exampleSchema),
  total: z.number(),
});

// Extract language from request headers
function extractLanguage(request: FastifyRequest): string {
  const xLang = request.headers['x-language'];
  if (typeof xLang === 'string') {
    return xLang;
  }
  const acceptLang = request.headers['accept-language'];
  if (typeof acceptLang === 'string') {
    return acceptLang.split(',')[0]?.split('-')[0] || 'en';
  }
  return 'en';
}

function resolveProxy(): ExampleServiceProxy {
  return container.resolve<ExampleServiceProxy>('exampleServiceProxy');
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export async function exampleRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /examples/:id - Get example by ID
  app.get(
    '/:id',
    {
      schema: {
        tags: ['Example'],
        summary: 'Get example by ID',
        params: idParamSchema,
        response: { 200: exampleSchema },
      },
    },
    async (request, reply) => {
      const example = await resolveProxy().getById(request.params.id, extractLanguage(request));
      return reply.send(example);
    }
  );

  // GET /examples - List examples
  app.get(
    '/',
    {
      schema: {
        tags: ['Example'],
        summary: 'List examples',
        querystring: listQuerySchema,
        response: { 200: listResponseSchema },
      },
    },
    async (request, reply) => {
      const { limit, offset } = request.query;
      const result = await resolveProxy().list(limit, offset, extractLanguage(request));
      return reply.send(result);
    }
  );

  // POST /examples - Create example
  app.post(
    '/',
    {
      schema: {
        tags: ['Example'],
        summary: 'Create example',
        body: createBodySchema,
        response: { 201: exampleSchema },
      },
    },
    async (request, reply) => {
      const example = await resolveProxy().create(request.body.name, extractLanguage(request));
      return reply.status(201).send(example);
    }
  );

  // PATCH /examples/:id - Update example
  app.patch(
    '/:id',
    {
      schema: {
        tags: ['Example'],
        summary: 'Update example',
        params: idParamSchema,
        body: updateBodySchema,
        response: { 200: exampleSchema },
      },
    },
    async (request, reply) => {
      const example = await resolveProxy().update(
        request.params.id,
        request.body.name,
        extractLanguage(request)
      );
      return reply.send(example);
    }
  );

  // DELETE /examples/:id - Delete example
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Example'],
        summary: 'Delete example',
        params: idParamSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await resolveProxy().delete(request.params.id, extractLanguage(request));
      return reply.status(204).send(null);
    }
  );
}
