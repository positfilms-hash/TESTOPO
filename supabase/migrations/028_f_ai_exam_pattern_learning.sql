-- TESTOPO - SPEC 028-F: AI Exam Pattern Learning & Adaptive Generation.
--
-- Persistencia del aprendizaje de patrones de examen: perfiles de estilo
-- versionados, runs de analisis, patrones por tema, memoria de errores IA y
-- quality scores por candidata. Solo AGREGADOS y huellas anti-copia; NUNCA un
-- banco copiable ni enunciados verbatim de examenes antiguos.
--
-- Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md). RLS de SOLO
-- GESTION (owner/admin del workspace de la oposicion); el alumno no accede a
-- ningun dato interno de aprendizaje. No duplica exam_pattern_summaries ni las
-- tablas de feedback (SPEC 023/030); las reutiliza.

-- =====================================================================
-- 1) exam_pattern_analysis_runs
-- =====================================================================
create table if not exists public.exam_pattern_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  created_by uuid references public.profiles (id),
  status text not null
    check (status in ('pending', 'processing', 'completed',
                      'completed_with_warnings', 'failed')),
  provider text not null,
  model text,
  input_material_ids jsonb not null default '[]'::jsonb,
  input_section_ids jsonb not null default '[]'::jsonb,
  old_exam_count integer not null default 0,
  analyzed_question_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 2) exam_pattern_profiles (perfil de estilo versionado; 1 activo por oposicion)
-- =====================================================================
create table if not exists public.exam_pattern_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'active', 'rejected', 'superseded')),
  selected_summary_ids jsonb not null default '[]'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  fingerprints jsonb not null default '[]'::jsonb,
  coverage_notes text,
  confidence numeric,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A lo sumo un perfil ACTIVO por oposicion (indice unico parcial).
create unique index if not exists uniq_active_profile_per_opposition
  on public.exam_pattern_profiles (opposition_id)
  where status = 'active';

-- =====================================================================
-- 3) topic_exam_patterns
-- =====================================================================
create table if not exists public.topic_exam_patterns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  style_profile_id uuid references public.exam_pattern_profiles (id) on delete cascade,
  frequency_score numeric,
  difficulty_score numeric,
  common_question_types jsonb not null default '[]'::jsonb,
  trap_patterns jsonb not null default '[]'::jsonb,
  style_notes text,
  coverage_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 4) ai_error_memories (entradas auditables derivadas de feedback/review/valid.)
-- =====================================================================
create table if not exists public.ai_error_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  material_id uuid references public.materials (id) on delete set null,
  type text not null,
  severity text not null,
  summary text not null default '',
  avoid_instruction text not null default '',
  source text not null
    check (source in ('review_feedback', 'review_outcome', 'validation')),
  occurrences integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 5) ai_question_quality_scores (por candidata; transparente, NUNCA aprueba)
-- =====================================================================
create table if not exists public.ai_question_quality_scores (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  run_id uuid references public.question_generation_runs (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  source_grounding numeric not null default 0,
  exam_style_similarity numeric not null default 0,
  clarity numeric not null default 0,
  single_answer_confidence numeric not null default 0,
  difficulty_fit numeric not null default 0,
  overall numeric not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at (reutiliza public.set_updated_at(), creada en 020).
-- =====================================================================
drop trigger if exists set_eplr_updated_at on public.exam_pattern_analysis_runs;
create trigger set_eplr_updated_at before update on public.exam_pattern_analysis_runs
  for each row execute function public.set_updated_at();
drop trigger if exists set_epp_updated_at on public.exam_pattern_profiles;
create trigger set_epp_updated_at before update on public.exam_pattern_profiles
  for each row execute function public.set_updated_at();
drop trigger if exists set_tep_updated_at on public.topic_exam_patterns;
create trigger set_tep_updated_at before update on public.topic_exam_patterns
  for each row execute function public.set_updated_at();
drop trigger if exists set_aem_updated_at on public.ai_error_memories;
create trigger set_aem_updated_at before update on public.ai_error_memories
  for each row execute function public.set_updated_at();
drop trigger if exists set_aqqs_updated_at on public.ai_question_quality_scores;
create trigger set_aqqs_updated_at before update on public.ai_question_quality_scores
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices.
-- =====================================================================
create index if not exists idx_eplr_opposition on public.exam_pattern_analysis_runs (opposition_id);
create index if not exists idx_eplr_status on public.exam_pattern_analysis_runs (status);
create index if not exists idx_eplr_creator on public.exam_pattern_analysis_runs (created_by);
create index if not exists idx_epp_opposition on public.exam_pattern_profiles (opposition_id);
create index if not exists idx_epp_status on public.exam_pattern_profiles (status);
create index if not exists idx_tep_opposition on public.topic_exam_patterns (opposition_id);
create index if not exists idx_tep_topic on public.topic_exam_patterns (topic_id);
create index if not exists idx_tep_profile on public.topic_exam_patterns (style_profile_id);
create index if not exists idx_aem_opposition on public.ai_error_memories (opposition_id);
create index if not exists idx_aem_topic on public.ai_error_memories (topic_id);
create index if not exists idx_aem_material on public.ai_error_memories (material_id);
create index if not exists idx_aqqs_question on public.ai_question_quality_scores (question_id);
create index if not exists idx_aqqs_run on public.ai_question_quality_scores (run_id);
create index if not exists idx_aqqs_opposition on public.ai_question_quality_scores (opposition_id);

-- =====================================================================
-- RLS: SOLO GESTION. El alumno nunca accede a datos internos de aprendizaje.
-- Scope por la oposicion (directa o, en quality scores, via la pregunta).
-- =====================================================================
alter table public.exam_pattern_analysis_runs enable row level security;
alter table public.exam_pattern_profiles enable row level security;
alter table public.topic_exam_patterns enable row level security;
alter table public.ai_error_memories enable row level security;
alter table public.ai_question_quality_scores enable row level security;

drop policy if exists eplr_manage on public.exam_pattern_analysis_runs;
create policy eplr_manage on public.exam_pattern_analysis_runs
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

drop policy if exists epp_manage on public.exam_pattern_profiles;
create policy epp_manage on public.exam_pattern_profiles
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

drop policy if exists tep_manage on public.topic_exam_patterns;
create policy tep_manage on public.topic_exam_patterns
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

drop policy if exists aem_manage on public.ai_error_memories;
create policy aem_manage on public.ai_error_memories
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- quality scores: scope via la oposicion de la pregunta (helper de 023).
drop policy if exists aqqs_manage on public.ai_question_quality_scores;
create policy aqqs_manage on public.ai_question_quality_scores
  for all using (
    public.can_manage_workspace(public.opposition_workspace(
      public.question_opposition(question_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(
      public.question_opposition(question_id)))
  );

-- =====================================================================
-- Metadatos de generacion adaptativa en question_generation_runs (SPEC 028-F):
-- perfil de estilo aplicado y si se uso contexto adaptativo. Aditivo/idempotente.
-- =====================================================================
alter table public.question_generation_runs
  add column if not exists style_profile_id uuid
    references public.exam_pattern_profiles (id) on delete set null;
alter table public.question_generation_runs
  add column if not exists adaptive_context_used boolean not null default false;

