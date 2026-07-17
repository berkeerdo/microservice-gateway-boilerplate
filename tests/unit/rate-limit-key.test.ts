/**
 * Rate-limit key generator tests
 *
 * The key must NEVER come from client-controlled headers (correlation id):
 * rotating such a header per request would put every request in its own
 * bucket and disable the limiter entirely.
 */
import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { rateLimitKeyGenerator } from '../../src/app/middlewares/rateLimiter.js';

function fakeRequest(overrides: Partial<FastifyRequest> & Record<string, unknown>): FastifyRequest {
  return { ip: '203.0.113.7', ...overrides } as unknown as FastifyRequest;
}

describe('rateLimitKeyGenerator', () => {
  it('keys authenticated requests by user id', () => {
    const request = fakeRequest({ userId: '123' });
    expect(rateLimitKeyGenerator(request)).toBe('user:123');
  });

  it('keys anonymous requests by IP', () => {
    const request = fakeRequest({});
    expect(rateLimitKeyGenerator(request)).toBe('203.0.113.7');
  });

  it('ignores client-supplied correlation id (bypass prevention)', () => {
    const request = fakeRequest({ correlationId: 'attacker-rotated-value' });
    expect(rateLimitKeyGenerator(request)).toBe('203.0.113.7');
  });
});
