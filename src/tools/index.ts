/**
 * Filename: tools/index.ts
 * Last Modified: 2026-03-15
 * Summary: Tool registration entry point — wires all MCP tool handlers
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5
 * Classification: UNCLASSIFIED
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VikunjaClient } from '../client.js';
import { projectTools } from './project-tools.js';
import { taskTools } from './task-tools.js';
import { labelTools } from './label-tools.js';

export function registerTools(server: McpServer, client: VikunjaClient): void {
  projectTools(server, client);
  taskTools(server, client);
  labelTools(server, client);
}
