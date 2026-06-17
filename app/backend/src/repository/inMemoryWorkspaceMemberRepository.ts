import type { WorkspaceMember } from '../models/workspaceMember.js';
import type { WorkspaceMemberRepository } from './workspaceMemberRepository.js';

export class InMemoryWorkspaceMemberRepository
  implements WorkspaceMemberRepository
{
  private readonly members = new Map<string, WorkspaceMember>();

  async create(member: WorkspaceMember): Promise<WorkspaceMember> {
    this.members.set(key(member.workspace_id, member.user_id), clone(member));
    return clone(member);
  }

  async find(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const member = this.members.get(key(workspaceId, userId));
    return member ? clone(member) : null;
  }

  async findByUser(userId: string): Promise<WorkspaceMember[]> {
    return [...this.members.values()]
      .filter((m) => m.user_id === userId)
      .map(clone);
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {
    return [...this.members.values()]
      .filter((m) => m.workspace_id === workspaceId)
      .map(clone);
  }

  async save(member: WorkspaceMember): Promise<WorkspaceMember> {
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
