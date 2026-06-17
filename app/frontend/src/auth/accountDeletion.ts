// Reglas puras de eliminacion de cuenta (SPEC 018.2, 18-19). Se mantiene fuera
// de la red para poder testearlo: decide si un usuario puede eliminar su cuenta
// segun la propiedad de workspaces de organizacion.
//
// Regla central: no se puede eliminar la cuenta si el usuario es el UNICO
// owner/admin activo de algun workspace de ORGANIZACION (dejaria el espacio sin
// responsable). Los workspaces personales no bloquean (se archivan).

import { AuthError, AuthErrorCode } from './authErrors.js';

export interface WorkspaceOwnership {
  id: string;
  type: 'personal' | 'organization';
  /** Ids de miembros activos con rol owner. */
  ownerIds: string[];
  /** Ids de miembros activos con rol admin (pueden asumir gestion). */
  adminIds: string[];
}

// Workspaces de organizacion que quedarian sin owner/admin si el usuario se va.
export function findBlockingWorkspaces(
  userId: string,
  workspaces: WorkspaceOwnership[],
): WorkspaceOwnership[] {
  return workspaces.filter((ws) => {
    if (ws.type !== 'organization') {
      return false;
    }
    if (!ws.ownerIds.includes(userId)) {
      return false;
    }
    const remaining = new Set([...ws.ownerIds, ...ws.adminIds]);
    remaining.delete(userId);
    return remaining.size === 0;
  });
}

export function canDeleteAccount(
  userId: string,
  workspaces: WorkspaceOwnership[],
): boolean {
  return findBlockingWorkspaces(userId, workspaces).length === 0;
}

// Lanza si el usuario no confirmo o si bloquea por ser unico owner.
export function assertCanDeleteAccount(args: {
  userId: string;
  confirmed: boolean;
  workspaces: WorkspaceOwnership[];
}): void {
  if (!args.confirmed) {
    throw new AuthError([AuthErrorCode.ACCOUNT_DELETE_CONFIRMATION_REQUIRED]);
  }
  if (!canDeleteAccount(args.userId, args.workspaces)) {
    throw new AuthError([
      AuthErrorCode.ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED,
    ]);
  }
}
