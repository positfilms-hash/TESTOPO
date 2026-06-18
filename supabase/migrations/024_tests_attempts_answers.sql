-- TESTOPO - SPEC 024: Supabase Repositories: Tests, Attempts & Answers.
--
-- Quinto y ultimo bloque de la migracion principal del MVP: tests, preguntas de
-- test, intentos y respuestas. Migracion IDEMPOTENTE (sigue el runbook). Tras
-- esta spec el nucleo del MVP puede correr con Supabase como persistencia real.
--
-- NOTAS de mapeo (los modelos de dominio mandan; no se cambian):
--   - `tests.filters` y `test_questions.options_order` se guardan como JSONB.
--   - `test_attempts.user_id` es nullable (en el MVP podia no haber usuario).
--   - Las columnas de scope que el modelo no transporta (`workspace_id`,
--     `opposition_id` en tablas hijas) van NULLABLE (forward-compat RLS 025); el
--     alcance real se deriva via test/attempt -> oposicion -> workspace.

-- =====================================================================
-- tests
-- =====================================================================
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  created_by uuid references public.profiles (id),
  title text,
  mode text not null check (mode in ('random', 'by_topic', 'by_difficulty', 'mixed')),
  status text not null default 'created'
    check (status in ('created', 'in_progress', 'completed', 'cancelled')),
  question_count integer not null default 0,
  filters jsonb,
  random_seed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- test_questions (preguntas incluidas en un test y su orden)
-- =====================================================================
create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  order_index integer not null default 0,
  options_order jsonb,
  created_at timestamptz not null default now(),
  unique (test_id, question_id),
  unique (test_id, order_index)
);

-- =====================================================================
-- test_attempts (un intento de realizar un test)
-- =====================================================================
create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid not null references public.oppositions (id) on delete cascade,
  test_id uuid not null references public.tests (id) on delete cascade,
  user_id uuid references public.profiles (id),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'cancelled')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer not null default 0,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unanswered_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- test_answers (respuesta del usuario a una pregunta del intento)
-- =====================================================================
create table if not exists public.test_answers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  opposition_id uuid references public.oppositions (id) on delete cascade,
  attempt_id uuid not null references public.test_attempts (id) on delete cascade,
  test_question_id uuid not null references public.test_questions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_option_id uuid references public.question_options (id) on delete set null,
  is_correct boolean,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, test_question_id)
);

-- =====================================================================
-- updated_at: reutiliza public.set_updated_at() (creada en 020). test_questions
-- no tiene updated_at en el modelo (solo created_at).
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

drop trigger if exists set_tests_updated_at on public.tests;
create trigger set_tests_updated_at
  before update on public.tests
  for each row execute function public.set_updated_at();

drop trigger if exists set_test_attempts_updated_at on public.test_attempts;
create trigger set_test_attempts_updated_at
  before update on public.test_attempts
  for each row execute function public.set_updated_at();

drop trigger if exists set_test_answers_updated_at on public.test_answers;
create trigger set_test_answers_updated_at
  before update on public.test_answers
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Indices utiles (SPEC 024, 10).
-- =====================================================================
create index if not exists idx_tests_workspace on public.tests (workspace_id);
create index if not exists idx_tests_opposition on public.tests (opposition_id);
create index if not exists idx_tests_created_by on public.tests (created_by);
create index if not exists idx_tests_status on public.tests (status);
create index if not exists idx_tests_mode on public.tests (mode);
create index if not exists idx_tq_test on public.test_questions (test_id);
create index if not exists idx_tq_question on public.test_questions (question_id);
create index if not exists idx_tq_opposition on public.test_questions (opposition_id);
create index if not exists idx_ta_workspace on public.test_attempts (workspace_id);
create index if not exists idx_ta_opposition on public.test_attempts (opposition_id);
create index if not exists idx_ta_test on public.test_attempts (test_id);
create index if not exists idx_ta_user on public.test_attempts (user_id);
create index if not exists idx_ta_status on public.test_attempts (status);
create index if not exists idx_ta_submitted on public.test_attempts (submitted_at);
create index if not exists idx_tans_attempt on public.test_answers (attempt_id);
create index if not exists idx_tans_test_question on public.test_answers (test_question_id);
create index if not exists idx_tans_question on public.test_answers (question_id);
create index if not exists idx_tans_option on public.test_answers (selected_option_id);

-- =====================================================================
-- Helper: oposicion de un test (SECURITY DEFINER, evita recursion RLS).
-- =====================================================================
create or replace function public.test_opposition(t uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select opposition_id from public.tests where id = t;
$$;

-- =====================================================================
-- RLS basica. Reglas preservadas:
--   - El alumno crea/realiza tests solo en oposiciones con acceso (miembro).
--   - El alumno solo ve SUS propios intentos/respuestas (user_id = auth.uid()).
--   - is_correct/explicacion antes de enviar: lo refuerza la capa de servicio/UI
--     (la columna is_correct existe en test_answers pero el alumno solo lee las
--     suyas; servir respuestas saneadas pre-submit es del hardening, SPEC 025).
--   - Guards de aplicacion siguen siendo la defensa principal.
-- =====================================================================
alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_answers enable row level security;

-- tests: miembros del workspace de la oposicion pueden leer y crear/gestionar.
drop policy if exists tests_select on public.tests;
create policy tests_select on public.tests
  for select using (public.is_workspace_member(public.opposition_workspace(opposition_id)));
drop policy if exists tests_write on public.tests;
create policy tests_write on public.tests
  for all to authenticated
  using (public.is_workspace_member(public.opposition_workspace(opposition_id)))
  with check (public.is_workspace_member(public.opposition_workspace(opposition_id)));

-- test_questions: visibles/gestionables por miembros del workspace del test.
drop policy if exists tq_select on public.test_questions;
create policy tq_select on public.test_questions
  for select using (
    public.is_workspace_member(public.opposition_workspace(public.test_opposition(test_id)))
  );
drop policy if exists tq_write on public.test_questions;
create policy tq_write on public.test_questions
  for all to authenticated
  using (public.is_workspace_member(public.opposition_workspace(public.test_opposition(test_id))))
  with check (public.is_workspace_member(public.opposition_workspace(public.test_opposition(test_id))));

-- test_attempts: el usuario solo ve/gestiona SUS intentos; gestores pueden leer.
drop policy if exists ta_select on public.test_attempts;
create policy ta_select on public.test_attempts
  for select using (
    user_id = auth.uid()
    or public.can_manage_workspace(public.opposition_workspace(opposition_id))
  );
drop policy if exists ta_write on public.test_attempts;
create policy ta_write on public.test_attempts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- test_answers: el usuario solo ve/gestiona las respuestas de SUS intentos.
drop policy if exists tans_all on public.test_answers;
create policy tans_all on public.test_answers
  for all to authenticated
  using (
    exists (
      select 1 from public.test_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.test_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );
