// Codigos de error de autenticacion y cuenta (SPEC 018.2, 22). La capa de UI
// los traduce a mensajes en espanol; aqui solo se definen de forma estable.

export enum AuthErrorCode {
  EMAIL_REQUIRED = 'AUTH_EMAIL_REQUIRED',
  PASSWORD_REQUIRED = 'AUTH_PASSWORD_REQUIRED',
  PASSWORD_CONFIRMATION_REQUIRED = 'AUTH_PASSWORD_CONFIRMATION_REQUIRED',
  PASSWORDS_DO_NOT_MATCH = 'AUTH_PASSWORDS_DO_NOT_MATCH',
  INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  REGISTRATION_FAILED = 'AUTH_REGISTRATION_FAILED',
  LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  LOGOUT_FAILED = 'AUTH_LOGOUT_FAILED',
  SESSION_REQUIRED = 'AUTH_SESSION_REQUIRED',
  RESET_EMAIL_FAILED = 'AUTH_RESET_EMAIL_FAILED',
  PASSWORD_UPDATE_FAILED = 'AUTH_PASSWORD_UPDATE_FAILED',
  ACCOUNT_DELETE_CONFIRMATION_REQUIRED = 'ACCOUNT_DELETE_CONFIRMATION_REQUIRED',
  ACCOUNT_DELETE_FAILED = 'ACCOUNT_DELETE_FAILED',
  ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED = 'ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED',
  SUPABASE_NOT_CONFIGURED = 'SUPABASE_NOT_CONFIGURED',
}

// Longitud minima razonable de contrasena (Supabase tambien la valida en
// servidor). Se usa solo como guia de UI; no inventamos un codigo nuevo.
export const MIN_PASSWORD_LENGTH = 8;

export class AuthError extends Error {
  readonly codes: AuthErrorCode[];

  constructor(codes: AuthErrorCode[]) {
    super(`Auth error: ${codes.join(', ')}`);
    this.name = 'AuthError';
    this.codes = codes;
  }
}

// Mensajes en espanol para mostrar al usuario (SPEC 018.2, 23).
export const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.EMAIL_REQUIRED]: 'Introduce tu email.',
  [AuthErrorCode.PASSWORD_REQUIRED]: 'Introduce una contrasena valida.',
  [AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED]: 'Confirma la contrasena.',
  [AuthErrorCode.PASSWORDS_DO_NOT_MATCH]: 'Las contrasenas no coinciden.',
  [AuthErrorCode.INVALID_CREDENTIALS]: 'Email o contrasena incorrectos.',
  [AuthErrorCode.REGISTRATION_FAILED]: 'No se pudo crear la cuenta.',
  [AuthErrorCode.LOGIN_FAILED]: 'No se pudo iniciar sesion.',
  [AuthErrorCode.LOGOUT_FAILED]: 'No se pudo cerrar sesion.',
  [AuthErrorCode.SESSION_REQUIRED]: 'Inicia sesion para continuar.',
  [AuthErrorCode.RESET_EMAIL_FAILED]: 'No se pudo enviar el email de recuperacion.',
  [AuthErrorCode.PASSWORD_UPDATE_FAILED]: 'No se pudo actualizar la contrasena.',
  [AuthErrorCode.ACCOUNT_DELETE_CONFIRMATION_REQUIRED]:
    'Debes confirmar para eliminar la cuenta.',
  [AuthErrorCode.ACCOUNT_DELETE_FAILED]: 'No se pudo eliminar la cuenta.',
  [AuthErrorCode.ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED]:
    'No puedes eliminar tu cuenta porque eres el unico propietario de un workspace.',
  [AuthErrorCode.SUPABASE_NOT_CONFIGURED]:
    'La autenticacion no esta configurada. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
};

export function authMessage(code: AuthErrorCode): string {
  return AUTH_MESSAGES[code] ?? 'Ha ocurrido un error.';
}
