import type { WorkspaceMember } from '../models/workspaceMember.js';
import type { WorkspaceMemberRepository } from './workspaceMemberRepository.js';

export class InMemoryWorkspaceMemberRepository
  implements WorkspaceMemberRepository
{
  private readonly members = new Map<string, WorkspaceMember>();

  create(member: WorkspaceMember): WorkspaceMember {
    this.members.set(key(member.workspace_id, member.user_id), clone(member));
    return clone(member);
  }

  find(workspaceId: string, userId: string): WorkspaceMember | null {
    const member = this.members.get(key(workspaceId, userId));
    return member ? clone(member) : null;
  }

  findByUser(userId: string): WorkspaceMember[] {
    return [...this.members.values()]
      .filter((m) => m.user_id === userId)
      .map(clone);
  }

  findByWorkspace(workspaceId: string): WorkspaceMember[] {
    return [...this.members.values()]
      .filter((m) => m.workspace_id === workspaceId)
      .map(clone);
  }

  save(member: WorkspaceMember): WorkspaceMember {
    this.members.set(key(member.workspace_id, member.user_id), clone(member));
    return clone(member);
  }
}

function key(workspaceId: string, userId: string): string {
  return `${workspaceId}::${userId}`;
}

function clone(member: WorkspaceMember): WorkspaceMember {
  return structuredClone(member);
}
