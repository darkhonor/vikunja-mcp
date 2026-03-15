/**
 * Filename: task-tools.ts
 * Last Modified: 2026-03-15
 * Summary: MCP tool handlers for Vikunja task operations
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SI-10, SI-11)
 * Classification: UNCLASSIFIED
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VikunjaClient } from '../client.js';
import type { VikunjaTask } from '../types.js';
import { VikunjaError } from '../errors.js';
import { positiveId, nonEmptyString, hexColor, isoDatetime, priority, page, perPage, orderBy } from '../schemas.js';
import { logger } from '../logger.js';

function formatTask(t: VikunjaTask): string {
  const status = t.done ? '[x]' : '[ ]';
  const pri = t.priority > 0 ? ` P${t.priority}` : '';
  const due = t.due_date && !t.due_date.startsWith('0001') ? ` due:${t.due_date.split('T')[0]}` : '';
  const labels = t.labels?.length ? ` [${t.labels.map(l => l.title).join(', ')}]` : '';
  return `${status} #${t.id} ${t.title}${pri}${due}${labels}`;
}

export function taskTools(server: McpServer, client: VikunjaClient): void {
  server.registerTool('vikunja_list_tasks', {
    description: 'List all tasks across all projects. Supports search and filtering.',
    inputSchema: {
      page: page.optional().describe('Page number (default: 1)'),
      per_page: perPage.optional().describe('Tasks per page (default: 50, max: 200)'),
      s: z.string().optional().describe('Search query string'),
      sort_by: z.string().optional().describe('Sort field (e.g., "due_date", "created", "priority")'),
      order_by: orderBy.optional().describe('Sort order: "asc" or "desc"'),
      filter: z.string().optional().describe('Vikunja filter string (e.g., "done = false")'),
    },
  }, async (params) => {
    const tasks = await client.listTasks(params);
    logger.read('list_tasks', 'task', `${tasks.length} task(s)`);
    if (!tasks.length) return { content: [{ type: 'text', text: 'No tasks found.' }] };

    const lines = tasks.map(formatTask).join('\n');
    return {
      content: [{ type: 'text', text: `${tasks.length} task(s):\n${lines}` }],
    };
  });

  server.registerTool('vikunja_list_project_tasks', {
    description: 'List tasks within a specific project',
    inputSchema: {
      project_id: positiveId.describe('Project ID'),
      page: page.optional().describe('Page number'),
      per_page: perPage.optional().describe('Tasks per page (max: 200)'),
      filter: z.string().optional().describe('Vikunja filter string'),
    },
  }, async ({ project_id, ...params }) => {
    // Get the first view for this project
    const views = await client.getProjectViews(project_id);
    if (!views.length) return { content: [{ type: 'text', text: 'Project has no views.' }] };

    const tasks = await client.listProjectTasks(project_id, views[0].id, params);
    logger.read('list_project_tasks', 'task', `${tasks.length} task(s) in project #${project_id}`);
    if (!tasks.length) return { content: [{ type: 'text', text: 'No tasks in this project.' }] };

    const lines = tasks.map(formatTask).join('\n');
    return {
      content: [{ type: 'text', text: `${tasks.length} task(s) in project #${project_id}:\n${lines}` }],
    };
  });

  server.registerTool('vikunja_get_task', {
    description: 'Get detailed information about a specific task',
    inputSchema: {
      id: positiveId.describe('Task ID'),
    },
  }, async ({ id }) => {
    const task = await client.getTask(id);
    logger.read('get_task', 'task', `task #${id}`);
    return {
      content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
    };
  });

  server.registerTool('vikunja_create_task', {
    description: 'Create a new task in a project',
    inputSchema: {
      project_id: positiveId.describe('Project ID to create the task in'),
      title: nonEmptyString.describe('Task title'),
      description: z.string().optional().describe('Task description (supports markdown)'),
      done: z.boolean().optional().describe('Mark as completed'),
      priority: priority.optional().describe('Priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent'),
      due_date: isoDatetime.optional().describe('Due date in ISO format (e.g., "2026-03-15T00:00:00Z")'),
      hex_color: hexColor.optional().describe('Hex color code (e.g., "#ff0000")'),
    },
  }, async ({ project_id, ...data }) => {
    const task = await client.createTask(project_id, data);
    logger.success('create_task', 'task', task.id, project_id);
    return {
      content: [{ type: 'text', text: `Created task [${task.id}] "${task.title}" in project #${project_id}` }],
    };
  });

  server.registerTool('vikunja_update_task', {
    description: 'Update an existing task',
    inputSchema: {
      id: positiveId.describe('Task ID'),
      title: nonEmptyString.optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      done: z.boolean().optional().describe('Mark as done/undone'),
      priority: priority.optional().describe('Priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent'),
      due_date: isoDatetime.optional().describe('Due date in ISO format'),
      hex_color: hexColor.optional().describe('Hex color code (e.g., "#ff0000")'),
    },
  }, async ({ id, ...data }) => {
    const task = await client.updateTask(id, data);
    logger.success('update_task', 'task', task.id);
    return {
      content: [{ type: 'text', text: `Updated task [${task.id}] "${task.title}"` }],
    };
  });

  server.registerTool('vikunja_complete_task', {
    description: 'Mark a task as completed',
    inputSchema: {
      id: positiveId.describe('Task ID to complete'),
    },
  }, async ({ id }) => {
    const task = await client.updateTask(id, { done: true });
    logger.success('complete_task', 'task', task.id);
    return {
      content: [{ type: 'text', text: `Completed task [${task.id}] "${task.title}"` }],
    };
  });

  server.registerTool('vikunja_delete_task', {
    description: 'Delete a task',
    inputSchema: {
      id: positiveId.describe('Task ID to delete'),
    },
  }, async ({ id }) => {
    await client.deleteTask(id);
    logger.success('delete_task', 'task', id);
    return {
      content: [{ type: 'text', text: `Deleted task #${id}` }],
    };
  });

  server.registerTool('vikunja_bulk_create_tasks', {
    description: 'Create multiple tasks at once in a project',
    inputSchema: {
      project_id: positiveId.describe('Project ID to create tasks in'),
      tasks: z.array(z.object({
        title: nonEmptyString.describe('Task title'),
        description: z.string().optional().describe('Task description'),
        done: z.boolean().optional().describe('Mark as completed'),
        priority: priority.optional().describe('Priority (0-4)'),
        due_date: isoDatetime.optional().describe('Due date in ISO format'),
      })).min(1).max(50).describe('Array of tasks to create (1-50)'),
    },
  }, async ({ project_id, tasks }) => {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const taskData of tasks) {
      try {
        const task = await client.createTask(project_id, taskData);
        logger.success('bulk_create_task', 'task', task.id, project_id);
        succeeded.push(`  [${task.id}] ${task.title}`);
      } catch (err) {
        const reason = err instanceof VikunjaError ? err.message : 'Unknown error';
        logger.failure('bulk_create_task', 'task', reason);
        failed.push(`  "${taskData.title}": ${reason}`);
      }
    }

    const lines: string[] = [];
    if (succeeded.length) {
      lines.push(`Created ${succeeded.length} task(s):`, ...succeeded);
    }
    if (failed.length) {
      lines.push(`Failed ${failed.length} task(s):`, ...failed);
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  });
}
