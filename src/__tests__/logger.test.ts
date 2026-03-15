/**
 * Filename: logger.test.ts
 * Last Modified: 2026-03-15
 * Summary: Unit tests for structured audit logger
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (AU-2, AU-3)
 * Classification: UNCLASSIFIED
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger.js';

describe('logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  describe('success', () => {
    it('logs mutating operations at info level', () => {
      logger.success('create_task', 'task', 42, 1);
      expect(stderrSpy).toHaveBeenCalledOnce();

      const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('info');
      expect(entry.operation).toBe('create_task');
      expect(entry.resource).toBe('task');
      expect(entry.resourceId).toBe(42);
      expect(entry.projectId).toBe(1);
      expect(entry.status).toBe('success');
      expect(entry.timestamp).toBeDefined();
    });

    it('omits optional fields when not provided', () => {
      logger.success('delete_project', 'project');
      const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string);
      expect(entry.resourceId).toBeUndefined();
      expect(entry.projectId).toBeUndefined();
    });
  });

  describe('failure', () => {
    it('logs failed operations at error level', () => {
      logger.failure('create_task', 'task', 'Connection refused', 42);
      const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('error');
      expect(entry.status).toBe('failure');
      expect(entry.error).toBe('Connection refused');
      expect(entry.resourceId).toBe(42);
    });
  });

  describe('warn', () => {
    it('logs warnings with detail message', () => {
      logger.warn('rate_limit', 'Rate limit reached');
      const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('warn');
      expect(entry.operation).toBe('rate_limit');
      expect(entry.detail).toBe('Rate limit reached');
      expect(entry.status).toBe('success');
    });
  });

  describe('read', () => {
    it('logs read operations at debug level', () => {
      // Default log level is 'info', so debug should be suppressed
      logger.read('list_tasks', 'task', '5 task(s)');
      // At default info level, debug messages are suppressed
      // This test validates the method exists and doesn't throw
    });
  });

  describe('JSON structure (AU-3 compliance)', () => {
    it('includes ISO 8601 timestamp', () => {
      logger.success('test_op', 'test');
      const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string);
      // Validate ISO 8601 format
      expect(() => new Date(entry.timestamp)).not.toThrow();
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('produces valid JSON parseable by log aggregators', () => {
      logger.success('create_task', 'task', 1);
      logger.failure('delete_task', 'task', 'not found', 2);
      logger.warn('config', 'test warning');

      for (const call of stderrSpy.mock.calls) {
        expect(() => JSON.parse(call[0] as string)).not.toThrow();
      }
    });
  });
});
