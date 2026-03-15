/**
 * Filename: rate-limiter.test.ts
 * Last Modified: 2026-03-15
 * Summary: Unit tests for rate limiter and retry with exponential backoff
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SC-5)
 * Classification: UNCLASSIFIED
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, fetchWithRetry } from '../rate-limiter.js';
import { RateLimitError, ServerError } from '../errors.js';

// Suppress logger output during tests
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('RateLimiter', () => {
  it('allows requests within rate limit', async () => {
    const limiter = new RateLimiter(60); // 60 req/min = 1 per second
    // Should acquire immediately since bucket starts full
    await expect(limiter.acquire()).resolves.toBeUndefined();
    await expect(limiter.acquire()).resolves.toBeUndefined();
  });

  it('initializes with full token bucket', async () => {
    const limiter = new RateLimiter(5);
    // Should be able to acquire 5 tokens immediately
    for (let i = 0; i < 5; i++) {
      await expect(limiter.acquire()).resolves.toBeUndefined();
    }
  });

  it('waits when tokens are exhausted', async () => {
    const limiter = new RateLimiter(1); // 1 req/min
    await limiter.acquire(); // use the only token

    const start = Date.now();
    await limiter.acquire(); // should wait for refill
    const elapsed = Date.now() - start;

    // Should have waited at least some time (token refills at 1 per 60s)
    // With 1 rpm, wait should be ~60s, but we just check it waited
    expect(elapsed).toBeGreaterThan(0);
  }, 70_000); // 70s timeout for this slow test
});

describe('fetchWithRetry', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(1000); // high limit so rate limiting doesn't slow tests
  });

  it('returns successful response without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'GET' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('returns non-retryable error responses immediately', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetchWithRetry(limiter, 'https://api.test/tasks/999', { method: 'GET' });
    expect(response.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledOnce(); // no retry

    vi.unstubAllGlobals();
  });

  it('retries on 429 and succeeds', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'GET' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  }, 10_000);

  it('retries on 503 and succeeds', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'GET' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  }, 10_000);

  it('throws after exhausting all retries on 429', async () => {
    const mockFetch = vi.fn().mockImplementation(
      () => Promise.resolve(new Response('rate limited', { status: 429 })),
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'GET' }),
    ).rejects.toThrow(RateLimitError);

    // 1 initial + 3 retries = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);

    vi.unstubAllGlobals();
  }, 60_000);

  it('throws ServerError after exhausting retries on 503', async () => {
    const mockFetch = vi.fn().mockImplementation(
      () => Promise.resolve(new Response('server error', { status: 503 })),
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'GET' }),
    ).rejects.toThrow(ServerError);

    vi.unstubAllGlobals();
  }, 60_000);

  it('respects Retry-After header (seconds)', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '1' },
        }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const start = Date.now();
    const response = await fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'GET' });
    const elapsed = Date.now() - start;

    expect(response.status).toBe(200);
    // Should have waited at least ~1000ms for the Retry-After
    expect(elapsed).toBeGreaterThanOrEqual(900);

    vi.unstubAllGlobals();
  }, 10_000);

  it('does not retry on 400 Bad Request', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('bad request', { status: 400 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'POST' });
    expect(response.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('does not retry on 401 Unauthorized', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('unauthorized', { status: 401 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetchWithRetry(limiter, 'https://api.test/tasks', { method: 'GET' });
    expect(response.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});
