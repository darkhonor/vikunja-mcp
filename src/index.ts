/**
 * Filename: index.ts
 * Last Modified: 2026-03-15
 * Summary: MCP server entry point — initializes Vikunja client and stdio transport
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5
 * Classification: UNCLASSIFIED
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VikunjaClient } from './client.js';
import { registerTools } from './tools/index.js';

const server = new McpServer({
  name: 'vikunja-mcp',
  version: '1.0.0',
});

const client = new VikunjaClient();

registerTools(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Vikunja MCP Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
