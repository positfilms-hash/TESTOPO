-- TESTOPO - Migracion del INDICE DE TEMARIO IA a Supabase (SPEC 019 + 028-D).
--
-- Ultimo dominio del MVP que quedaba InMemory (paridad SPEC 019; las tablas no
-- existian, por eso 028-D mantuvo el indice en memoria). Persiste las 7 entidades
-- del indice: runs, propuestas, nodos, sugerencias material-tema, resumenes de
-- patron de examen, fuentes de nodo (028-D) y referencias de fuente de temas ya
-- aplicados (028-D).
--
-- Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md). RLS de SOLO
-- GESTION: el indice es interno (el alumno nunca lo ve); el scope se deriva de la
-- oposicion (directa o via el padre run/propuesta/tema). Arrays como JSONB.

-- =====================================================================
-- 1) syllabus_index_runs (ejecucion de analisis)
-- =====================================================================
create table if not exists public.syllabus_index_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  created_by uuid references public.profiles (id),
  status text not null
    check (status in ('pending', 'processing', 'completed',
                      'completed_with_warnings', 'failed', 'cancelled')),
  provider text not null,
  model text,
  material_ids jsonb not null default '[]'::jsonb,
  section_ids jsonb not null default '[]'::jsonb,
  input_summary text not null default '',
  total_materials integer not null default 0,
  analyzed_materials integer not null default 0,
  ignored_materials integer not null default 0,
  proposed_topics_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 2) syllabus_index_proposals (propuesta de indice)
-- =====================================================================
create table if not exists public.syllabus_index_proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.syllabus_index_runs (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'applied')),
  created_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3) syllabus_index_node_proposals (nodo tema/subtema propuesto)
-- =====================================================================
create table if not exists public.syllabus_index_node_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.syllabus_index_proposals (id) on delete cascade,
  parent_id uuid references public.syllabus_index_node_proposals (id) on delete set null,
  title text not null,
  description text,
  code text,
  order_index integer not null default 0,
  confidence numeric,
  source_material_ids jsonb not null default '[]'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  status text not null default 'proposed'
    check (status in ('proposed', 'edited', 'accepted', 'rejected', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 4) material_topic_suggestions (sugerencia de asociacion material-tema)
-- =====================================================================
create table if not exists public.material_topic_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.syllabus_index_runs (id) on delete cascade,
  proposal_node_id uuid references public.syllabus_index_node_proposals (id) on delete set null,
  material_id uuid not null references public.materials (id) on delete cascade,
  confidence numeric,
  reason text,
  status text not null default 'suggested'
    check (status in ('suggested', 'accepted', 'rejected', 'unclassified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 5) exam_pattern_summaries (resumen de patron de examen; contexto, no banco)
-- =====================================================================
create table if not exists public.exam_pattern_summaries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.syllabus_index_runs (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  batch_id uuid references public.material_import_batches (id) on delete set null,
  material_id uuid not null references public.materials (id) on delete cascade,
  detected_question_count integer,
  detected_topics jsonb not null default '[]'::jsonb,
  difficulty_notes text,
  style_notes text,
  coverage_notes text,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 6) syllabus_index_node_sources (fuente concreta de un nodo propuesto, 028-D)
-- =====================================================================
create table if not exists public.syllabus_index_node_sources (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.syllabus_index_proposals (id) on delete cascade,
  node_id uuid not null references public.syllabus_index_node_proposals (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  material_section_id uuid references public.material_sections (id) on delete set null,
  source_reference_id uuid references public.source_references (id) on delete set null,
  page_start integer,
  page_end integer,
  excerpt text,
  confidence numeric,
  is_primary boolean not null default true,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 7) topic_source_references (fuente de un tema YA aplicado al Topic Map, 028-D)
-- =====================================================================
create table if not exists public.topic_source_references (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  material_section_id uuid references public.material_sections (id) on delete set null,
  source_reference_id uuid references public.source_references (id) on delete set null,
  excerpt text,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at (reutiliza public.set_updated_at(), creada en 020).
-- =====================================================================
drop trigger if exists set_syllabus_runs_updated_at on public.syllabus_index_runs;
create trigger set_syllabus_runs_updated_at
  before update on public.syllabus_index_runs
  for each row execute function public.set_updated_at();

drop trigger if exists set_syllabus_proposals_updated_at on public.syllabus_index_proposals;
create trigger set_syllabus_proposals_updated_at
  before update on public.syllabus_index_proposals
  for each row execute function public.set_updated_at();

drop trigger if exists set_syllabus_nodes_updated_at on public.syllabus_index_node_proposals;
create trigger set_syllabus_nodes_updated_at
  before update on public.syllabus_index_node_proposals
  for each row execute function public.set_updated_at();

drop trigger if exists set_material_suggestions_updated_at on public.material_topic_suggestions;
create trigger set_material_suggestions_updated_at
  before update on public.material_topic_suggestions
  for each row execute function public.set_updated_at();

drop trigger if exists set_exam_patterns_updated_at on public.exam_pattern_summaries;
create trigger set_exam_patterns_updated_at
  before update on public.exam_pattern_summaries
  for each row execute function public.set_updated_at();

drop trigger if exists set_node_sources_updated_at on public.syllabus_index_node_sources;
create trigger set_node_sources_updated_at
  before update on public.syllabus_index_node_sources
  for each row execute function public.set_updated_at();

drop trigger if exists set_topic_source_refs_updated_at on public.topic_source_references;
create trigger set_topic_source_refs_updated_at
  before update on public.topic_source_references
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices utiles.
-- =====================================================================
create index if not exists idx_sir_opposition on public.syllabus_index_runs (opposition_id);
create index if not exists idx_sip_run on public.syllabus_index_proposals (run_id);
create index if not exists idx_sip_opposition on public.syllabus_index_proposals (opposition_id);
create index if not exists idx_sinp_proposal on public.syllabus_index_node_proposals (proposal_id);
create index if not exists idx_sinp_parent on public.syllabus_index_node_proposals (parent_id);
create index if not exists idx_mts_run on public.material_topic_suggestions (run_id);
create index if not exists idx_mts_material on public.material_topic_suggestions (material_id);
create index if not exists idx_eps_run on public.exam_pattern_summaries (run_id);
create index if not exists idx_eps_material on public.exam_pattern_summaries (material_id);
create index if not exists idx_sins_proposal on public.syllabus_index_node_sources (proposal_id);
create index if not exists idx_sins_node on public.syllabus_index_node_sources (node_id);
create index if not exists idx_tsr_topic on public.topic_source_references (topic_id);
create index if not exists idx_tsr_opposition on public.topic_source_references (opposition_id);

-- =====================================================================
-- RLS: SOLO GESTION (owner/admin del workspace de la oposicion). El alumno NUNCA
-- ve el indice. El scope se deriva de la oposicion (directa o via el padre).
-- =====================================================================
alter table public.syllabus_index_runs enable row level security;
alter table public.syllabus_index_proposals enable row level security;
alter table public.syllabus_index_node_proposals enable row level security;
alter table public.material_topic_suggestions enable row level security;
alter table public.exam_pattern_summaries enable row level security;
alter table public.syllabus_index_node_sources enable row level security;
alter table public.topic_source_references enable row level security;

-- Helper: oposicion de una propuesta y de un run (SECURITY DEFINER, evita
-- recursion RLS al derivar el scope de las tablas hijas).
create or replace function public.syllabus_run_opposition(r uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select opposition_id from public.syllabus_index_runs where id = r;
$$;

create or replace function public.syllabus_proposal_opposition(p uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select opposition_id from public.syllabus_index_proposals where id = p;
$$;

create or replace function public.topic_opposition(t uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select opposition_id from public.topics where id = t;
$$;

-- runs
drop policy if exists sir_manage on public.syllabus_index_runs;
create policy sir_manage on public.syllabus_index_runs
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- proposals
drop policy if exists sip_manage on public.syllabus_index_proposals;
create policy sip_manage on public.syllabus_index_proposals
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- nodes (scope via la propuesta)
drop policy if exists sinp_manage on public.syllabus_index_node_proposals;
create policy sinp_manage on public.syllabus_index_node_proposals
  for all using (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_proposal_opposition(proposal_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_proposal_opposition(proposal_id)))
  );

-- suggestions (scope via el run)
drop policy if exists mts_manage on public.material_topic_suggestions;
create policy mts_manage on public.material_topic_suggestions
  for all using (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_run_opposition(run_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_run_opposition(run_id)))
  );

-- exam patterns (scope via el run)
drop policy if exists eps_manage on public.exam_pattern_summaries;
create policy eps_manage on public.exam_pattern_summaries
  for all using (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_run_opposition(run_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_run_opposition(run_id)))
  );

-- node sources (scope via la propuesta)
drop policy if exists sins_manage on public.syllabus_index_node_sources;
create policy sins_manage on public.syllabus_index_node_sources
  for all using (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_proposal_opposition(proposal_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(
      public.syllabus_proposal_opposition(proposal_id)))
  );

-- topic source references (scope via el tema)
drop policy if exists tsr_manage on public.topic_source_references;
create policy tsr_manage on public.topic_source_references
  for all using (
    public.can_manage_workspace(public.opposition_workspace(
      public.topic_opposition(topic_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(
      public.topic_opposition(topic_id)))
  );
