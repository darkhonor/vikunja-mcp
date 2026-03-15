/**
 * Filename: label-tools.ts
 * Last Modified: 2026-03-15
 * Summary: MCP tool handlers for Vikunja label operations
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SI-10)
 * Classification: UNCLASSIFIED
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VikunjaClient } from '../client.js';
import { positiveId, nonEmptyString, hexColor } from '../schemas.js';
import { logger } from '../logger.js';

export function labelTools(server: McpServer, client: VikunjaClient): void {
  server.registerTool('vikunja_list_labels', {
    description: 'List all labels the user has access to',
  }, async () => {
    const labels = await client.listLabels();
    logger.read('list_labels', 'label', `${labels.length} label(s)`);
    if (!labels.length) return { content: [{ type: 'text', text: 'No labels found.' }] };

    const lines = labels.map(l => {
      const color = l.hex_color ? ` (${l.hex_color})` : '';
      return `[${l.id}] ${l.title}${color}`;
    }).join('\n');

    return {
      content: [{ type: 'text', text: `${labels.length} label(s):\n${lines}` }],
    };
  });

  server.registerTool('vikunja_create_label', {
    description: 'Create a new label',
    inputSchema: {
      title: nonEmptyString.describe('Label title'),
      hex_color: hexColor.optional().describe('Hex color code (e.g., "#ff0000")'),
      description: z.string().optional().describe('Label description'),
    },
  }, async (data) => {
    const label = await client.createLabel(data);
    logger.success('create_label', 'label', label.id);
    return {
      content: [{ type: 'text', text: `Created label [${label.id}] "${label.title}"` }],
    };
  });

  server.registerTool('vikunja_add_label_to_task', {
    description: 'Add a label to a task',
    inputSchema: {
      task_id: positiveId.describe('Task ID'),
      label_id: positiveId.describe('Label ID'),
    },
  }, async ({ task_id, label_id }) => {
    const label = await client.addLabelToTask(task_id, label_id);
    logger.success('add_label_to_task', 'label', label_id);
    return {
      content: [{ type: 'text', text: `Added label "${label.title}" to task #${task_id}` }],
    };
  });

  server.registerTool('vikunja_remove_label_from_task', {
    description: 'Remove a label from a task',
    inputSchema: {
      task_id: positiveId.describe('Task ID'),
      label_id: positiveId.describe('Label ID'),
    },
  }, async ({ task_id, label_id }) => {
    await client.removeLabelFromTask(task_id, label_id);
    logger.success('remove_label_from_task', 'label', label_id);
    return {
      content: [{ type: 'text', text: `Removed label #${label_id} from task #${task_id}` }],
    };
  });
}
