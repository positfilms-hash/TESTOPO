// Gestion de oposiciones y de acceso de usuarios a oposiciones (SPEC 010, 9-10,
// 14.4-14.10). La logica de permisos vive en `access/permissions`.

import { randomUUID } from 'node:crypto';
import {
  isOppositionStatus,
  type Opposition,
  type OppositionStatus,
} from '../models/opposition.js';
import type {
  OppositionAccess,
  OppositionRole,
} from '../models/oppositionAccess.js';
import type { User } from '../models/user.js';
import type { OppositionRepository } from '../repository/oppositionRepository.js';
import type { OppositionAccessRepository } from '../repository/oppositionAccessRepository.js';
import type { WorkspaceMemberRepository } from '../repository/workspaceMemberRepository.js';
import { AccessError } from '../access/accessError.js';
import { AccessErrorCode } from '../access/accessErrors.js';
import {
  requireAdmin,
  requireManageOpposition,
  requireManageWorkspace,
  requireOppositionAccess,
  requireUser,
} from '../access/permissions.js';

export interface CreateOppositionInput {
  /** Workspace al que pertenece la oposicion (SPEC 011). Obligatorio. */
  workspace_id?: string;
  title?: string;
  slug?: string;
  description?: string | null;
  status?: OppositionStatus;
}

export interface OppositionServiceOptions {
  generateId?: () => string;
  now?: () => Date;
  /**
   * Si se proporciona (SPEC 011), crear una oposicion exige que el actor pueda
   * gestionar el workspace (owner/admin). Si no, solo se exige `workspace_id`.
   */
  workspaceMemberRepository?: WorkspaceMemberRepository;
}

export class OppositionService {
  private readonly generateId: () => string;
  private readonly now: () => Date;
  private readonly members?: WorkspaceMemberRepository;

  constructor(
    private readonly oppositions: OppositionRepository,
    private readonly access: OppositionAccessRepository,
    options: OppositionServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
    this.members = options.workspaceMemberRepository;
  }

  // 14.4 Crear oposicion (solo admin). El creador queda como `owner`.
  // SPEC 011: la oposicion debe pertenecer a un workspace; si hay repo de
  // miembros, el actor debe poder gestionar ese workspace (owner/admin).
  createOpposition(actor: User, input: CreateOppositionInput): Opposition {
    requireAdmin(actor);
    if (!isNonEmptyString(input.workspace_id)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_WORKSPACE_REQUIRED]);
    }
    if (this.members) {
      requireManageWorkspace(this.members, actor, input.workspace_id);
    }
    if (!isNonEmptyString(input.title)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_TITLE_REQUIRED]);
    }
    if (!isNonEmptyString(input.slug)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_SLUG_REQUIRED]);
    }
    const status: OppositionStatus = input.status ?? 'active';
    if (!isOppositionStatus(status)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_INVALID_STATUS]);
    }
    if (this.oppositions.findBySlug(input.slug)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_SLUG_ALREADY_EXISTS]);
    }

    const timestamp = this.now();
    const opposition = this.oppositions.create({
      id: this.generateId(),
      workspace_id: input.workspace_id,
      title: input.title,
      description: input.description ?? null,
      slug: input.slug,
      status,
      created_by: actor.id,
      created_at: timestamp,
      updated_at: timestamp,
    });
    this.upsertAccess(opposition.id, actor.id, 'owner', actor.id);
    return opposition;
  }

  // 14.5 Oposiciones del usuario (admin: las que gestiona; student: con acceso).
  listForUser(user: User): Opposition[] {
    requireUser(user);
    const result: Opposition[] = [];
    for (const access of this.access.findByUser(user.id)) {
      if (access.status !== 'active') {
        continue;
      }
      const opposition = this.oppositions.findById(access.opposition_id);
      if (opposition) {
        result.push(opposition);
      }
    }
    return result;
  }

  // 14.6 Ver oposicion (requiere acceso).
  getOpposition(user: User, oppositionId: string): Opposition {
    requireOppositionAccess(this.access, user, oppositionId);
    const opposition = this.oppositions.findById(oppositionId);
    if (!opposition) {
      throw new AccessError([AccessErrorCode.OPPOSITION_NOT_FOUND]);
    }
    return opposition;
  }

  // 14.7 Editar oposicion (admin gestor).
  editOpposition(
    actor: User,
    oppositionId: string,
    changes: CreateOppositionInput,
  ): Opposition {
    requireManageOpposition(this.access, actor, oppositionId);
    const existing = this.oppositions.findById(oppositionId);
    if (!existing) {
      throw new AccessError([AccessErrorCode.OPPOSITION_NOT_FOUND]);
    }
    const status = changes.status ?? existing.status;
    if (!isOppositionStatus(status)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_INVALID_STATUS]);
    }
    return this.oppositions.save({
      ...existing,
      title: changes.title ?? existing.title,
      description:
        changes.description !== undefined
          ? changes.description
          : existing.description,
      status,
      updated_at: this.now(),
    });
  }

  // 14.8 Dar acceso a un estudiante (admin gestor).
  grantAccess(
    actor: User,
    input: { user_id: string; opposition_id: string; role?: OppositionRole },
  ): OppositionAccess {
    requireManageOpposition(this.access, actor, input.opposition_id);
    if (!this.oppositions.findById(input.opposition_id)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_NOT_FOUND]);
    }
    const existing = this.access.find(input.user_id, input.opposition_id);
    if (existing && existing.status === 'active') {
      throw new AccessError([
        AccessErrorCode.OPPOSITION_ACCESS_ALREADY_EXISTS,
      ]);
    }
    return this.upsertAccess(
      input.opposition_id,
      input.user_id,
      input.role ?? 'student',
      actor.id,
    );
  }

  // 14.9 Revocar acceso (no borra historico).
  revokeAccess(
    actor: User,
    input: { user_id: string; opposition_id: string },
  ): OppositionAccess {
    requireManageOpposition(this.access, actor, input.opposition_id);
    const existing = this.access.find(input.user_id, input.opposition_id);
    if (!existing) {
      throw new AccessError([AccessErrorCode.OPPOSITION_ACCESS_NOT_FOUND]);
    }
    return this.access.save({
      ...existing,
      status: 'revoked',
      updated_at: this.now(),
    });
  }

  // 14.10 Listar estudiantes de una oposicion (admin gestor).
  listStudents(actor: User, oppositionId: string): OppositionAccess[] {
    requireManageOpposition(this.access, actor, oppositionId);
    return this.access
      .findByOpposition(oppositionId)
      .filter((a) => a.role_in_opposition === 'student');
  }

  private upsertAccess(
    oppositionId: string,
    userId: string,
    role: OppositionRole,
    grantedBy: string,
  ): OppositionAccess {
    const timestamp = this.now();
    const existing = this.access.find(userId, oppositionId);
    if (existing) {
      return this.access.save({
        ...existing,
        role_in_opposition: role,
        status: 'active',
        granted_by: grantedBy,
        updated_at: timestamp,
      });
    }
    return this.access.create({
      id: this.generateId(),
      user_id: userId,
      opposition_id: oppositionId,
      role_in_opposition: role,
      status: 'active',
      granted_by: grantedBy,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
