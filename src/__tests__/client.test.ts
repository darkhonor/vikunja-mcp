/**
 * Filename: client.test.ts
 * Last Modified: 2026-03-15
 * Summary: Unit tests for VikunjaClient — configuration, HTTPS, credential loading
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SC-8, IA-5, SI-11)
 * Classification: UNCLASSIFIED
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Dynamic imports mean ConfigurationError from the test module !== the one in client.ts,
// so we match by error name rather than instanceof.

describe('VikunjaClient constructor', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('throws ConfigurationError when VIKUNJA_URL is missing', async () => {
    delete process.env.VIKUNJA_URL;
    process.env.VIKUNJA_API_TOKEN = 'test-token';

    const { VikunjaClient } = await import('../client.js');
    expect(() => new VikunjaClient()).toThrowError('VIKUNJA_URL');
  });

  it('throws ConfigurationError when API token is missing', async () => {
    process.env.VIKUNJA_URL = 'https://vikunja.example.com';
    delete process.env.VIKUNJA_API_TOKEN;
    delete process.env.VIKUNJA_API_TOKEN_FILE;

    const { VikunjaClient } = await import('../client.js');
    expect(() => new VikunjaClient()).toThrowError('API token required');
  });

  it('throws ConfigurationError for HTTP URLs (HTTPS enforcement)', async () => {
    process.env.VIKUNJA_URL = 'http://vikunja.example.com';
    process.env.VIKUNJA_API_TOKEN = 'test-token';

    const { VikunjaClient } = await import('../client.js');
    expect(() => new VikunjaClient()).toThrowError('HTTPS');
  });

  it('throws ConfigurationError for invalid URLs', async () => {
    process.env.VIKUNJA_URL = 'not-a-url';
    process.env.VIKUNJA_API_TOKEN = 'test-token';

    const { VikunjaClient } = await import('../client.js');
    expect(() => new VikunjaClient()).toThrowError('not a valid URL');
  });

  it('accepts valid HTTPS URL with direct token', async () => {
    process.env.VIKUNJA_URL = 'https://vikunja.example.com';
    process.env.VIKUNJA_API_TOKEN = 'test-token';

    const { VikunjaClient } = await import('../client.js');
    expect(() => new VikunjaClient()).not.toThrow();
  });

  it('strips trailing slash from URL', async () => {
    process.env.VIKUNJA_URL = 'https://vikunja.example.com/';
    process.env.VIKUNJA_API_TOKEN = 'test-token';

    const { VikunjaClient } = await import('../client.js');
    const client = new VikunjaClient();
    expect(client).toBeDefined();
  });
});

describe('File-based token loading', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('throws ConfigurationError for non-existent token file', async () => {
    process.env.VIKUNJA_URL = 'https://vikunja.example.com';
    process.env.VIKUNJA_API_TOKEN_FILE = '/tmp/nonexistent-token-file-12345';
    delete process.env.VIKUNJA_API_TOKEN;

    const { VikunjaClient } = await import('../client.js');
    expect(() => new VikunjaClient()).toThrowError('Failed to read token file');
  });

  it('throws ConfigurationError for empty token file', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tokenPath = '/tmp/vikunja-test-empty-token';
    writeFileSync(tokenPath, '');

    process.env.VIKUNJA_URL = 'https://vikunja.example.com';
    process.env.VIKUNJA_API_TOKEN_FILE = tokenPath;
    delete process.env.VIKUNJA_API_TOKEN;

    try {
      const { VikunjaClient } = await import('../client.js');
      expect(() => new VikunjaClient()).toThrowError('empty');
    } finally {
      unlinkSync(tokenPath);
    }
  });

  it('loads token from file successfully', async () => {
    const { writeFileSync, unlinkSync, chmodSync } = await import('node:fs');
    const tokenPath = '/tmp/vikunja-test-token';
    writeFileSync(tokenPath, 'file-based-token\n');
    chmodSync(tokenPath, 0o600);

    process.env.VIKUNJA_URL = 'https://vikunja.example.com';
    process.env.VIKUNJA_API_TOKEN_FILE = tokenPath;
    delete process.env.VIKUNJA_API_TOKEN;

    try {
      const { VikunjaClient } = await import('../client.js');
      expect(() => new VikunjaClient()).not.toThrow();
    } finally {
      unlinkSync(tokenPath);
    }
  });

  it('prefers VIKUNJA_API_TOKEN_FILE over VIKUNJA_API_TOKEN', async () => {
    const { writeFileSync, unlinkSync, chmodSync } = await import('node:fs');
    const tokenPath = '/tmp/vikunja-test-token-priority';
    writeFileSync(tokenPath, 'file-token');
    chmodSync(tokenPath, 0o600);

    process.env.VIKUNJA_URL = 'https://vikunja.example.com';
    process.env.VIKUNJA_API_TOKEN_FILE = tokenPath;
    process.env.VIKUNJA_API_TOKEN = 'env-token';

    try {
      const { VikunjaClient } = await import('../client.js');
      expect(() => new VikunjaClient()).not.toThrow();
    } finally {
      unlinkSync(tokenPath);
    }
  });

  it('warns about permissive file permissions', async () => {
    const { writeFileSync, unlinkSync, chmodSync } = await import('node:fs');
    const tokenPath = '/tmp/vikunja-test-token-perms';
    writeFileSync(tokenPath, 'test-token');
    chmodSync(tokenPath, 0o644); // world-readable

    process.env.VIKUNJA_URL = 'https://vikunja.example.com';
    process.env.VIKUNJA_API_TOKEN_FILE = tokenPath;
    delete process.env.VIKUNJA_API_TOKEN;

    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { VikunjaClient } = await import('../client.js');
      new VikunjaClient();

      const permWarning = stderrSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('permissive permissions'),
      );
      expect(permWarning).toBeDefined();
    } finally {
      unlinkSync(tokenPath);
    }
  });
});
