import type { Workspace } from '../models/workspace.js';
import type { WorkspaceRepository } from './workspaceRepository.js';

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly workspaces = new Map<string, Workspace>();

  async create(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, clone(workspace));
    return clone(workspace);
  }

  async findById(id: string): Promise<Workspace | null> {
    const workspace = this.workspaces.get(id);
    return workspace ? clone(workspace) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === slug) {
        return clone(workspace);
      }
    }
    return null;
  }

  async findAll(): Promise<Workspace[]> {
    return [...this.workspaces.values()].map(clone);
  }

  async save(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, clone(workspace));
    return clone(workspace);
  }
}

function clone(workspace: Workspace): Workspace {
  return structuredClone(workspace);
}
