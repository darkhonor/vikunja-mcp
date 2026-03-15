/**
 * Filename: logger.ts
 * Last Modified: 2026-03-15
 * Summary: Structured JSON audit logger for MCP operations
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (AU-2, AU-3)
 * Classification: UNCLASSIFIED
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/** Resolve configured log level from environment (default: info). */
function resolveLogLevel(): LogLevel {
  const env = process.env.VIKUNJA_LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return 'info';
}

const currentLevel = resolveLogLevel();

interface AuditEntry {
  timestamp: string;
  level: LogLevel;
  operation: string;
  resource?: string;
  resourceId?: number;
  projectId?: number;
  status: 'success' | 'failure';
  error?: string;
  detail?: string;
}

/**
 * Write a structured JSON log entry to stderr.
 * MCP convention: stdout is reserved for protocol, stderr for logging.
 */
function writeLog(entry: AuditEntry): void {
  if (LOG_LEVELS[entry.level] > LOG_LEVELS[currentLevel]) return;
  console.error(JSON.stringify(entry));
}

export const logger = {
  /** Log a successful mutating operation (create, update, delete). */
  success(operation: string, resource: string, resourceId?: number, projectId?: number): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation,
      resource,
      resourceId,
      projectId,
      status: 'success',
    });
  },

  /** Log a failed operation. */
  failure(operation: string, resource: string, error: string, resourceId?: number): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation,
      resource,
      resourceId,
      status: 'failure',
      error,
    });
  },

  /** Log a read operation (debug level only). */
  read(operation: string, resource: string, detail?: string): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'debug',
      operation,
      resource,
      status: 'success',
      detail,
    });
  },

  /** Log a warning (e.g., rate limits, permission issues). */
  warn(operation: string, message: string): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation,
      status: 'success',
      detail: message,
    });
  },
};
