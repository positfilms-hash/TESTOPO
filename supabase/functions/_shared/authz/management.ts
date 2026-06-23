// TESTOPO - SPEC 033/034: autorizacion de GESTION explicita y PURA, compartida
// por las Edge Functions `generate-questions` y `ocr-material`.
//
// La RLS de Supabase es el backstop, pero la revision pide una guarda de rol
// EXPLICITA en la propia funcion: el Student, un usuario eliminado/revocado o
// fuera de scope deben fallar ANTES de tocar el proveedor, Storage o cualquier
// escritura. Esta logica es determinista y se testea con vitest (sin red).
//
// Regla canonica = la de `public.can_manage_workspace` (0001_init.sql): miembro
// del workspace con `status = 'active'` y `role in ('owner','admin')`. Ademas el
// perfil del actor no puede estar `deleted` (profiles.status).

export interface ProfileLike {
  // profiles.status: active | inactive | blocked | deleted
  status?: string | null;
}

export interface WorkspaceMemberLike {
  // workspace_members.role: owner | admin | student
  role?: string | null;
  // workspace_members.status: active | revoked | pending
  status?: string | null;
}

export type ManagementAccess =
  | { ok: true }
  | { ok: false; reason: 'auth_required' | 'access_denied' };

// Roles de miembro que pueden GESTIONAR (crear preguntas, lanzar OCR, etc.).
const MANAGEMENT_ROLES = new Set(['owner', 'admin']);

// Evalua el permiso de gestion del actor sobre un workspace concreto. No confia
// en ningun `user_id` del body: el `profile` y la `membership` los recupera la
// Edge Function desde el JWT verificado y la tabla `workspace_members`.
export function evaluateManagementAccess(args: {
  profile: ProfileLike | null | undefined;
  membership: WorkspaceMemberLike | null | undefined;
}): ManagementAccess {
  const { profile, membership } = args;

  // Usuario eliminado/bloqueado/sin perfil: no puede operar (aunque tenga JWT vivo).
  if (!profile || profile.status === 'deleted' || profile.status === 'blocked') {
    return { ok: false, reason: 'auth_required' };
  }

  // Sin membership, revocada/pendiente, o rol no gestor (p. ej. student): denegado.
  if (
    !membership ||
    membership.status !== 'active' ||
    !MANAGEMENT_ROLES.has((membership.role ?? '').toLowerCase())
  ) {
    return { ok: false, reason: 'access_denied' };
  }

  return { ok: true };
}
