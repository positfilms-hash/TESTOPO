-- TESTOPO - SPEC 028-C: Material Sections & Source References.
--
-- Tras clasificar (SPEC 028-B), cada material util se divide en secciones/
-- fragmentos referenciables y se preparan referencias de fuente. Dos tablas:
--   - material_sections: una parte util de un material (pagina/epigrafe/chunk).
--   - source_references: referencia a una seccion (para indice/preguntas futuras).
-- Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md). No genera
-- indice ni preguntas. El alumno NO accede a estas tablas (solo gestores).
--
-- RLS de solo gestion via public.can_manage_workspace(uuid), igual que las
-- tablas de clasificacion documental (028-B).

-- =====================================================================
-- material_sections
-- =====================================================================
create table if not exists public.material_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  section_title text not null,
  section_type text not null default 'unknown'
    check (section_type in
      ('page', 'heading', 'chunk', 'exam_question_block', 'toc_block', 'unknown')),
  page_start integer,
  page_end integer,
  content_excerpt text not null default '',
  content_text text not null default '',
  order_index integer not null default 0,
  classification text not null default 'unknown'
    check (classification in
      ('study_content', 'legal_content', 'summary_content', 'index_content',
       'old_exam_content', 'unknown')),
  source_path text,
  status text not null default 'active'
    check (status in ('active', 'needs_review', 'obsolete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- source_references
-- =====================================================================
create table if not exists public.source_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  material_section_id uuid references public.material_sections (id) on delete cascade,
  reference_type text not null default 'material_section'
    check (reference_type in
      ('material_section', 'page_range', 'excerpt', 'manual', 'ai_suggested')),
  label text not null default '',
  page_start integer,
  page_end integer,
  source_excerpt text not null default '',
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at triggers (reutiliza public.set_updated_at(), creada en 020/022).
-- =====================================================================
drop trigger if exists set_material_sections_updated_at on public.material_sections;
create trigger set_material_sections_updated_at
  before update on public.material_sections
  for each row execute function public.set_updated_at();

drop trigger if exists set_source_references_updated_at on public.source_references;
create trigger set_source_references_updated_at
  before update on public.source_references
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices (SPEC 028-C, 29).
-- =====================================================================
create index if not exists idx_sections_workspace on public.material_sections (workspace_id);
create index if not exists idx_sections_opposition on public.material_sections (opposition_id);
create index if not exists idx_sections_material on public.material_sections (material_id);
create index if not exists idx_sections_classification on public.material_sections (classification);
create index if not exists idx_sections_type on public.material_sections (section_type);
create index if not exists idx_sections_order on public.material_sections (order_index);
create index if not exists idx_source_refs_workspace on public.source_references (workspace_id);
create index if not exists idx_source_refs_opposition on public.source_references (opposition_id);
create index if not exists idx_source_refs_material on public.source_references (material_id);
create index if not exists idx_source_refs_section on public.source_references (material_section_id);

-- =====================================================================
-- RLS de SOLO GESTION (patron material_import_batches / 028-B): el alumno no
-- accede a estas tablas internas. Scope por workspace via can_manage_workspace.
-- =====================================================================
alter table public.material_sections enable row level security;
alter table public.source_references enable row level security;

drop policy if exists material_sections_manage on public.material_sections;
create policy material_sections_manage on public.material_sections
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists source_references_manage on public.source_references;
create policy source_references_manage on public.source_references
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));
