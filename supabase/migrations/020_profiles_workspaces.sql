-- TESTOPO - SPEC 020: Supabase Repositories: Profiles & Workspaces.
--
-- Primer bloque real de persistencia de dominio en Supabase: profiles,
-- workspaces y workspace_members. Las tablas base y la RLS basica ya se crearon
-- en 0001_init.sql (SPEC 018.2); esta migracion es IDEMPOTENTE y anade:
--   - el patron `updated_at` (funcion + triggers BEFORE UPDATE),
--   - indices utiles para las consultas de los repositorios.
-- No se migra el resto del dominio (oposiciones, materiales, preguntas, tests):
-- sigue en memoria (estado hibrido, SPEC 020).

-- =====================================================================
-- Tablas (defensivo: por si 0001 no se aplico). Definicion alineada con 0001.
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'student' check (role in ('admin', 'student')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'blocked', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null check (type in ('personal', 'organization')),
  plan text not null default 'free' check (plan in ('free', 'premium', 'organization')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended', 'archived')),
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'student')),
  status text not null default 'active'
    check (status in ('active', 'revoked', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- =====================================================================
-- Patron updated_at: trigger BEFORE UPDATE que fija updated_at = now().
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

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices utiles para los repositorios.
-- =====================================================================
create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_workspaces_owner on public.workspaces (owner_id);
create index if not exists idx_workspaces_slug on public.workspaces (slug);
create index if not exists idx_workspace_members_workspace
  on public.workspace_members (workspace_id);
create index if not exists idx_workspace_members_user
  on public.workspace_members (user_id);

-- =====================================================================
-- RLS: ya habilitada con politicas basicas en 0001_init.sql para profiles,
-- workspaces y workspace_members. No se cambia aqui. La RLS completa del resto
-- del dominio queda pendiente para SPEC 025 (RLS Hardening). Los guards de
-- aplicacion (PlatformService/servicios) siguen siendo la defensa principal.
-- =====================================================================
