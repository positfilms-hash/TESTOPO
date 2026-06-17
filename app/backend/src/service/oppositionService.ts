// Gestion de oposiciones y de acceso de usuarios a oposiciones (SPEC 010 + 011).
//
// SPEC 011 (workspace-first): el acceso a una oposicion se decide por la
// membresia activa del workspace al que pertenece y por el rol DENTRO del
// workspace (owner/admin gestionan; student estudia con acceso a la oposicion).
// El `User.role` global ya no decide capacidades aqui.

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
  canManageWorkspace,
  hasActiveAccess,
  isActiveWorkspaceMember,
  requireManageWorkspace,
  requireUser,
  requireWorkspaceMember,
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
}

export class OppositionService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly oppositions: OppositionRepository,
    private readonly access: OppositionAccessRepository,
    private readonly members: WorkspaceMemberRepository,
    options: OppositionServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // Crear oposicion: la crea quien puede gestionar el workspace (owner/admin del
  // workspace), no un admin global. El creador queda como `owner` de la oposicion.
  async createOpposition(
    actor: User,
    input: CreateOppositionInput,
  ): Promise<Opposition> {
    requireUser(actor);
    if (!isNonEmptyString(input.workspace_id)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_WORKSPACE_REQUIRED]);
    }
    await requireManageWorkspace(this.members, actor, input.workspace_id);
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
    if (await this.oppositions.findBySlug(input.slug)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_SLUG_ALREADY_EXISTS]);
    }

    const timestamp = this.now();
    const opposition = await this.oppositions.create({
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
    await this.upsertAccess(opposition.id, actor.id, 'owner', actor.id);
    return opposition;
  }

  // Oposiciones visibles: el usuario debe ser miembro activo del workspace de la
  // oposicion y, o bien gestionarlo (ve todas), o tener acceso a la oposicion.
  async listForUser(user: User): Promise<Opposition[]> {
    requireUser(user);
    const all = await this.oppositions.findAll();
    const result: Opposition[] = [];
    for (const opp of all) {
      if (
        !(await isActiveWorkspaceMember(this.members, user.id, opp.workspace_id))
      ) {
        continue;
      }
      if (
        (await canManageWorkspace(this.members, user, opp.workspace_id)) ||
        (await hasActiveAccess(this.access, user.id, opp.id))
      ) {
        result.push(opp);
      }
    }
    return result;
  }

  // ¿El usuario tiene acceso de ESTUDIO (matricula activa) a alguna oposicion
  // del workspace? (SPEC 014: decide la zona estudiante y el selector de modo).
  // Es independiente de gestionar el workspace: un gestor puede ademas estudiar.
  async hasStudyAccess(user: User, workspaceId: string): Promise<boolean> {
    requireUser(user);
    const all = await this.oppositions.findAll();
    for (const opp of all) {
      if (
        opp.workspace_id === workspaceId &&
        (await this.isActiveStudent(user.id, opp.id))
      ) {
        return true;
      }
    }
    return false;
  }

  // Oposiciones en las que el usuario estudia (matricula de estudiante activa),
  // sin contar las que solo puede gestionar como owner (SPEC 014: la creacion
  // de una oposicion matricula al creador como `owner`, eso NO es estudiar).
  async listStudyOppositions(user: User): Promise<Opposition[]> {
    requireUser(user);
    const all = await this.oppositions.findAll();
    const result: Opposition[] = [];
    for (const opp of all) {
      if (await this.isActiveStudent(user.id, opp.id)) {
        result.push(opp);
      }
    }
    return result;
  }

  // Matricula de ESTUDIANTE activa (excluye owner/manager).
  private async isActiveStudent(
    userId: string,
    oppositionId: string,
  ): Promise<boolean> {
    const access = await this.access.find(userId, oppositionId);
    return (
      access !== null &&
      access.status === 'active' &&
      access.role_in_opposition === 'student'
    );
  }

  // Ver oposicion: miembro del workspace + (gestor del workspace o acceso a la
  // oposicion).
  async getOpposition(user: User, oppositionId: string): Promise<Opposition> {
    const opposition = await this.oppositions.findById(oppositionId);
    if (!opposition) {
      throw new AccessError([AccessErrorCode.OPPOSITION_NOT_FOUND]);
    }
    await requireWorkspaceMember(this.members, user, opposition.workspace_id);
    if (
      !(await canManageWorkspace(this.members, user, opposition.workspace_id)) &&
      !(await hasActiveAccess(this.access, user.id, oppositionId))
    ) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
    return opposition;
  }

  // Editar oposicion: gestor del workspace de esa oposicion.
  async editOpposition(
    actor: User,
    oppositionId: string,
    changes: CreateOppositionInput,
  ): Promise<Opposition> {
    const existing = await this.requireManagedOpposition(actor, oppositionId);
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

  // Dar acceso a un usuario a una oposicion (gestor del workspace).
  async grantAccess(
    actor: User,
    input: { user_id: string; opposition_id: string; role?: OppositionRole },
  ): Promise<OppositionAccess> {
    await this.requireManagedOpposition(actor, input.opposition_id);
    const existing = await this.access.find(input.user_id, input.opposition_id);
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

  async revokeAccess(
    actor: User,
    input: { user_id: string; opposition_id: string },
  ): Promise<OppositionAccess> {
    await this.requireManagedOpposition(actor, input.opposition_id);
    const existing = await this.access.find(input.user_id, input.opposition_id);
    if (!existing) {
      throw new AccessError([AccessErrorCode.OPPOSITION_ACCESS_NOT_FOUND]);
    }
    return this.access.save({
      ...existing,
      status: 'revoked',
      updated_at: this.now(),
    });
  }

  async listStudents(
    actor: User,
    oppositionId: string,
  ): Promise<OppositionAccess[]> {
    await this.requireManagedOpposition(actor, oppositionId);
    const access = await this.access.findByOpposition(oppositionId);
    return access.filter((a) => a.role_in_opposition === 'student');
  }

  // Resuelve la oposicion y exige que el actor gestione su workspace.
  private async requireManagedOpposition(
    actor: User,
    oppositionId: string,
  ): Promise<Opposition> {
    const opposition = await this.oppositions.findById(oppositionId);
    if (!opposition) {
      throw new AccessError([AccessErrorCode.OPPOSITION_NOT_FOUND]);
    }
    await requireManageWorkspace(this.members, actor, opposition.workspace_id);
    return opposition;
  }

  private async upsertAccess(
    oppositionId: string,
    userId: string,
    role: OppositionRole,
    grantedBy: string,
  ): Promise<OppositionAccess> {
    const timestamp = this.now();
    const existing = await this.access.find(userId, oppositionId);
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
