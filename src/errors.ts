/**
 * Filename: errors.ts
 * Last Modified: 2026-03-15
 * Summary: Typed error hierarchy for Vikunja MCP with sanitized messages
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SI-11)
 * Classification: UNCLASSIFIED
 */

/**
 * Base error class for all Vikunja MCP errors.
 *
 * Stores the HTTP status code and a sanitized user-facing message.
 * Raw API response bodies are stored privately for debug logging
 * and never surfaced to MCP tool output (NIST SI-11).
 */
export class VikunjaError extends Error {
  public readonly statusCode: number;
  private readonly rawBody: string;

  constructor(message: string, statusCode: number, rawBody: string = '') {
    super(message);
    this.name = 'VikunjaError';
    this.statusCode = statusCode;
    this.rawBody = rawBody;
  }

  /** Raw API response — for debug logging only, never expose to users. */
  getRawBody(): string {
    return this.rawBody;
  }
}

/**
 * HTTP 401 — Invalid or expired API token.
 */
export class AuthenticationError extends VikunjaError {
  constructor(rawBody: string = '') {
    super('Authentication failed — check your API token', 401, rawBody);
    this.name = 'AuthenticationError';
  }
}

/**
 * HTTP 403 — Valid token but insufficient permissions.
 */
export class AuthorizationError extends VikunjaError {
  constructor(rawBody: string = '') {
    super('Access denied to the requested resource', 403, rawBody);
    this.name = 'AuthorizationError';
  }
}

/**
 * HTTP 404 — Requested resource does not exist.
 */
export class NotFoundError extends VikunjaError {
  constructor(rawBody: string = '') {
    super('Resource not found', 404, rawBody);
    this.name = 'NotFoundError';
  }
}

/**
 * HTTP 400/422 — Malformed request or invalid parameters.
 */
export class ValidationError extends VikunjaError {
  constructor(statusCode: number = 400, rawBody: string = '') {
    super('Invalid request — check your parameters', statusCode, rawBody);
    this.name = 'ValidationError';
  }
}

/**
 * HTTP 429 — Rate limit exceeded.
 */
export class RateLimitError extends VikunjaError {
  constructor(rawBody: string = '') {
    super('Rate limit exceeded — try again later', 429, rawBody);
    this.name = 'RateLimitError';
  }
}

/**
 * HTTP 500+ — Server-side failure.
 */
export class ServerError extends VikunjaError {
  constructor(statusCode: number = 500, rawBody: string = '') {
    super('Vikunja server error — try again later', statusCode, rawBody);
    this.name = 'ServerError';
  }
}

/**
 * Startup configuration error — missing or invalid environment variables.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Maps an HTTP status code to the appropriate typed error.
 * Raw response body is stored for debug logging but never shown to users.
 */
export function createApiError(statusCode: number, rawBody: string): VikunjaError {
  switch (statusCode) {
    case 401:
      return new AuthenticationError(rawBody);
    case 403:
      return new AuthorizationError(rawBody);
    case 404:
      return new NotFoundError(rawBody);
    case 429:
      return new RateLimitError(rawBody);
    default:
      if (statusCode >= 400 && statusCode < 500) {
        return new ValidationError(statusCode, rawBody);
      }
      return new ServerError(statusCode, rawBody);
  }
}
