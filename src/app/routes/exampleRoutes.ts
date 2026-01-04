/**
 * Example Routes - Replace with your actual routes
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { container } from '../../container.js';
import type { ExampleServiceProxy } from '../../infra/clients/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

// Request/Response Schemas
const getByIdParamsSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const createBodySchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
});

const updateBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
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

export async function exampleRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /examples/:id - Get example by ID
  fastify.get<{ Params: z.infer<typeof getByIdParamsSchema> }>(
    '/:id',
    {
      schema: {
        tags: ['Example'],
        summary: 'Get example by ID',
        params: zodToJsonSchema(getByIdParamsSchema),
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof getByIdParamsSchema> }>, reply: FastifyReply) => {
      const params = getByIdParamsSchema.parse(request.params);
      const locale = extractLanguage(request);

      const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
      const result = await exampleProxy.getById(params.id, locale);

      if (!result.success || !result.data) {
        throw new NotFoundError('Example', params.id);
      }

      return reply.send(result.data);
    }
  );

  // GET /examples - List examples
  fastify.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    '/',
    {
      schema: {
        tags: ['Example'],
        summary: 'List examples',
        querystring: zodToJsonSchema(listQuerySchema),
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: z.infer<typeof listQuerySchema> }>, reply: FastifyReply) => {
      const query = listQuerySchema.parse(request.query);
      const locale = extractLanguage(request);

      const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
      const result = await exampleProxy.list(query.page, query.limit, locale);

      if (!result.success) {
        throw new ValidationError(result.error || 'Failed to list examples');
      }

      return reply.send(result.data);
    }
  );

  // POST /examples - Create example
  fastify.post<{ Body: z.infer<typeof createBodySchema> }>(
    '/',
    {
      schema: {
        tags: ['Example'],
        summary: 'Create example',
        body: zodToJsonSchema(createBodySchema),
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof createBodySchema> }>, reply: FastifyReply) => {
      const body = createBodySchema.parse(request.body);
      const locale = extractLanguage(request);

      const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
      const result = await exampleProxy.create(body, locale);

      if (!result.success) {
        throw new ValidationError(result.error || 'Failed to create example');
      }

      return reply.status(201).send(result.data);
    }
  );

  // PATCH /examples/:id - Update example
  fastify.patch<{ Params: z.infer<typeof getByIdParamsSchema>; Body: z.infer<typeof updateBodySchema> }>(
    '/:id',
    {
      schema: {
        tags: ['Example'],
        summary: 'Update example',
        params: zodToJsonSchema(getByIdParamsSchema),
        body: zodToJsonSchema(updateBodySchema),
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: z.infer<typeof getByIdParamsSchema>; Body: z.infer<typeof updateBodySchema> }>,
      reply: FastifyReply
    ) => {
      const params = getByIdParamsSchema.parse(request.params);
      const body = updateBodySchema.parse(request.body);
      const locale = extractLanguage(request);

      const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
      const result = await exampleProxy.update({ id: params.id, ...body }, locale);

      if (!result.success) {
        throw new NotFoundError('Example', params.id);
      }

      return reply.send(result.data);
    }
  );

  // DELETE /examples/:id - Delete example
  fastify.delete<{ Params: z.infer<typeof getByIdParamsSchema> }>(
    '/:id',
    {
      schema: {
        tags: ['Example'],
        summary: 'Delete example',
        params: zodToJsonSchema(getByIdParamsSchema),
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof getByIdParamsSchema> }>, reply: FastifyReply) => {
      const params = getByIdParamsSchema.parse(request.params);
      const locale = extractLanguage(request);

      const exampleProxy = container.resolve<ExampleServiceProxy>('exampleServiceProxy');
      const result = await exampleProxy.delete(params.id, locale);

      if (!result.success) {
        throw new NotFoundError('Example', params.id);
      }

      return reply.status(204).send();
    }
  );
}
