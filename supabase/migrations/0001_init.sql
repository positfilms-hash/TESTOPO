-- TESTOPO - Migración inicial (SPEC 018.2): fundación de Auth + datos.
-- Crea el perfil público complementario a auth.users, las tablas núcleo
-- (workspaces, miembros, oposiciones, acceso) y políticas RLS básicas.
-- Las contraseñas las gestiona Supabase Auth: NUNCA se guardan aquí.

-- =====================================================================
-- profiles: fila pública por usuario. profiles.id == auth.users.id
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

-- Crea automáticamente el perfil al registrarse un usuario en Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    'student',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Tablas núcleo (mínimas) — alineadas con los modelos en memoria.
-- =====================================================================
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null check (type in ('personal', 'organization')),
  plan text not null default 'free',
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

-- =====================================================================
-- Helpers (SECURITY DEFINER) para evitar recursión en políticas RLS.
-- =====================================================================
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.can_manage_workspace(ws uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.oppositions enable row level security;
alter table public.opposition_access enable row level security;

-- profiles: cada usuario solo ve/edita su propio perfil.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: visibles para miembros; gestionables por owner/admin.
create policy workspaces_select_member on public.workspaces
  for select using (public.is_workspace_member(id));
create policy workspaces_manage on public.workspaces
  for all using (public.can_manage_workspace(id))
  with check (public.can_manage_workspace(id));

-- workspace_members: el usuario ve su propia membresía o, si gestiona el
-- workspace, todas las de ese workspace; solo gestores escriben.
create policy members_select on public.workspace_members
  for select using (
    user_id = auth.uid() or public.can_manage_workspace(workspace_id)
  );
create policy members_manage on public.workspace_members
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

-- oposiciones: visibles para miembros del workspace; escritura por gestores.
create policy oppositions_select on public.oppositions
  for select using (public.is_workspace_member(workspace_id));
create policy oppositions_manage on public.oppositions
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

-- acceso a oposición: el usuario ve su propio acceso; los gestores del
-- workspace de la oposición lo gestionan.
create policy access_select on public.opposition_access
  for select using (
    user_id = auth.uid()
    or public.can_manage_workspace(
      (select o.workspace_id from public.oppositions o where o.id = opposition_id)
    )
  );
create policy access_manage on public.opposition_access
  for all using (
    public.can_manage_workspace(
      (select o.workspace_id from public.oppositions o where o.id = opposition_id)
    )
  )
  with check (
    public.can_manage_workspace(
      (select o.workspace_id from public.oppositions o where o.id = opposition_id)
    )
  );

-- NOTA: las tablas de contenido (materials, topics, questions, question_options,
-- tests, test_questions, test_attempts, test_answers) se migrarán con sus
-- políticas RLS en una fase posterior (persistencia de dominio). Hasta entonces
-- el control de acceso lo aplica la capa de servicios/PlatformService.
