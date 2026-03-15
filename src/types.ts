/**
 * Filename: types.ts
 * Last Modified: 2026-03-15
 * Summary: TypeScript interfaces for Vikunja REST API response models
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5
 * Classification: UNCLASSIFIED
 */

export interface VikunjaProject {
  id: number;
  title: string;
  description: string;
  identifier: string;
  hex_color: string;
  parent_project_id: number;
  is_archived: boolean;
  is_favorite: boolean;
  position: number;
  created: string;
  updated: string;
  owner?: VikunjaUser;
  views?: VikunjaView[];
}

export interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  done_at: string;
  due_date: string;
  priority: number;
  start_date: string;
  end_date: string;
  percent_done: number;
  hex_color: string;
  identifier: string;
  index: number;
  position: number;
  project_id: number;
  bucket_id: number;
  repeat_after: number;
  repeat_mode: number;
  is_favorite: boolean;
  labels: VikunjaLabel[] | null;
  assignees: VikunjaUser[];
  related_tasks: Record<string, VikunjaTask[]> | null;
  attachments: unknown[] | null;
  comment_count: number;
  created: string;
  updated: string;
  created_by: VikunjaUser;
}

export interface VikunjaLabel {
  id: number;
  title: string;
  description: string;
  hex_color: string;
  created_by: VikunjaUser;
  created: string;
  updated: string;
}

export interface VikunjaUser {
  id: number;
  name: string;
  username: string;
  created: string;
  updated: string;
}

export interface VikunjaView {
  id: number;
  title: string;
  project_id: number;
  view_kind: number;
  position: number;
}
