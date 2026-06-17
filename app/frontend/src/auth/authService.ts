// Servicio de autenticacion sobre Supabase Auth (SPEC 018.2). Envuelve las
// llamadas de Supabase y deja la validacion en `authValidation` y las reglas de
// borrado en `accountDeletion`. Nunca guarda contrasenas: las gestiona Supabase.
//
// El perfil publico (`profiles`) lo crea un trigger en la base de datos al
// registrarse (ver supabase/migrations), asi el frontend no inserta perfiles ni
// necesita permisos de escritura ampliados.

import { AuthError, AuthErrorCode } from './authErrors.js';
import { getSupabase } from './supabaseClient.js';
import {
  assertCanDeleteAccount,
  type WorkspaceOwnership,
} from './accountDeletion.js';

export interface AuthProfile {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'student';
  status: 'active' | 'inactive' | 'blocked' | 'deleted';
}

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
}

export async function register(params: RegisterParams): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: { data: { name: params.name } },
  });
  if (error) {
    throw new AuthError([AuthErrorCode.REGISTRATION_FAILED]);
  }
}

export async function login(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new AuthError([AuthErrorCode.INVALID_CREDENTIALS]);
  }
}

export async function logout(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new AuthError([AuthErrorCode.LOGOUT_FAILED]);
  }
}

// Usuario actual: null si no hay sesion; si hay, lee su perfil publico.
export async function getCurrentProfile(): Promise<AuthProfile | null> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    return null;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role, status')
    .eq('id', user.id)
    .single();
  if (profile) {
    return profile as AuthProfile;
  }
  // Sin fila de perfil aun (trigger pendiente): perfil minimo desde la sesion.
  return {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.name as string | undefined) ?? null,
    role: 'student',
    status: 'active',
  };
}

export async function hasSession(): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

// "Has olvidado la contrasena": envia el email de recuperacion. El mensaje al
// usuario debe ser neutral (no revelar si el email existe) y se decide en la UI.
export async function requestPasswordReset(
  email: string,
  redirectTo: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    throw new AuthError([AuthErrorCode.RESET_EMAIL_FAILED]);
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new AuthError([AuthErrorCode.PASSWORD_UPDATE_FAILED]);
  }
}

// Eliminacion de cuenta (MVP): borrado LOGICO. Comprueba las reglas, marca el
// perfil como `deleted` y cierra sesion. El borrado real en auth.users requiere
// la clave de servicio y debe hacerse desde servidor (fuera de alcance aqui).
export async function requestAccountDeletion(args: {
  userId: string;
  confirmed: boolean;
  workspaces: WorkspaceOwnership[];
}): Promise<void> {
  assertCanDeleteAccount(args);
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', args.userId);
  if (error) {
    throw new AuthError([AuthErrorCode.ACCOUNT_DELETE_FAILED]);
  }
  await supabase.auth.signOut();
}
