// Relacion usuario-oposicion: que usuario puede acceder a que oposicion y con
// que rol dentro de ella (SPEC 010, 10).

export const OPPOSITION_ROLES = ['owner', 'manager', 'student'] as const;
export type OppositionRole = (typeof OPPOSITION_ROLES)[number];

export const ACCESS_STATUSES = ['active', 'revoked', 'pending'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

export interface OppositionAccess {
  id: string;
  user_id: string;
  opposition_id: string;
  role_in_opposition: OppositionRole;
  status: AccessStatus;
  granted_by: string | null;
  created_at: Date;
  updated_at: Date;
}
