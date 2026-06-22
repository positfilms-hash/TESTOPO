-- TESTOPO - SPEC 030: OCR & Vision para PDFs escaneados.
--
-- Aditiva: metadata de OCR en `materials` + estados de extraccion nuevos, y dos
-- tablas internas (`material_ocr_runs`, `material_ocr_pages`) con RLS de SOLO
-- GESTION (el alumno no ve runs/paginas/confianza/errores/imagenes). NO clasifica
-- ni genera nada. Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md).

-- =====================================================================
-- Columnas aditivas de OCR en materials.
-- =====================================================================
alter table public.materials add column if not exists extraction_method text;
alter table public.materials add column if not exists ocr_status text;
alter table public.materials add column if not exists ocr_confidence numeric;
alter table public.materials add column if not exists ocr_page_count integer;
alter table public.materials add column if not exists ocr_processed_pages integer;
alter table public.materials add column if not exists ocr_failed_pages integer;
alter table public.materials add column if not exists ocr_warning_count integer;

-- Amplia los valores de extraction_status con los estados OCR (SPEC 030).
alter table public.materials
  drop constraint if exists materials_extraction_status_check;
alter table public.materials
  add constraint materials_extraction_status_check
  check (extraction_status in (
    'not_started', 'processing', 'completed', 'failed', 'not_supported',
    'scanned_detected', 'ocr_processing', 'completed_ocr',
    'completed_ocr_with_warnings', 'ocr_failed'
  ));

-- =====================================================================
-- material_ocr_runs (una ejecucion de OCR por material/reintento)
-- =====================================================================
create table if not exists public.material_ocr_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  created_by uuid references public.profiles (id),
  provider text not null,
  model text,
  status text not null
    check (status in ('pending', 'processing', 'completed',
                      'completed_with_warnings', 'failed')),
  page_count integer not null default 0,
  processed_pages integer not null default 0,
  failed_pages integer not null default 0,
  average_confidence numeric,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- material_ocr_pages (texto/confianza por pagina; nunca bytes de imagen)
-- =====================================================================
create table if not exists public.material_ocr_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  ocr_run_id uuid not null references public.material_ocr_runs (id) on delete cascade,
  page_number integer not null,
  image_ref text,
  text text not null default '',
  confidence numeric,
  status text not null check (status in ('completed', 'warning', 'failed')),
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at (reutiliza public.set_updated_at(), creada en 020).
-- =====================================================================
drop trigger if exists set_material_ocr_runs_updated_at on public.material_ocr_runs;
create trigger set_material_ocr_runs_updated_at before update on public.material_ocr_runs
  for each row execute function public.set_updated_at();
drop trigger if exists set_material_ocr_pages_updated_at on public.material_ocr_pages;
create trigger set_material_ocr_pages_updated_at before update on public.material_ocr_pages
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices.
-- =====================================================================
create index if not exists idx_ocr_runs_material on public.material_ocr_runs (material_id);
create index if not exists idx_ocr_runs_opposition on public.material_ocr_runs (opposition_id);
create index if not exists idx_ocr_runs_status on public.material_ocr_runs (status);
create index if not exists idx_ocr_pages_run on public.material_ocr_pages (ocr_run_id);
create index if not exists idx_ocr_pages_material on public.material_ocr_pages (material_id);

-- =====================================================================
-- RLS: SOLO GESTION (owner/admin del workspace de la oposicion). El alumno no
-- ve runs/paginas/confianza/errores/imagenes. Scope por la oposicion.
-- =====================================================================
alter table public.material_ocr_runs enable row level security;
alter table public.material_ocr_pages enable row level security;

drop policy if exists ocr_runs_manage on public.material_ocr_runs;
create policy ocr_runs_manage on public.material_ocr_runs
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

drop policy if exists ocr_pages_manage on public.material_ocr_pages;
create policy ocr_pages_manage on public.material_ocr_pages
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));
