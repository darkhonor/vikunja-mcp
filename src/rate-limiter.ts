/**
 * Filename: rate-limiter.ts
 * Last Modified: 2026-03-15
 * Summary: Token-bucket rate limiter with retry and exponential backoff
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SC-5)
 * Classification: UNCLASSIFIED
 */

import { logger } from './logger.js';
import { RateLimitError } from './errors.js';

/** Default configuration constants. */
const DEFAULT_RATE_LIMIT = 30;    // requests per minute
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;     // 1 second
const MAX_BACKOFF_MS = 30_000;    // 30 seconds

/** HTTP status codes eligible for automatic retry. */
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

/** Resolve rate limit from environment (NIST SC-5). */
function resolveRateLimit(): number {
  const env = process.env.VIKUNJA_RATE_LIMIT;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    logger.warn('config', `Invalid VIKUNJA_RATE_LIMIT "${env}", using default ${DEFAULT_RATE_LIMIT}`);
  }
  return DEFAULT_RATE_LIMIT;
}

/**
 * Token-bucket rate limiter.
 *
 * Refills tokens at a steady rate (requestsPerMinute / 60 per second).
 * When the bucket is empty, callers wait until a token is available.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private lastRefill: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(requestsPerMinute?: number) {
    const rpm = requestsPerMinute ?? resolveRateLimit();
    this.maxTokens = rpm;
    this.tokens = rpm;
    this.lastRefill = Date.now();
    this.refillRate = rpm / 60_000; // tokens per ms
  }

  /** Refill tokens based on elapsed time. */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  /** Wait until a token is available, then consume it. */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time until one token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    logger.warn('rate_limit', `Rate limit reached, waiting ${waitMs}ms`);
    await sleep(waitMs);

    this.refill();
    this.tokens -= 1;
  }
}

/**
 * Execute a fetch request with rate limiting and retry.
 *
 * - Acquires a rate-limit token before each attempt
 * - Retries on 429 (Too Many Requests) and 503 (Service Unavailable)
 * - Respects Retry-After header if present
 * - Exponential backoff with jitter: base * 2^attempt + random jitter
 * - Maximum 3 retries (4 total attempts)
 */
export async function fetchWithRetry(
  limiter: RateLimiter,
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await limiter.acquire();

    const response = await fetch(url, init);

    if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
      return response;
    }

    // Transient error — prepare for retry
    lastError = new RateLimitError(
      `HTTP ${response.status} on attempt ${attempt + 1}`,
      response.status,
      await response.text(),
    );

    if (attempt === MAX_RETRIES) break;

    // Determine backoff duration
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    const backoff = retryAfter ?? calculateBackoff(attempt);

    logger.warn(
      'retry',
      `HTTP ${response.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1}, ` +
      `retrying in ${backoff}ms`,
    );

    await sleep(backoff);
  }

  // All retries exhausted
  throw lastError!;
}

/**
 * Parse the Retry-After header value.
 * Supports both delay-seconds and HTTP-date formats.
 * Returns milliseconds to wait, or undefined if not parseable.
 */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  // Try as integer seconds first
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }

  // Try as HTTP-date
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const delayMs = date - Date.now();
    return delayMs > 0 ? Math.min(delayMs, MAX_BACKOFF_MS) : undefined;
  }

  return undefined;
}

/**
 * Calculate exponential backoff with jitter.
 * Formula: min(maxBackoff, baseBackoff * 2^attempt) + random(0..baseBackoff)
 */
function calculateBackoff(attempt: number): number {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, attempt));
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.floor(exponential + jitter);
}

/** Promise-based sleep utility. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
