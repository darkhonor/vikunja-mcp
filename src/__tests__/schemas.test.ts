/**
 * Filename: schemas.test.ts
 * Last Modified: 2026-03-15
 * Summary: Unit tests for Zod validation schemas
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SI-10)
 * Classification: UNCLASSIFIED
 */

import { describe, it, expect } from 'vitest';
import { positiveId, nonEmptyString, hexColor, isoDatetime, priority, page, perPage, orderBy } from '../schemas.js';

describe('positiveId', () => {
  it('accepts positive integers', () => {
    expect(positiveId.parse(1)).toBe(1);
    expect(positiveId.parse(999)).toBe(999);
  });

  it('rejects zero', () => {
    expect(() => positiveId.parse(0)).toThrow();
  });

  it('rejects negative numbers', () => {
    expect(() => positiveId.parse(-1)).toThrow();
  });

  it('rejects floats', () => {
    expect(() => positiveId.parse(1.5)).toThrow();
  });

  it('rejects strings', () => {
    expect(() => positiveId.parse('1')).toThrow();
  });
});

describe('nonEmptyString', () => {
  it('accepts non-empty strings', () => {
    expect(nonEmptyString.parse('hello')).toBe('hello');
  });

  it('rejects empty string', () => {
    expect(() => nonEmptyString.parse('')).toThrow();
  });

  it('rejects non-strings', () => {
    expect(() => nonEmptyString.parse(123)).toThrow();
  });
});

describe('hexColor', () => {
  it('accepts valid 6-digit hex colors', () => {
    expect(hexColor.parse('#ff0000')).toBe('#ff0000');
    expect(hexColor.parse('#ABCDEF')).toBe('#ABCDEF');
    expect(hexColor.parse('#123abc')).toBe('#123abc');
  });

  it('rejects missing hash', () => {
    expect(() => hexColor.parse('ff0000')).toThrow();
  });

  it('rejects 3-digit shorthand', () => {
    expect(() => hexColor.parse('#f00')).toThrow();
  });

  it('rejects 8-digit (with alpha)', () => {
    expect(() => hexColor.parse('#ff0000ff')).toThrow();
  });

  it('rejects invalid hex characters', () => {
    expect(() => hexColor.parse('#gggggg')).toThrow();
  });
});

describe('isoDatetime', () => {
  it('accepts valid ISO 8601 datetime', () => {
    expect(isoDatetime.parse('2026-03-15T00:00:00Z')).toBe('2026-03-15T00:00:00Z');
  });

  it('accepts datetime with milliseconds', () => {
    expect(isoDatetime.parse('2026-03-15T12:30:00.000Z')).toBe('2026-03-15T12:30:00.000Z');
  });

  it('rejects date-only strings', () => {
    expect(() => isoDatetime.parse('2026-03-15')).toThrow();
  });

  it('rejects plain text', () => {
    expect(() => isoDatetime.parse('tomorrow')).toThrow();
  });
});

describe('priority', () => {
  it('accepts 0 (none) through 4 (urgent)', () => {
    for (let i = 0; i <= 4; i++) {
      expect(priority.parse(i)).toBe(i);
    }
  });

  it('rejects negative values', () => {
    expect(() => priority.parse(-1)).toThrow();
  });

  it('rejects values above 4', () => {
    expect(() => priority.parse(5)).toThrow();
  });

  it('rejects floats', () => {
    expect(() => priority.parse(1.5)).toThrow();
  });
});

describe('page', () => {
  it('accepts positive integers', () => {
    expect(page.parse(1)).toBe(1);
    expect(page.parse(100)).toBe(100);
  });

  it('rejects zero', () => {
    expect(() => page.parse(0)).toThrow();
  });

  it('rejects negative', () => {
    expect(() => page.parse(-1)).toThrow();
  });
});

describe('perPage', () => {
  it('accepts 1 through 200', () => {
    expect(perPage.parse(1)).toBe(1);
    expect(perPage.parse(50)).toBe(50);
    expect(perPage.parse(200)).toBe(200);
  });

  it('rejects zero', () => {
    expect(() => perPage.parse(0)).toThrow();
  });

  it('rejects values above 200', () => {
    expect(() => perPage.parse(201)).toThrow();
  });
});

describe('orderBy', () => {
  it('accepts asc and desc', () => {
    expect(orderBy.parse('asc')).toBe('asc');
    expect(orderBy.parse('desc')).toBe('desc');
  });

  it('rejects other strings', () => {
    expect(() => orderBy.parse('ascending')).toThrow();
    expect(() => orderBy.parse('DESC')).toThrow();
  });
});
