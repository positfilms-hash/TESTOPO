import type { WorkspaceMember } from '../models/workspaceMember.js';

export interface WorkspaceMemberRepository {
  create(member: WorkspaceMember): Promise<WorkspaceMember>;
  find(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  findByUser(userId: string): Promise<WorkspaceMember[]>;
  findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
  save(member: WorkspaceMember): Promise<WorkspaceMember>;
}
