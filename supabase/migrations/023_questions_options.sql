-- TESTOPO - SPEC 023: Supabase Repositories: Questions & Options.
--
-- Cuarto bloque de dominio en Supabase: banco de preguntas y su trazabilidad de
-- calidad (opciones, informes de validacion, revisiones, feedback y ejecuciones
-- de generacion IA). Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md).
-- No migra tests/attempts/answers: siguen en memoria (estado hibrido).
--
-- NOTAS de mapeo (los modelos de dominio mandan; no se cambian):
--   - `questions.source` y `questions.generation_metadata` se guardan como JSONB
--     (el modelo es mas rico que columnas sueltas; sin perdida).
--   - `material_id` de la pregunta vive dentro de `source` (jsonb), no como columna.
--   - Las columnas de scope que el modelo no transporta (`workspace_id`,
--     `opposition_id` en tablas hijas) van NULLABLE (forward-compat RLS 025); el
--     alcance real se deriva via la pregunta -> oposicion -> workspace.
--   - La IA NUNCA crea preguntas como `validated` (regla de negocio en servicios).

-- =====================================================================
-- questions
-- =====================================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  statement text not null,
  correct_answer text,
  explanation text,
  source jsonb,
  topic text,
  topic_id uuid references public.topics (id) on delete set null,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'draft'
    check (status in
      ('draft', 'pending_review', 'validated', 'rejected', 'needs_fix', 'obsolete')),
  generation_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- question_options (una fila por opcion; is_correct NO debe exponerse al alumno)
-- =====================================================================
create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- question_validation_results (informe del validador automatico)
-- =====================================================================
create table if not exists public.question_validation_results (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  status text not null check (status in ('passed', 'failed', 'passed_with_warnings')),
  passed boolean not null default false,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  info jsonb not null default '[]'::jsonb,
  recommended_status text check (recommended_status in ('pending_review', 'needs_fix')),
  validator_version text,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- question_reviews (registro de revision humana)
-- =====================================================================
create table if not exists public.question_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  action text not null check (action in
    ('approve', 'reject', 'mark_needs_fix', 'mark_obsolete', 'edit', 'return_to_pending_review')),
  previous_status text,
  new_status text not null,
  reviewer_id uuid references public.profiles (id),
  reviewer_name text,
  notes text,
  validation_result_id uuid references public.question_validation_results (id) on delete set null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- question_review_feedback (motivo estructurado para mejorar generaciones)
-- =====================================================================
create table if not exists public.question_review_feedback (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  review_id uuid references public.question_reviews (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  feedback_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  comment text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- question_generation_runs (historial de ejecuciones de generacion IA)
-- =====================================================================
create table if not exists public.question_generation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  material_id uuid references public.materials (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  mode text not null,
  requested_count integer not null default 0,
  created_count integer not null default 0,
  status text not null check (status in ('completed', 'partial', 'failed')),
  errors jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  feedback_used boolean not null default false,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at: reutiliza public.set_updated_at() (creada en 020). Solo questions
-- y question_options tienen updated_at en el modelo.
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

drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

drop trigger if exists set_question_options_updated_at on public.question_options;
create trigger set_question_options_updated_at
  before update on public.question_options
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices utiles (SPEC 023, 10).
-- =====================================================================
create index if not exists idx_questions_workspace on public.questions (workspace_id);
create index if not exists idx_questions_opposition on public.questions (opposition_id);
create index if not exists idx_questions_topic on public.questions (topic_id);
create index if not exists idx_questions_status on public.questions (status);
create index if not exists idx_questions_difficulty on public.questions (difficulty);
create index if not exists idx_qoptions_question on public.question_options (question_id);
create index if not exists idx_qoptions_opposition on public.question_options (opposition_id);
create index if not exists idx_qvr_question on public.question_validation_results (question_id);
create index if not exists idx_qvr_status on public.question_validation_results (status);
create index if not exists idx_qreviews_question on public.question_reviews (question_id);
create index if not exists idx_qreviews_action on public.question_reviews (action);
create index if not exists idx_qrf_question on public.question_review_feedback (question_id);
create index if not exists idx_qrf_type on public.question_review_feedback (feedback_type);
create index if not exists idx_qrf_severity on public.question_review_feedback (severity);
create index if not exists idx_qgr_opposition on public.question_generation_runs (opposition_id);
create index if not exists idx_qgr_material on public.question_generation_runs (material_id);
create index if not exists idx_qgr_topic on public.question_generation_runs (topic_id);
create index if not exists idx_qgr_status on public.question_generation_runs (status);

-- =====================================================================
-- Helper: oposicion de una pregunta (SECURITY DEFINER, evita recursion RLS).
-- =====================================================================
create or replace function public.question_opposition(q uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select opposition_id from public.questions where id = q;
$$;

-- =====================================================================
-- RLS basica. Reglas que se preservan:
--   - El alumno (miembro no gestor) NO ve preguntas no `validated`.
--   - El alumno NO ve tablas internas (validation/reviews/feedback/generation).
--   - is_correct: el alumno puede leer opciones de preguntas validated para el
--     flujo de test, PERO no debe verse is_correct antes de enviar. Hoy eso lo
--     garantiza la capa de servicio/UI; servir opciones saneadas via RPC/vista
--     controlada queda para SPEC 025 (hardening). Guards de app siguen activos.
-- =====================================================================
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_validation_results enable row level security;
alter table public.question_reviews enable row level security;
alter table public.question_review_feedback enable row level security;
alter table public.question_generation_runs enable row level security;

-- questions: gestores ven/gestionan todo; alumnos miembros solo `validated`.
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select using (
    public.is_workspace_member(public.opposition_workspace(opposition_id))
    and (
      public.can_manage_workspace(public.opposition_workspace(opposition_id))
      or status = 'validated'
    )
  );
drop policy if exists questions_manage on public.questions;
create policy questions_manage on public.questions
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- question_options: gestores gestionan; alumnos leen opciones de validated.
drop policy if exists qoptions_select on public.question_options;
create policy qoptions_select on public.question_options
  for select using (
    public.is_workspace_member(public.opposition_workspace(opposition_id))
    and (
      public.can_manage_workspace(public.opposition_workspace(opposition_id))
      or exists (
        select 1 from public.questions q
        where q.id = question_id and q.status = 'validated'
      )
    )
  );
drop policy if exists qoptions_manage on public.question_options;
create policy qoptions_manage on public.question_options
  for all using (public.can_manage_workspace(public.opposition_workspace(opposition_id)))
  with check (public.can_manage_workspace(public.opposition_workspace(opposition_id)));

-- Tablas internas (solo gestores): validation results, reviews, feedback.
drop policy if exists qvr_manage on public.question_validation_results;
create policy qvr_manage on public.question_validation_results
  for all using (
    public.can_manage_workspace(public.opposition_workspace(public.question_opposition(question_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(public.question_opposition(question_id)))
  );

drop policy if exists qreviews_manage on public.question_reviews;
create policy qreviews_manage on public.question_reviews
  for all using (
    public.can_manage_workspace(public.opposition_workspace(public.question_opposition(question_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(public.question_opposition(question_id)))
  );

drop policy if exists qrf_manage on public.question_review_feedback;
create policy qrf_manage on public.question_review_feedback
  for all using (
    public.can_manage_workspace(public.opposition_workspace(public.question_opposition(question_id)))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(public.question_opposition(question_id)))
  );

-- generation_runs (solo gestores): scope via la oposicion del material o el tema.
drop policy if exists qgr_manage on public.question_generation_runs;
create policy qgr_manage on public.question_generation_runs
  for all using (
    public.can_manage_workspace(public.opposition_workspace(coalesce(
      (select m.opposition_id from public.materials m where m.id = material_id),
      (select t.opposition_id from public.topics t where t.id = topic_id))))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(coalesce(
      (select m.opposition_id from public.materials m where m.id = material_id),
      (select t.opposition_id from public.topics t where t.id = topic_id))))
  );
