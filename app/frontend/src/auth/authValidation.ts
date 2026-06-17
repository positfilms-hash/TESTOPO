// Validaciones puras de los formularios de auth (SPEC 018.2). No tocan red ni
// Supabase: devuelven la lista de codigos de error para que la UI los muestre.

import { AuthErrorCode } from './authErrors.js';

export interface RegisterInput {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface LoginInput {
  email?: string;
  password?: string;
}

export interface NewPasswordInput {
  password?: string;
  confirmPassword?: string;
}

export function validateRegister(input: RegisterInput): AuthErrorCode[] {
  const codes: AuthErrorCode[] = [];
  if (!isNonEmpty(input.email)) {
    codes.push(AuthErrorCode.EMAIL_REQUIRED);
  }
  codes.push(...validatePasswordPair(input.password, input.confirmPassword));
  return codes;
}

export function validateLogin(input: LoginInput): AuthErrorCode[] {
  const codes: AuthErrorCode[] = [];
  if (!isNonEmpty(input.email)) {
    codes.push(AuthErrorCode.EMAIL_REQUIRED);
  }
  if (!isNonEmpty(input.password)) {
    codes.push(AuthErrorCode.PASSWORD_REQUIRED);
  }
  return codes;
}

// Reutilizado por registro y por restablecer contrasena.
export function validateNewPassword(input: NewPasswordInput): AuthErrorCode[] {
  return validatePasswordPair(input.password, input.confirmPassword);
}

function validatePasswordPair(
  password?: string,
  confirmPassword?: string,
): AuthErrorCode[] {
  const codes: AuthErrorCode[] = [];
  if (!isNonEmpty(password)) {
    codes.push(AuthErrorCode.PASSWORD_REQUIRED);
  }
  if (!isNonEmpty(confirmPassword)) {
    codes.push(AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED);
  }
  // Solo comparamos si ambas tienen contenido (evita ruido de errores).
  if (
    isNonEmpty(password) &&
    isNonEmpty(confirmPassword) &&
    password !== confirmPassword
  ) {
    codes.push(AuthErrorCode.PASSWORDS_DO_NOT_MATCH);
  }
  return codes;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
