-- TESTOPO - SPEC 022: Supabase Repositories: Materials & Topics.
--
-- Tercer bloque de dominio en Supabase: materiales, temario, vinculos
-- material-tema e importaciones (lotes + items). Migracion IDEMPOTENTE (sigue
-- docs/setup/migrations-runbook.md). No migra questions/tests/attempts: siguen
-- en memoria (estado hibrido, ver docs/architecture/persistence.md).
--
-- NOTA sobre `workspace_id`/`opposition_id` en algunas tablas: los modelos de
-- dominio actuales (Material, Topic, TopicMaterialLink, MaterialImportItem) no
-- transportan todos esos campos de scope. Se crean como columnas NULLABLE para
-- forward-compat con la RLS final (SPEC 025); el alcance real se deriva HOY via
-- la oposicion. No se cambian los modelos ni las reglas de negocio en esta spec.
-- Los archivos reales NO se guardan en Supabase (solo metadatos/storage_path).

-- =====================================================================
-- materials
-- =====================================================================
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  uploaded_by uuid references public.profiles (id),
  title text not null,
  description text,
  type text not null
    check (type in ('syllabus', 'old_test', 'official_exam', 'law', 'notes', 'other')),
  status text not null default 'active'
    check (status in ('active', 'deprecated', 'obsolete', 'needs_review')),
  original_filename text,
  mime_type text,
  file_extension text,
  size_bytes bigint,
  storage_path text,
  content_text text,
  reference text,
  extraction_status text default 'not_started'
    check (extraction_status in
      ('not_started', 'processing', 'completed', 'failed', 'not_supported')),
  extraction_error text,
  page_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- topics (jerarquia via parent_id; `order` es palabra reservada -> order_index)
-- =====================================================================
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  parent_id uuid references public.topics (id) on delete cascade,
  title text not null,
  description text,
  code text,
  order_index integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'needs_review', 'deprecated', 'obsolete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opposition_id, parent_id, title)
);

-- =====================================================================
-- material_topic_links (unicidad por pareja material/tema)
-- =====================================================================
create table if not exists public.material_topic_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  reference text,
  created_at timestamptz not null default now(),
  unique (material_id, topic_id)
);

-- =====================================================================
-- material_import_batches
-- =====================================================================
create table if not exists public.material_import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  uploaded_by uuid references public.profiles (id),
  status text not null default 'pending'
    check (status in
      ('pending', 'processing', 'completed', 'completed_with_errors', 'failed')),
  source_type text not null
    check (source_type in ('multi_file', 'zip', 'folder')),
  original_filename text,
  total_files integer not null default 0,
  imported_files integer not null default 0,
  skipped_files integer not null default 0,
  failed_files integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- material_import_items
-- =====================================================================
create table if not exists public.material_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.material_import_batches (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  material_id uuid references public.materials (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  original_path text not null,
  original_filename text not null,
  status text not null check (status in ('imported', 'skipped', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at: reutiliza public.set_updated_at() (creada en 020).
-- material_topic_links NO tiene updated_at (el modelo solo tiene created_at).
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

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

drop trigger if exists set_topics_updated_at on public.topics;
create trigger set_topics_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

drop trigger if exists set_import_batches_updated_at on public.material_import_batches;
create trigger set_import_batches_updated_at
  before update on public.material_import_batches
  for each row execute function public.set_updated_at();

drop trigger if exists set_import_items_updated_at on public.material_import_items;
create trigger set_import_items_updated_at
  before update on public.material_import_items
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices utiles (SPEC 022, 10).
-- =====================================================================
create index if not exists idx_materials_workspace on public.materials (workspace_id);
create index if not exists idx_materials_opposition on public.materials (opposition_id);
create index if not exists idx_materials_uploaded_by on public.materials (uploaded_by);
create index if not exists idx_materials_status on public.materials (status);
create index if not exists idx_materials_type on public.materials (type);
create index if not exists idx_materials_extraction on public.materials (extraction_status);
create index if not exists idx_topics_workspace on public.topics (workspace_id);
create index if not exists idx_topics_opposition on public.topics (opposition_id);
create index if not exists idx_topics_parent on public.topics (parent_id);
create index if not exists idx_topics_status on public.topics (status);
create index if not exists idx_mtl_material on public.material_topic_links (material_id);
create index if not exists idx_mtl_topic on public.material_topic_links (topic_id);
create index if not exists idx_mtl_opposition on public.material_topic_links (opposition_id);
create index if not exists idx_import_batches_workspace on public.material_import_batches (workspace_id);
create index if not exists idx_import_batches_opposition on public.material_import_batches (opposition_id);
create index if not exists idx_import_batches_uploaded_by on public.material_import_batches (uploaded_by);
create index if not exists idx_import_batches_status on public.material_import_batches (status);
create index if not exists idx_import_items_batch on public.material_import_items (batch_id);
create index if not exists idx_import_items_material on public.material_import_items (material_id);
create index if not exists idx_import_items_topic on public.material_import_items (topic_id);
create index if not exists idx_import_items_status on public.material_import_items (status);

-- =====================================================================
-- Helper para derivar el workspace de una oposicion (SECURITY DEFINER, evita
-- recursion de RLS). Se usa en las politicas de este bloque.
-- =====================================================================
create or replace function public.opposition_workspace(opp uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.workspace_id from public.oppositions o where o.id = opp;
$$;

-- =====================================================================
-- RLS basica (patron SPEC 020/021). El control fino "student solo ve material
-- active de oposiciones con acceso activo" lo mantiene la capa de servicios;
-- la RLS final del producto se endurece en SPEC 025. Guards de aplicacion siguen
-- siendo la defensa principal.
-- =====================================================================
alter table public.materials enable row level security;
alter table public.topics enable row level security;
alter table public.material_topic_links enable row level security;
alter table public.material_import_batches enable row level security;
alter table public.material_import_items enable row level security;

-- materials
drop policy if exists materials_select on public.materials;
create policy materials_select on public.materials
  for select using (public.is_workspace_member(public.opposition_workspace(opposition_id)));
drop policy if exists materials_manage on public.materials;
create policy materials_manage on public.materials
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- topics
drop policy if exists topics_select on public.topics;
create policy topics_select on public.topics
  for select using (public.is_workspace_member(public.opposition_workspace(opposition_id)));
drop policy if exists topics_manage on public.topics;
create policy topics_manage on public.topics
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- material_topic_links (scope via la oposicion del material)
drop policy if exists mtl_select on public.material_topic_links;
create policy mtl_select on public.material_topic_links
  for select using (
    public.is_workspace_member(public.opposition_workspace(
      (select m.opposition_id from public.materials m where m.id = material_id)))
  );
drop policy if exists mtl_manage on public.material_topic_links;
create policy mtl_manage on public.material_topic_links
  for all using (
    public.can_manage_workspace(public.opposition_workspace(
      (select m.opposition_id from public.materials m where m.id = material_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(
      (select m.opposition_id from public.materials m where m.id = material_id)))
  );

-- material_import_batches (gestion por managers del workspace)
drop policy if exists import_batches_manage on public.material_import_batches;
create policy import_batches_manage on public.material_import_batches
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

-- material_import_items (scope via el workspace del batch)
drop policy if exists import_items_manage on public.material_import_items;
create policy import_items_manage on public.material_import_items
  for all using (
    public.can_manage_workspace(
      (select b.workspace_id from public.material_import_batches b where b.id = batch_id))
  )
  with check (
    public.can_manage_workspace(
      (select b.workspace_id from public.material_import_batches b where b.id = batch_id))
  );
