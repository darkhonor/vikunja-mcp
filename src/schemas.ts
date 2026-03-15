/**
 * Filename: schemas.ts
 * Last Modified: 2026-03-15
 * Summary: Shared Zod validation schemas for MCP tool input parameters
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SI-10)
 * Classification: UNCLASSIFIED
 */

import { z } from 'zod';

// --- ID Schemas ---

/** Positive integer ID for Vikunja resources (tasks, projects, labels). */
export const positiveId = z.number().int().positive();

// --- String Schemas ---

/** Non-empty string for required text fields (titles, etc.). */
export const nonEmptyString = z.string().min(1);

/** Hex color code in #RRGGBB format. */
export const hexColor = z.string().regex(
  /^#[0-9A-Fa-f]{6}$/,
  'Must be a hex color code in #RRGGBB format (e.g., "#ff0000")',
);

/** ISO 8601 datetime string (e.g., "2026-03-15T00:00:00Z"). */
export const isoDatetime = z.string().datetime({
  message: 'Must be an ISO 8601 datetime (e.g., "2026-03-15T00:00:00Z")',
});

// --- Numeric Schemas ---

/** Task priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent. */
export const priority = z.number().int().min(0).max(4);

/** Pagination page number (1-based). */
export const page = z.number().int().positive();

/** Pagination page size (1-200). */
export const perPage = z.number().int().min(1).max(200);

// --- Enum Schemas ---

/** Sort order direction. */
export const orderBy = z.enum(['asc', 'desc']);
