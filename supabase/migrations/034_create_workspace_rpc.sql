-- TESTOPO - RPC atomica para crear el PRIMER workspace + membership owner.
--
-- P0: el bootstrap del primer workspace no es atomico y choca con la RLS. La app
-- insertaba el workspace con `.insert().select().single()` y luego creaba la
-- membership en pasos separados; pero:
--   - tras el INSERT, el actor aun NO es miembro, asi que la RLS
--     (workspaces_select_member) no le deja LEER la fila recien creada -> el
--     `.select().single()` falla;
--   - la policy members_insert_self_owner consulta public.workspaces BAJO RLS,
--     asi que tampoco puede verificar el workspace recien creado.
--
-- Solucion minima y ATOMICA: una funcion SECURITY DEFINER que crea el workspace y
-- la membership `owner` en UNA sola transaccion. Si la membership falla, la
-- excepcion revierte tambien el workspace (no quedan workspaces huerfanos). El
-- `owner_id` lo fija el servidor desde `auth.uid()` (el cliente NO lo decide:
-- imposible crear para otro owner). No usa service_role ni secretos.
--
-- Migracion ADITIVA e IDEMPOTENTE (create or replace). No cambia politicas RLS,
-- Auth ni roles: solo anade la funcion y su EXECUTE para `authenticated`.

create or replace function public.create_workspace_with_owner(
  p_name text,
  p_slug text,
  p_type text,
  p_plan text
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces;
begin
  -- 1) Actor autenticado (jamas se confia en un id del cliente).
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- 2) Validar SOLO los campos previstos.
  if p_name is null or btrim(p_name) = '' then
    raise exception 'WORKSPACE_NAME_REQUIRED' using errcode = '23514';
  end if;
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'WORKSPACE_SLUG_REQUIRED' using errcode = '23514';
  end if;
  if p_type not in ('personal', 'organization') then
    raise exception 'WORKSPACE_INVALID_TYPE' using errcode = '22023';
  end if;
  if p_plan not in ('free', 'premium', 'organization') then
    raise exception 'WORKSPACE_INVALID_PLAN' using errcode = '22023';
  end if;

  -- 3) Crear workspace. owner_id = actor (no se acepta del cliente).
  insert into public.workspaces (name, slug, type, plan, status, owner_id)
  values (btrim(p_name), btrim(p_slug), p_type, p_plan, 'active', v_uid)
  returning * into v_ws;

  -- 4) Membership owner en la MISMA transaccion. Si falla, todo revierte.
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_ws.id, v_uid, 'owner', 'active');

  return v_ws;
exception
  -- Slug duplicado -> error ESPECIFICO (el frontend NO debe mostrar "slug
  -- duplicado" ante un fallo de RLS u otro; solo ante esto).
  when unique_violation then
    raise exception 'WORKSPACE_SLUG_ALREADY_EXISTS' using errcode = '23505';
end;
$$;

-- EXECUTE solo para `authenticated` (no anon, no public).
revoke all on function public.create_workspace_with_owner(text, text, text, text) from public;
grant execute on function public.create_workspace_with_owner(text, text, text, text) to authenticated;
