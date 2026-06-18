// TESTOPO - Edge Function: delete-account (SPEC 026).
//
// Eliminacion segura de cuenta. Operacion PRIVILEGIADA: usa la service role para
// (1) revocar accesos, (2) archivar el workspace personal, (3) soft-delete del
// perfil y (4) borrar el usuario de Supabase Auth. La service role NUNCA llega al
// navegador: solo vive aqui (Edge Function) como secreto de servidor.
//
// Reglas de seguridad (ver docs/security/account-deletion.md):
//   - El `user_id` se infiere SIEMPRE del JWT, nunca del body (no se puede borrar
//     otra cuenta pasando un id).
//   - Confirmacion explicita: el body debe traer { confirmation: "ELIMINAR" }.
//   - Bloqueo si el usuario es el UNICO owner/admin activo de un workspace de
//     organizacion (dejaria el espacio sin responsable).
//   - No borra en cascada datos compartidos (materiales/preguntas/tests/resultados).
//
// Despliegue y secretos: docs/setup/supabase-edge-functions.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CONFIRMATION_PHRASE = 'ELIMINAR';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'ACCOUNT_DELETE_INVALID_REQUEST' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'SERVICE_ROLE_NOT_CONFIGURED' }, 500);
  }

  // 1) Autenticacion: el id viene del JWT del usuario, no del body.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return json({ error: 'ACCOUNT_DELETE_AUTH_REQUIRED' }, 401);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'ACCOUNT_DELETE_AUTH_REQUIRED' }, 401);
  }
  const userId = userData.user.id;

  // 2) Confirmacion explicita.
  let body: { confirmation?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'ACCOUNT_DELETE_INVALID_REQUEST' }, 400);
  }
  if (body.confirmation !== CONFIRMATION_PHRASE) {
    return json({ error: 'ACCOUNT_DELETE_CONFIRMATION_REQUIRED' }, 400);
  }

  // Cliente admin (service role): se salta RLS, por eso valida todo a mano.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3) El perfil debe existir.
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, status')
    .eq('id', userId)
    .maybeSingle();
  if (profileErr) {
    return json({ error: 'ACCOUNT_DELETE_FAILED' }, 500);
  }
  if (!profile) {
    return json({ error: 'ACCOUNT_DELETE_PROFILE_NOT_FOUND' }, 404);
  }

  // 4) Bloqueo: unico owner/admin activo de un workspace de organizacion.
  const { data: ownerMemberships, error: memErr } = await admin
    .from('workspace_members')
    .select('workspace_id, workspaces(type)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active');
  if (memErr) {
    return json({ error: 'ACCOUNT_DELETE_FAILED' }, 500);
  }
  for (const m of ownerMemberships ?? []) {
    const ws = (m as { workspaces?: { type?: string } }).workspaces;
    if (ws?.type !== 'organization') {
      continue;
    }
    const workspaceId = (m as { workspace_id: string }).workspace_id;
    const { count, error: countErr } = await admin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin'])
      .neq('user_id', userId);
    if (countErr) {
      return json({ error: 'ACCOUNT_DELETE_FAILED' }, 500);
    }
    if ((count ?? 0) === 0) {
      return json({ error: 'ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED' }, 409);
    }
  }

  const now = new Date().toISOString();

  // 5) Soft-delete del perfil (no se muestran datos personales de `deleted`).
  const { error: softErr } = await admin
    .from('profiles')
    .update({ status: 'deleted', name: 'Usuario eliminado', updated_at: now })
    .eq('id', userId);
  if (softErr) {
    return json({ error: 'ACCOUNT_DELETE_FAILED' }, 500);
  }

  // 6) Revocar memberships y accesos (no se borran filas: integridad historica).
  const { error: revMemErr } = await admin
    .from('workspace_members')
    .update({ status: 'revoked', updated_at: now })
    .eq('user_id', userId);
  if (revMemErr) {
    return json({ error: 'ACCOUNT_DELETE_ACCESS_REVOKE_FAILED' }, 500);
  }
  const { error: revAccErr } = await admin
    .from('opposition_access')
    .update({ status: 'revoked', updated_at: now })
    .eq('user_id', userId);
  if (revAccErr) {
    return json({ error: 'ACCOUNT_DELETE_ACCESS_REVOKE_FAILED' }, 500);
  }

  // 7) Archivar workspaces PERSONALES del usuario (los de organizacion no).
  const { error: archErr } = await admin
    .from('workspaces')
    .update({ status: 'archived', updated_at: now })
    .eq('owner_id', userId)
    .eq('type', 'personal');
  if (archErr) {
    return json({ error: 'ACCOUNT_DELETE_WORKSPACE_ARCHIVE_FAILED' }, 500);
  }

  // 8) Borrado real del usuario Auth (Admin API). Si falla, el perfil ya quedo
  //    `deleted` (soft delete fuerte): el usuario no puede usar la app igualmente.
  const { error: authDelErr } = await admin.auth.admin.deleteUser(userId);
  if (authDelErr) {
    return json(
      { ok: true, auth_deleted: false, warning: 'ACCOUNT_DELETE_AUTH_DELETE_FAILED' },
      200,
    );
  }

  return json({ ok: true, auth_deleted: true });
});
