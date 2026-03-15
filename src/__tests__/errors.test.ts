/**
 * Filename: errors.test.ts
 * Last Modified: 2026-03-15
 * Summary: Unit tests for typed error hierarchy and error sanitization
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SI-11)
 * Classification: UNCLASSIFIED
 */

import { describe, it, expect } from 'vitest';
import {
  VikunjaError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  ConfigurationError,
  createApiError,
} from '../errors.js';

describe('Error hierarchy', () => {
  it('VikunjaError stores statusCode and sanitized message', () => {
    const err = new VikunjaError('safe message', 500, '{"secret":"leaked"}');
    expect(err.message).toBe('safe message');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('VikunjaError');
    expect(err).toBeInstanceOf(Error);
  });

  it('VikunjaError.getRawBody() returns raw response for debug logging', () => {
    const err = new VikunjaError('msg', 400, 'raw body content');
    expect(err.getRawBody()).toBe('raw body content');
  });

  it('VikunjaError.getRawBody() defaults to empty string', () => {
    const err = new VikunjaError('msg', 400);
    expect(err.getRawBody()).toBe('');
  });

  it('AuthenticationError is 401 with sanitized message', () => {
    const err = new AuthenticationError('{"code":401,"message":"invalid token xyz123"}');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication failed — check your API token');
    expect(err.message).not.toContain('xyz123');
    expect(err.name).toBe('AuthenticationError');
    expect(err).toBeInstanceOf(VikunjaError);
  });

  it('AuthorizationError is 403 with sanitized message', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Access denied to the requested resource');
    expect(err.name).toBe('AuthorizationError');
  });

  it('NotFoundError is 404 with sanitized message', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Resource not found');
    expect(err.name).toBe('NotFoundError');
  });

  it('ValidationError defaults to 400', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('ValidationError');
  });

  it('ValidationError accepts custom status code (422)', () => {
    const err = new ValidationError(422, 'body');
    expect(err.statusCode).toBe(422);
  });

  it('RateLimitError is 429', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.message).toContain('Rate limit');
    expect(err.name).toBe('RateLimitError');
  });

  it('ServerError defaults to 500', () => {
    const err = new ServerError();
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('ServerError');
  });

  it('ServerError accepts custom status code (502)', () => {
    const err = new ServerError(502, 'bad gateway');
    expect(err.statusCode).toBe(502);
  });

  it('ConfigurationError is a plain Error (not VikunjaError)', () => {
    const err = new ConfigurationError('missing env var');
    expect(err.message).toBe('missing env var');
    expect(err.name).toBe('ConfigurationError');
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(VikunjaError);
  });
});

describe('createApiError', () => {
  it('maps 401 to AuthenticationError', () => {
    const err = createApiError(401, 'body');
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.statusCode).toBe(401);
  });

  it('maps 403 to AuthorizationError', () => {
    const err = createApiError(403, 'body');
    expect(err).toBeInstanceOf(AuthorizationError);
  });

  it('maps 404 to NotFoundError', () => {
    const err = createApiError(404, 'body');
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('maps 429 to RateLimitError', () => {
    const err = createApiError(429, 'body');
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it('maps 400 to ValidationError', () => {
    const err = createApiError(400, 'body');
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('maps 422 to ValidationError', () => {
    const err = createApiError(422, 'body');
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(422);
  });

  it('maps 500 to ServerError', () => {
    const err = createApiError(500, 'body');
    expect(err).toBeInstanceOf(ServerError);
  });

  it('maps 502 to ServerError', () => {
    const err = createApiError(502, 'body');
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(502);
  });

  it('maps 503 to ServerError', () => {
    const err = createApiError(503, 'body');
    expect(err).toBeInstanceOf(ServerError);
  });

  it('never exposes raw body in error message', () => {
    const sensitiveBody = '{"password":"hunter2","token":"secret-api-key"}';
    const err = createApiError(401, sensitiveBody);
    expect(err.message).not.toContain('hunter2');
    expect(err.message).not.toContain('secret-api-key');
    expect(err.getRawBody()).toBe(sensitiveBody);
  });
});
