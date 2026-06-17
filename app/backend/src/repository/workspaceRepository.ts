import type { Workspace } from '../models/workspace.js';

export interface WorkspaceRepository {
  create(workspace: Workspace): Workspace;
  findById(id: string): Workspace | null;
  findBySlug(slug: string): Workspace | null;
  findAll(): Workspace[];
  save(workspace: Workspace): Workspace;
}
