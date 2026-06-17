import type { WorkspaceMember } from '../models/workspaceMember.js';

export interface WorkspaceMemberRepository {
  create(member: WorkspaceMember): WorkspaceMember;
  find(workspaceId: string, userId: string): WorkspaceMember | null;
  findByUser(userId: string): WorkspaceMember[];
  findByWorkspace(workspaceId: string): WorkspaceMember[];
  save(member: WorkspaceMember): WorkspaceMember;
}
