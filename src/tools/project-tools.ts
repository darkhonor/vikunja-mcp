/**
 * Filename: project-tools.ts
 * Last Modified: 2026-03-15
 * Summary: MCP tool handlers for Vikunja project operations
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SI-10)
 * Classification: UNCLASSIFIED
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VikunjaClient } from '../client.js';
import { positiveId, nonEmptyString, hexColor } from '../schemas.js';
import { logger } from '../logger.js';
import { z } from 'zod';

export function projectTools(server: McpServer, client: VikunjaClient): void {
  server.registerTool('vikunja_list_projects', {
    description: 'List all projects the user has access to in Vikunja',
  }, async () => {
    const projects = await client.listProjects();
    logger.read('list_projects', 'project', `${projects.length} project(s)`);
    const summary = projects.map(p => {
      const archived = p.is_archived ? ' [ARCHIVED]' : '';
      const parent = p.parent_project_id ? ` (child of #${p.parent_project_id})` : '';
      return `[${p.id}] ${p.title}${archived}${parent}`;
    }).join('\n');

    return {
      content: [{ type: 'text', text: `${projects.length} project(s):\n${summary}` }],
    };
  });

  server.registerTool('vikunja_create_project', {
    description: 'Create a new project in Vikunja',
    inputSchema: {
      title: nonEmptyString.describe('Project title'),
      description: z.string().optional().describe('Project description'),
      parent_project_id: positiveId.optional().describe('Parent project ID for nesting'),
      hex_color: hexColor.optional().describe('Hex color code (e.g., "#ff0000")'),
    },
  }, async ({ title, description, parent_project_id, hex_color }) => {
    const project = await client.createProject({ title, description, parent_project_id, hex_color });
    logger.success('create_project', 'project', project.id);
    return {
      content: [{ type: 'text', text: `Created project [${project.id}] "${project.title}"` }],
    };
  });

  server.registerTool('vikunja_update_project', {
    description: 'Update an existing project in Vikunja',
    inputSchema: {
      id: positiveId.describe('Project ID'),
      title: nonEmptyString.optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      is_archived: z.boolean().optional().describe('Archive or unarchive the project'),
      hex_color: hexColor.optional().describe('Hex color code (e.g., "#ff0000")'),
    },
  }, async ({ id, ...data }) => {
    const project = await client.updateProject(id, data);
    logger.success('update_project', 'project', project.id);
    return {
      content: [{ type: 'text', text: `Updated project [${project.id}] "${project.title}"` }],
    };
  });

  server.registerTool('vikunja_delete_project', {
    description: 'Delete a project and all its tasks in Vikunja',
    inputSchema: {
      id: positiveId.describe('Project ID to delete'),
    },
  }, async ({ id }) => {
    await client.deleteProject(id);
    logger.success('delete_project', 'project', id);
    return {
      content: [{ type: 'text', text: `Deleted project #${id}` }],
    };
  });
}
