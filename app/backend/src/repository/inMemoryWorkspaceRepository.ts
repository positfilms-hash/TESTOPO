import type { Workspace } from '../models/workspace.js';
import type { WorkspaceRepository } from './workspaceRepository.js';

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly workspaces = new Map<string, Workspace>();

  create(workspace: Workspace): Workspace {
    this.workspaces.set(workspace.id, clone(workspace));
    return clone(workspace);
  }

  findById(id: string): Workspace | null {
    const workspace = this.workspaces.get(id);
    return workspace ? clone(workspace) : null;
  }

  findBySlug(slug: string): Workspace | null {
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === slug) {
        return clone(workspace);
      }
    }
    return null;
  }

  findAll(): Workspace[] {
    return [...this.workspaces.values()].map(clone);
  }

  save(workspace: Workspace): Workspace {
    this.workspaces.set(workspace.id, clone(workspace));
    return clone(workspace);
  }
}

function clone(workspace: Workspace): Workspace {
  return structuredClone(workspace);
}
