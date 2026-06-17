// Gestion de workspaces y de su membresia (SPEC 011, 15). Un workspace agrupa
// oposiciones; el creador queda como `owner`. La logica de permisos vive en
// `access/permissions`.

import { randomUUID } from 'node:crypto';
import {
  isWorkspacePlan,
  isWorkspaceStatus,
  isWorkspaceType,
  type Workspace,
  type WorkspacePlan,
  type WorkspaceStatus,
  type WorkspaceType,
} from '../models/workspace.js';
import {
  isWorkspaceRole,
  type WorkspaceMember,
  type WorkspaceRole,
} from '../models/workspaceMember.js';
import type { User } from '../models/user.js';
import type { WorkspaceRepository } from '../repository/workspaceRepository.js';
import type { WorkspaceMemberRepository } from '../repository/workspaceMemberRepository.js';
import { AccessError } from '../access/accessError.js';
import { AccessErrorCode } from '../access/accessErrors.js';
import {
  requireManageWorkspace,
  requireUser,
  requireWorkspaceMember,
} from '../access/permissions.js';

export interface WorkspaceServiceOptions {
  generateId?: () => string;
  now?: () => Date;
}

export class WorkspaceService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceMemberRepository,
    options: WorkspaceServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 15.1 Crear workspace personal (plan free o premium).
  createPersonalWorkspace(
    owner: User,
    input: { name?: string; slug?: string; plan?: WorkspacePlan },
  ): Workspace {
    const plan: WorkspacePlan = input.plan ?? 'free';
    if (plan !== 'free' && plan !== 'premium') {
      throw new AccessError([AccessErrorCode.WORKSPACE_INVALID_PLAN]);
    }
    return this.create(owner, {
      name: input.name,
      slug: input.slug,
      type: 'personal',
      plan,
    });
  }

  // 15.2 Crear workspace de organizacion (plan organization).
  createOrganizationWorkspace(
    owner: User,
    input: { name?: string; slug?: string },
  ): Workspace {
    return this.create(owner, {
      name: input.name,
      slug: input.slug,
      type: 'organization',
      plan: 'organization',
    });
  }

  // 15.3 Workspaces donde el usuario es miembro activo.
  listForUser(user: User): Workspace[] {
    requireUser(user);
    const result: Workspace[] = [];
    for (const member of this.members.findByUser(user.id)) {
      if (member.status !== 'active') {
        continue;
      }
      const workspace = this.workspaces.findById(member.workspace_id);
      if (workspace) {
        result.push(workspace);
      }
    }
    return result;
  }

  // 15.4 Ver workspace (solo miembro activo).
  getWorkspace(user: User, workspaceId: string): Workspace {
    requireWorkspaceMember(this.members, user, workspaceId);
    const workspace = this.workspaces.findById(workspaceId);
    if (!workspace) {
      throw new AccessError([AccessErrorCode.WORKSPACE_NOT_FOUND]);
    }
    return workspace;
  }

  // 15.5 Editar workspace (owner/admin).
  editWorkspace(
    actor: User,
    workspaceId: string,
    changes: { name?: string; status?: WorkspaceStatus },
  ): Workspace {
    requireManageWorkspace(this.members, actor, workspaceId);
    const existing = this.workspaces.findById(workspaceId);
    if (!existing) {
      throw new AccessError([AccessErrorCode.WORKSPACE_NOT_FOUND]);
    }
    const status = changes.status ?? existing.status;
    if (!isWorkspaceStatus(status)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_INVALID_STATUS]);
    }
    return this.workspaces.save({
      ...existing,
      name: changes.name ?? existing.name,
      status,
      updated_at: this.now(),
    });
  }

  // 15.6 Anadir miembro (owner/admin). Rol admin o student.
  addMember(
    actor: User,
    input: { workspace_id: string; user_id: string; role: WorkspaceRole },
  ): WorkspaceMember {
    requireManageWorkspace(this.members, actor, input.workspace_id);
    if (input.role !== 'admin' && input.role !== 'student') {
      throw new AccessError([AccessErrorCode.WORKSPACE_MEMBER_INVALID_ROLE]);
    }
    const existing = this.members.find(input.workspace_id, input.user_id);
    if (existing && existing.status === 'active') {
      throw new AccessError([
        AccessErrorCode.WORKSPACE_MEMBER_ALREADY_EXISTS,
      ]);
    }
    return this.upsertMember(input.workspace_id, input.user_id, input.role);
  }

  // 15.7 Revocar miembro (no borra historico).
  revokeMember(
    actor: User,
    input: { workspace_id: string; user_id: string },
  ): WorkspaceMember {
    requireManageWorkspace(this.members, actor, input.workspace_id);
    const existing = this.members.find(input.workspace_id, input.user_id);
    if (!existing) {
      throw new AccessError([AccessErrorCode.WORKSPACE_MEMBER_NOT_FOUND]);
    }
    return this.members.save({
      ...existing,
      status: 'revoked',
      updated_at: this.now(),
    });
  }

  listMembers(actor: User, workspaceId: string): WorkspaceMember[] {
    requireManageWorkspace(this.members, actor, workspaceId);
    return this.members.findByWorkspace(workspaceId);
  }

  private create(
    owner: User | null | undefined,
    input: {
      name?: string;
      slug?: string;
      type: WorkspaceType;
      plan: WorkspacePlan;
      status?: WorkspaceStatus;
    },
  ): Workspace {
    if (!owner) {
      throw new AccessError([AccessErrorCode.WORKSPACE_OWNER_REQUIRED]);
    }
    if (!isNonEmptyString(input.name)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_NAME_REQUIRED]);
    }
    if (!isNonEmptyString(input.slug)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_SLUG_REQUIRED]);
    }
    if (!isWorkspaceType(input.type)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_INVALID_TYPE]);
    }
    if (!isWorkspacePlan(input.plan)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_INVALID_PLAN]);
    }
    const status: WorkspaceStatus = input.status ?? 'active';
    if (!isWorkspaceStatus(status)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_INVALID_STATUS]);
    }
    if (this.workspaces.findBySlug(input.slug)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_SLUG_ALREADY_EXISTS]);
    }

    const timestamp = this.now();
    const workspace = this.workspaces.create({
      id: this.generateId(),
      name: input.name,
      slug: input.slug,
      type: input.type,
      plan: input.plan,
      status,
      owner_id: owner.id,
      created_at: timestamp,
      updated_at: timestamp,
    });
    this.upsertMember(workspace.id, owner.id, 'owner');
    return workspace;
  }

  private upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): WorkspaceMember {
    if (!isWorkspaceRole(role)) {
      throw new AccessError([AccessErrorCode.WORKSPACE_MEMBER_INVALID_ROLE]);
    }
    const timestamp = this.now();
    const existing = this.members.find(workspaceId, userId);
    if (existing) {
      return this.members.save({
        ...existing,
        role,
        status: 'active',
        updated_at: timestamp,
      });
    }
    return this.members.create({
      id: this.generateId(),
      workspace_id: workspaceId,
      user_id: userId,
      role,
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
