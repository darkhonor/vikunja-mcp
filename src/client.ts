/**
 * Filename: client.ts
 * Last Modified: 2026-03-15
 * Summary: Vikunja REST API client with typed errors, transport security, secure credentials, and rate limiting
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SC-5, SC-8, SC-13, SC-28, IA-5, SI-11)
 * Classification: UNCLASSIFIED
 */

import { readFileSync, statSync } from 'node:fs';
import type { VikunjaProject, VikunjaTask, VikunjaLabel, VikunjaView } from './types.js';
import { ConfigurationError, createApiError } from './errors.js';
import { RateLimiter, fetchWithRetry } from './rate-limiter.js';

/**
 * Resolve the API token from environment variables.
 *
 * Supports two patterns (NIST SC-28, IA-5):
 *   1. VIKUNJA_API_TOKEN_FILE — path to a file containing the token
 *      (preferred — compatible with Docker secrets, Kubernetes mounted secrets)
 *   2. VIKUNJA_API_TOKEN — direct token value (fallback)
 *
 * File-based loading validates permissions and warns if too permissive.
 */
function resolveToken(): string {
  const tokenFile = process.env.VIKUNJA_API_TOKEN_FILE;
  const tokenDirect = process.env.VIKUNJA_API_TOKEN;

  if (tokenFile) {
    try {
      const token = readFileSync(tokenFile, 'utf-8').trim();
      if (!token) {
        throw new ConfigurationError(`Token file is empty: ${tokenFile}`);
      }

      // Warn if file permissions are too permissive (NIST IA-5)
      try {
        const mode = statSync(tokenFile).mode & 0o777;
        if (mode & 0o077) {
          console.error(
            `[WARN] Token file ${tokenFile} has permissive permissions (${mode.toString(8)}). ` +
            'Recommend chmod 600 to restrict access.',
          );
        }
      } catch {
        // Permission check is best-effort — skip on unsupported platforms
      }

      return token;
    } catch (err) {
      if (err instanceof ConfigurationError) throw err;
      throw new ConfigurationError(
        `Failed to read token file "${tokenFile}": ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  if (tokenDirect) {
    return tokenDirect;
  }

  throw new ConfigurationError(
    'API token required. Set VIKUNJA_API_TOKEN_FILE (preferred) or VIKUNJA_API_TOKEN.',
  );
}

export class VikunjaClient {
  private baseUrl: string;
  private token: string;
  private limiter: RateLimiter;

  constructor() {
    const url = process.env.VIKUNJA_URL;

    if (!url) throw new ConfigurationError('VIKUNJA_URL environment variable is required');

    const token = resolveToken();

    // Validate URL format (NIST SC-8: transmission confidentiality)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ConfigurationError(
        `VIKUNJA_URL is not a valid URL: "${url}". Expected format: https://vikunja.example.com`,
      );
    }

    // Enforce HTTPS — reject plaintext HTTP to protect Bearer token in transit
    if (parsed.protocol !== 'https:') {
      throw new ConfigurationError(
        `VIKUNJA_URL must use HTTPS (got "${parsed.protocol}"). ` +
        'Plaintext HTTP would transmit your API token unencrypted. ' +
        'For private CA environments, set NODE_EXTRA_CA_CERTS to your CA bundle path.',
      );
    }

    this.baseUrl = url.replace(/\/$/, '') + '/api/v1';
    this.token = token;
    this.limiter = new RateLimiter();
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetchWithRetry(this.limiter, url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const rawBody = await response.text();
      throw createApiError(response.status, rawBody);
    }

    if (response.status === 204) return {} as T;

    return response.json() as Promise<T>;
  }

  // Projects
  async listProjects(): Promise<VikunjaProject[]> {
    return this.request<VikunjaProject[]>('GET', '/projects');
  }

  async getProject(id: number): Promise<VikunjaProject> {
    return this.request<VikunjaProject>('GET', `/projects/${id}`);
  }

  async createProject(data: { title: string; description?: string; parent_project_id?: number; hex_color?: string }): Promise<VikunjaProject> {
    return this.request<VikunjaProject>('PUT', '/projects', data);
  }

  async updateProject(id: number, data: Partial<{ title: string; description: string; is_archived: boolean; hex_color: string }>): Promise<VikunjaProject> {
    return this.request<VikunjaProject>('POST', `/projects/${id}`, data);
  }

  async deleteProject(id: number): Promise<void> {
    await this.request<{ message: string }>('DELETE', `/projects/${id}`);
  }

  // Views (needed for listing tasks in a project)
  async getProjectViews(projectId: number): Promise<VikunjaView[]> {
    return this.request<VikunjaView[]>('GET', `/projects/${projectId}/views`);
  }

  // Tasks
  async listTasks(params?: { page?: number; per_page?: number; s?: string; sort_by?: string; order_by?: string; filter?: string }): Promise<VikunjaTask[]> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.s) query.set('s', params.s);
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.order_by) query.set('order_by', params.order_by);
    if (params?.filter) query.set('filter', params.filter);
    const qs = query.toString();
    return this.request<VikunjaTask[]>('GET', `/tasks${qs ? '?' + qs : ''}`);
  }

  async listProjectTasks(projectId: number, viewId: number, params?: { page?: number; per_page?: number; filter?: string }): Promise<VikunjaTask[]> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.filter) query.set('filter', params.filter);
    const qs = query.toString();
    return this.request<VikunjaTask[]>('GET', `/projects/${projectId}/views/${viewId}/tasks${qs ? '?' + qs : ''}`);
  }

  async getTask(id: number): Promise<VikunjaTask> {
    return this.request<VikunjaTask>('GET', `/tasks/${id}`);
  }

  async createTask(projectId: number, data: { title: string; description?: string; done?: boolean; priority?: number; due_date?: string; hex_color?: string }): Promise<VikunjaTask> {
    return this.request<VikunjaTask>('PUT', `/projects/${projectId}/tasks`, data);
  }

  async updateTask(id: number, data: Partial<{ title: string; description: string; done: boolean; priority: number; due_date: string; hex_color: string }>): Promise<VikunjaTask> {
    return this.request<VikunjaTask>('POST', `/tasks/${id}`, data);
  }

  async deleteTask(id: number): Promise<void> {
    await this.request<{ message: string }>('DELETE', `/tasks/${id}`);
  }

  // Labels
  async listLabels(): Promise<VikunjaLabel[]> {
    return this.request<VikunjaLabel[]>('GET', '/labels');
  }

  async createLabel(data: { title: string; hex_color?: string; description?: string }): Promise<VikunjaLabel> {
    return this.request<VikunjaLabel>('PUT', '/labels', data);
  }

  async addLabelToTask(taskId: number, labelId: number): Promise<VikunjaLabel> {
    return this.request<VikunjaLabel>('PUT', `/tasks/${taskId}/labels`, { label_id: labelId });
  }

  async removeLabelFromTask(taskId: number, labelId: number): Promise<void> {
    await this.request<{ message: string }>('DELETE', `/tasks/${taskId}/labels/${labelId}`);
  }
}
