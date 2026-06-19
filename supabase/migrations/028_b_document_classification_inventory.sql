-- TESTOPO - SPEC 028-B: Document Classification & Import Inventory.
--
-- Tras subir material (SPEC 028), la app clasifica cada documento y guarda un
-- inventario revisable por admin/owner. Dos tablas nuevas:
--   - document_understanding_runs: una ejecucion de clasificacion por lote.
--   - document_classifications: la clasificacion por material.
-- Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md). No genera
-- indice ni preguntas. El alumno NO accede a estas tablas (solo gestores).
--
-- Reutiliza el helper public.can_manage_workspace(uuid) (creado en bloques
-- previos) para la RLS de solo gestion, igual que material_import_batches.

-- =====================================================================
-- document_understanding_runs
-- =====================================================================
create table if not exists public.document_understanding_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  batch_id uuid references public.material_import_batches (id) on delete cascade,
  created_by uuid references public.profiles (id),
  status text not null default 'pending'
    check (status in
      ('pending', 'processing', 'completed', 'completed_with_warnings', 'failed')),
  provider text not null default 'heuristic',
  model text,
  total_materials integer not null default 0,
  classified_materials integer not null default 0,
  needs_review_count integer not null default 0,
  not_analyzable_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- document_classifications (una por material; la mas reciente es la vigente)
-- =====================================================================
create table if not exists public.document_classifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  run_id uuid not null references public.document_understanding_runs (id) on delete cascade,
  classification text not null
    check (classification in
      ('syllabus_material', 'old_exam_or_test', 'legal_text', 'notes_or_summary',
       'index_or_table_of_contents', 'irrelevant', 'not_analyzable', 'ambiguous')),
  confidence numeric,
  reason text,
  detected_title text,
  detected_document_date text,
  detected_question_count integer,
  detected_page_count integer,
  needs_review boolean not null default false,
  manually_corrected boolean not null default false,
  corrected_by uuid references public.profiles (id),
  corrected_at timestamptz,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at triggers (reutiliza public.set_updated_at(), creada en 020/022).
-- =====================================================================
drop trigger if exists set_document_runs_updated_at on public.document_understanding_runs;
create trigger set_document_runs_updated_at
  before update on public.document_understanding_runs
  for each row execute function public.set_updated_at();

drop trigger if exists set_document_classifications_updated_at on public.document_classifications;
create trigger set_document_classifications_updated_at
  before update on public.document_classifications
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices (SPEC 028-B, 19).
-- =====================================================================
create index if not exists idx_doc_runs_workspace on public.document_understanding_runs (workspace_id);
create index if not exists idx_doc_runs_opposition on public.document_understanding_runs (opposition_id);
create index if not exists idx_doc_runs_batch on public.document_understanding_runs (batch_id);
create index if not exists idx_doc_runs_created_by on public.document_understanding_runs (created_by);
create index if not exists idx_doc_class_workspace on public.document_classifications (workspace_id);
create index if not exists idx_doc_class_opposition on public.document_classifications (opposition_id);
create index if not exists idx_doc_class_material on public.document_classifications (material_id);
create index if not exists idx_doc_class_run on public.document_classifications (run_id);
create index if not exists idx_doc_class_classification on public.document_classifications (classification);
create index if not exists idx_doc_class_needs_review on public.document_classifications (needs_review);

-- =====================================================================
-- RLS de SOLO GESTION (patron material_import_batches/items): el alumno no
-- accede a estas tablas internas. Scope por workspace via can_manage_workspace.
-- =====================================================================
alter table public.document_understanding_runs enable row level security;
alter table public.document_classifications enable row level security;

drop policy if exists document_runs_manage on public.document_understanding_runs;
create policy document_runs_manage on public.document_understanding_runs
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists document_classifications_manage on public.document_classifications;
create policy document_classifications_manage on public.document_classifications
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));
