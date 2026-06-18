-- TESTOPO - SPEC 021: Supabase Repositories: Oppositions & Access.
--
-- Segundo bloque de dominio persistido en Supabase: oppositions y
-- opposition_access. Las tablas y la RLS basica ya se crearon en 0001_init.sql
-- (SPEC 018.2); esta migracion es IDEMPOTENTE (sigue docs/setup/migrations-runbook.md)
-- y anade:
--   - patron updated_at (triggers) para ambas tablas,
--   - indices utiles para las consultas de los repositorios,
--   - correcciones de pre-flight de la SPEC 020 (bootstrap de workspace y
--     bloqueo de cambio de profiles.role desde clientes autenticados).
-- No migra el resto del dominio (materials, topics, questions, tests): siguen en
-- memoria (estado hibrido, ver docs/architecture/persistence.md).

-- =====================================================================
-- Tablas (defensivo: alineadas con 0001_init.sql; no se redefinen columnas).
-- =====================================================================
create table if not exists public.oppositions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  status text not null default 'active'
    check (status in ('active', 'draft', 'archived')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opposition_access (
  id uuid primary key default gen_random_uuid(),
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_in_opposition text not null default 'student'
    check (role_in_opposition in ('owner', 'manager', 'student')),
  status text not null default 'active'
    check (status in ('active', 'revoked', 'pending')),
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opposition_id, user_id)
);

-- NOTA sobre el slug: 0001_init.sql declara `oppositions.slug` UNIQUE global (no
-- por workspace). La capa de servicios (OppositionService.findBySlug) asume esa
-- unicidad global. No se relaja aqui a unique(workspace_id, slug) para no cambiar
-- la regla de negocio vigente; si una spec futura lo requiere, se hara entonces.

-- =====================================================================
-- Patron updated_at: reutiliza public.set_updated_at() (creada en 020).
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_oppositions_updated_at on public.oppositions;
create trigger set_oppositions_updated_at
  before update on public.oppositions
  for each row execute function public.set_updated_at();

drop trigger if exists set_opposition_access_updated_at on public.opposition_access;
create trigger set_opposition_access_updated_at
  before update on public.opposition_access
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices utiles para los repositorios (SPEC 021, 10).
-- =====================================================================
create index if not exists idx_oppositions_workspace on public.oppositions (workspace_id);
create index if not exists idx_oppositions_created_by on public.oppositions (created_by);
create index if not exists idx_oppositions_status on public.oppositions (status);
create index if not exists idx_opposition_access_opposition
  on public.opposition_access (opposition_id);
create index if not exists idx_opposition_access_user
  on public.opposition_access (user_id);
create index if not exists idx_opposition_access_status
  on public.opposition_access (status);

-- =====================================================================
-- RLS: oppositions y opposition_access ya tienen RLS habilitada con politicas
-- basicas en 0001_init.sql (oppositions_select/manage, access_select/manage).
-- No se cambian aqui. La RLS completa del dominio queda para SPEC 025.
-- =====================================================================

-- =====================================================================
-- Pre-flight SPEC 020 (precondicion para operar sobre workspaces reales).
-- Estas correcciones pertenecen al bloque profiles/workspaces/workspace_members.
-- =====================================================================

-- (1) Bootstrap del primer workspace.
-- En 0001 las politicas workspaces_manage / members_manage exigen
-- can_manage_workspace() tambien en INSERT, pero al crear el PRIMER workspace
-- aun no existe ninguna membership -> un usuario autenticado no podria crear su
-- workspace inicial ni su propia membership 'owner' (deadlock de arranque).
-- Se anaden politicas permisivas de INSERT (se combinan con OR con las
-- existentes) que permiten exactamente ese arranque controlado.

drop policy if exists workspaces_insert_own on public.workspaces;
create policy workspaces_insert_own on public.workspaces
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists members_insert_self_owner on public.workspace_members;
create policy members_insert_self_owner on public.workspace_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- (2) profiles.role no se puede cambiar desde un cliente autenticado.
-- La politica profiles_update_own permite al usuario actualizar su propia fila;
-- sin esta guarda podria escalar su rol global a 'admin'. El trigger revierte
-- silenciosamente cualquier cambio de `role` hecho por el rol 'authenticated'
-- (frontend). El backend con service_role (o postgres) si puede cambiarlo.
-- SECURITY INVOKER (por defecto) para que current_user refleje al llamante.
create or replace function public.enforce_profile_role_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.role is distinct from old.role
     and current_user = 'authenticated' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_profile_role_immutable on public.profiles;
create trigger enforce_profile_role_immutable
  before update on public.profiles
  for each row execute function public.enforce_profile_role_immutable();
