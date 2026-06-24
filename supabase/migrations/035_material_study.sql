-- TESTOPO - SPEC 038: estudio interno del material (sin indice publico).
--
-- Capa de datos INTERNA y trazable para preparar el material de cara a la futura
-- generacion directa de preguntas (SPEC 039). NO crea preguntas, NO valida nada,
-- NO depende de un indice de temario visible ni de Topics. Aditiva e IDEMPOTENTE
-- (sigue docs/setup/migrations-runbook.md). RLS de SOLO GESTION (como OCR, 032).
--
-- Auditoria previa (SPEC 038): material_sections (028-C), source_references
-- (028-C) y document_classifications (028-B) ya guardan secciones/referencias/
-- clasificacion, PERO no el CICLO DE VIDA del estudio ni los bloques/conceptos
-- anclados. Se anaden solo las tablas minimas para eso, mas un estado aditivo en
-- materials. No se borran ni se tocan tablas/Topics/propuestas existentes.

-- =====================================================================
-- Estado de estudio del material (aditivo). `studied` solo tras un run completado
-- con unidades usables; OCR con avisos -> studied_with_warnings (honesto).
-- =====================================================================
alter table public.materials add column if not exists study_status text;
alter table public.materials
  drop constraint if exists materials_study_status_check;
alter table public.materials
  add constraint materials_study_status_check
  check (study_status is null or study_status in (
    'not_studied', 'studying', 'studied', 'studied_with_warnings', 'study_failed'
  ));

-- =====================================================================
-- material_study_runs: ciclo de vida agregado por scope (workspace/oposicion).
-- =====================================================================
create table if not exists public.material_study_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  created_by uuid references public.profiles (id),
  provider text not null,
  model text,
  status text not null
    check (status in ('pending', 'processing', 'completed',
                      'completed_with_warnings', 'failed')),
  material_count integer not null default 0,
  studied_count integer not null default 0,
  unit_count integer not null default 0,
  concept_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- material_study_units: bloques internos ANCLADOS A FUENTE (seccion/referencia o
-- excerpt acotado verificado). Nunca un bloque sin puntero concreto.
-- =====================================================================
create table if not exists public.material_study_units (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  run_id uuid not null references public.material_study_runs (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  material_section_id uuid references public.material_sections (id) on delete set null,
  source_reference_id uuid references public.source_references (id) on delete set null,
  title text not null,
  summary text not null default '',
  excerpt text not null default '',
  page_start integer,
  page_end integer,
  importance text,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- material_study_concepts: conceptos OPCIONALES anclados a una unidad. Mismo scope
-- y puntero concreto (unidad + excerpt). Solo si el proveedor devuelve conceptos
-- validos anclados a fuente.
-- =====================================================================
create table if not exists public.material_study_concepts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  run_id uuid not null references public.material_study_runs (id) on delete cascade,
  unit_id uuid not null references public.material_study_units (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  term text not null,
  summary text not null default '',
  excerpt text not null default '',
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at (reutiliza public.set_updated_at(), creada en 020).
-- =====================================================================
drop trigger if exists set_material_study_runs_updated_at on public.material_study_runs;
create trigger set_material_study_runs_updated_at before update on public.material_study_runs
  for each row execute function public.set_updated_at();
drop trigger if exists set_material_study_units_updated_at on public.material_study_units;
create trigger set_material_study_units_updated_at before update on public.material_study_units
  for each row execute function public.set_updated_at();
drop trigger if exists set_material_study_concepts_updated_at on public.material_study_concepts;
create trigger set_material_study_concepts_updated_at before update on public.material_study_concepts
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices.
-- =====================================================================
create index if not exists idx_study_runs_opposition on public.material_study_runs (opposition_id);
create index if not exists idx_study_runs_status on public.material_study_runs (status);
create index if not exists idx_study_units_run on public.material_study_units (run_id);
create index if not exists idx_study_units_material on public.material_study_units (material_id);
create index if not exists idx_study_concepts_unit on public.material_study_concepts (unit_id);
create index if not exists idx_study_concepts_run on public.material_study_concepts (run_id);

-- =====================================================================
-- RLS: SOLO GESTION (owner/admin del workspace de la oposicion). El alumno NUNCA
-- ve runs/unidades/conceptos. Scope por la oposicion (patron OCR 032).
-- =====================================================================
alter table public.material_study_runs enable row level security;
alter table public.material_study_units enable row level security;
alter table public.material_study_concepts enable row level security;

drop policy if exists study_runs_manage on public.material_study_runs;
create policy study_runs_manage on public.material_study_runs
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

drop policy if exists study_units_manage on public.material_study_units;
create policy study_units_manage on public.material_study_units
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

drop policy if exists study_concepts_manage on public.material_study_concepts;
create policy study_concepts_manage on public.material_study_concepts
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- =====================================================================
-- Grants base de la Data API (necesarios con "Automatically expose new tables"
-- desactivado; ver docs/setup/data-api-grants.md). RLS sigue siendo la autoridad.
-- =====================================================================
grant select, insert, update, delete on
  public.material_study_runs,
  public.material_study_units,
  public.material_study_concepts
  to authenticated;
