// SPEC 018.2 - validaciones puras de los formularios de auth.
import { describe, expect, it } from 'vitest';
import {
  validateRegister,
  validateLogin,
  validateNewPassword,
} from '../src/auth/authValidation.js';
import { AuthErrorCode } from '../src/auth/authErrors.js';

describe('SPEC 018.2 - validacion de registro', () => {
  it('acepta un registro valido', () => {
    expect(
      validateRegister({ name: 'Ana', email: 'a@b.com', password: 'secreto12', confirmPassword: 'secreto12' }),
    ).toEqual([]);
  });
  it('exige email', () => {
    expect(
      validateRegister({ email: '', password: 'x', confirmPassword: 'x' }),
    ).toContain(AuthErrorCode.EMAIL_REQUIRED);
  });
  it('exige password', () => {
    expect(
      validateRegister({ email: 'a@b.com', password: '', confirmPassword: '' }),
    ).toContain(AuthErrorCode.PASSWORD_REQUIRED);
  });
  it('exige confirmacion', () => {
    expect(
      validateRegister({ email: 'a@b.com', password: 'x', confirmPassword: '' }),
    ).toContain(AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED);
  });
  it('rechaza passwords distintas', () => {
    expect(
      validateRegister({ email: 'a@b.com', password: 'uno', confirmPassword: 'dos' }),
    ).toContain(AuthErrorCode.PASSWORDS_DO_NOT_MATCH);
  });
});

describe('SPEC 018.2 - validacion de login', () => {
  it('acepta login valido', () => {
    expect(validateLogin({ email: 'a@b.com', password: 'x' })).toEqual([]);
  });
  it('exige email y password', () => {
    const codes = validateLogin({ email: '', password: '' });
    expect(codes).toContain(AuthErrorCode.EMAIL_REQUIRED);
    expect(codes).toContain(AuthErrorCode.PASSWORD_REQUIRED);
  });
});

describe('SPEC 018.2 - validacion de nueva contrasena (reset)', () => {
  it('valida coincidencia', () => {
    expect(
      validateNewPassword({ password: 'uno', confirmPassword: 'dos' }),
    ).toContain(AuthErrorCode.PASSWORDS_DO_NOT_MATCH);
  });
  it('exige confirmacion', () => {
    expect(
      validateNewPassword({ password: 'uno', confirmPassword: '' }),
    ).toContain(AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED);
  });
  it('acepta dos iguales', () => {
    expect(
      validateNewPassword({ password: 'secreto12', confirmPassword: 'secreto12' }),
    ).toEqual([]);
  });
});
