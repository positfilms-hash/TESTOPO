// Usuario de la plataforma (SPEC 010, 7).

export const USER_ROLES = ['admin', 'student'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'inactive', 'blocked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  /** Hash de la contrasena. Nunca se guarda en texto plano. */
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isUserStatus(value: unknown): value is UserStatus {
  return USER_STATUSES.includes(value as UserStatus);
}
