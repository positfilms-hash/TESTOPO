// Guardas de permisos reutilizables (SPEC 010, 13 y 20). Centralizan las
// comprobaciones de rol y de acceso a oposicion para no repetirlas.
//
// SPEC 018.3: la capa de repositorios es asincrona, asi que las guardas que
// consultan repositorios devuelven `Promise`. Las puramente sincronas
// (requireUser/requireAdmin) se mantienen sincronas.

import type { User } from '../models/user.js';
import type { OppositionAccessRepository } from '../repository/oppositionAccessRepository.js';
import type { WorkspaceMemberRepository } from '../repository/workspaceMemberRepository.js';
import { AccessError } from './accessError.js';
import { AccessErrorCode } from './accessErrors.js';

export function requireUser(user: User | null | undefined): User {
  if (!user) {
    throw new AccessError([AccessErrorCode.AUTH_REQUIRED]);
  }
  return user;
}

export function requireAdmin(user: User | null | undefined): User {
  const current = requireUser(user);
  if (current.role !== 'admin') {
    throw new AccessError([AccessErrorCode.ADMIN_ACCESS_REQUIRED]);
  }
  return current;
}

export async function hasActiveAccess(
  accessRepo: OppositionAccessRepository,
  userId: string,
  oppositionId: string,
): Promise<boolean> {
  const access = await accessRepo.find(userId, oppositionId);
  return access !== null && access.status === 'active';
}

export async function canManageOpposition(
  accessRepo: OppositionAccessRepository,
  user: User,
  oppositionId: string,
): Promise<boolean> {
  if (user.role !== 'admin') {
    return false;
  }
  const access = await accessRepo.find(user.id, oppositionId);
  return (
    access !== null &&
    access.status === 'active' &&
    (access.role_in_opposition === 'owner' ||
      access.role_in_opposition === 'manager')
  );
}

// Acceso de lectura/uso (admin gestor o estudiante con acceso activo).
export async function requireOppositionAccess(
  accessRepo: OppositionAccessRepository,
  user: User | null | undefined,
  oppositionId: string,
): Promise<User> {
  const current = requireUser(user);
  if (await canManageOpposition(accessRepo, current, oppositionId)) {
    return current;
  }
  if (await hasActiveAccess(accessRepo, current.id, oppositionId)) {
    return current;
  }
  throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
}

// Acceso de gestion (admin con rol owner/manager en la oposicion).
export async function requireManageOpposition(
  accessRepo: OppositionAccessRepository,
  user: User | null | undefined,
  oppositionId: string,
): Promise<User> {
  const current = requireAdmin(user);
  if (!(await canManageOpposition(accessRepo, current, oppositionId))) {
    throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
  }
  return current;
}

// Acceso de estudiante con matricula activa en la oposicion.
export async function requireStudentAccess(
  accessRepo: OppositionAccessRepository,
  user: User | null | undefined,
  oppositionId: string,
): Promise<User> {
  const current = requireUser(user);
  if (
    (await canManageOpposition(accessRepo, current, oppositionId)) ||
    (await hasActiveAccess(accessRepo, current.id, oppositionId))
  ) {
    return current;
  }
  throw new AccessError([AccessErrorCode.STUDENT_ACCESS_REQUIRED]);
}

// --- Workspaces (SPEC 011) -------------------------------------------------

export async function isActiveWorkspaceMember(
  memberRepo: WorkspaceMemberRepository,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const member = await memberRepo.find(workspaceId, userId);
  return member !== null && member.status === 'active';
}

// owner/admin activos pueden gestionar el workspace y crear oposiciones.
export async function canManageWorkspace(
  memberRepo: WorkspaceMemberRepository,
  user: User,
  workspaceId: string,
): Promise<boolean> {
  const member = await memberRepo.find(workspaceId, user.id);
  return (
    member !== null &&
    member.status === 'active' &&
    (member.role === 'owner' || member.role === 'admin')
  );
}

export async function requireWorkspaceMember(
  memberRepo: WorkspaceMemberRepository,
  user: User | null | undefined,
  workspaceId: string,
): Promise<User> {
  const current = requireUser(user);
  if (!(await isActiveWorkspaceMember(memberRepo, current.id, workspaceId))) {
    throw new AccessError([AccessErrorCode.WORKSPACE_ACCESS_DENIED]);
  }
  return current;
}

export async function requireManageWorkspace(
  memberRepo: WorkspaceMemberRepository,
  user: User | null | undefined,
  workspaceId: string,
): Promise<User> {
  const current = requireUser(user);
  if (!(await canManageWorkspace(memberRepo, current, workspaceId))) {
    throw new AccessError([AccessErrorCode.WORKSPACE_ACCESS_DENIED]);
  }
  return current;
}
