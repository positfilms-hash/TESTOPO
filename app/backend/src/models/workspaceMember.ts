// Relacion usuario-workspace (SPEC 011, 8). Define el rol de un usuario dentro
// de un workspace. El rol (lo que puede hacer) es distinto del plan (tipo de
// cuenta del workspace).

export const WORKSPACE_ROLES = ['owner', 'admin', 'student'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_MEMBER_STATUSES = [
  'active',
  'revoked',
  'pending',
] as const;
export type WorkspaceMemberStatus =
  (typeof WORKSPACE_MEMBER_STATUSES)[number];

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  created_at: Date;
  updated_at: Date;
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return WORKSPACE_ROLES.includes(value as WorkspaceRole);
}
