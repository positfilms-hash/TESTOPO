-- TESTOPO - SPEC 040: motor de fiabilidad y memoria de feedback.
--
-- NUMERACION (excepcion ya documentada en 035/036): el numero es SECUENCIAL (037 =
-- la siguiente tras 036) y NO coincide con el de SPEC (040). La SPEC se identifica
-- por este encabezado.
--
-- REUTILIZA las tablas existentes (NO crea tablas nuevas, NO fine-tuning/embeddings):
--   - question_reviews / question_review_feedback (023): revision + feedback.
--   - ai_error_memories / ai_question_quality_scores (028-F): memoria + scoring.
--   - question_generation_runs (023/036): historial de generacion.
-- Solo ANADE columnas/indices minimos (aditiva e IDEMPOTENTE,
-- docs/setup/migrations-runbook.md). NO cambia RLS: las columnas nuevas heredan las
-- politicas de gestion existentes y el aislamiento workspace/oposicion. NO valida
-- preguntas automaticamente.

-- =====================================================================
-- question_review_feedback: enlaces minimos para reconstruir el dataset
-- (run de generacion + correccion sugerida + tipo de problema de fuente).
-- Mantiene question_id/review_id/workspace_id/opposition_id/created_by/fecha.
-- =====================================================================
alter table public.question_review_feedback
  add column if not exists generation_run_id uuid;
alter table public.question_review_feedback
  add column if not exists suggested_fix text;
alter table public.question_review_feedback
  add column if not exists source_issue text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'qrf_generation_run_fk'
  ) then
    alter table public.question_review_feedback
      add constraint qrf_generation_run_fk
      foreign key (generation_run_id)
      references public.question_generation_runs (id) on delete set null;
  end if;
end $$;

create index if not exists idx_qrf_generation_run
  on public.question_review_feedback (generation_run_id);
create index if not exists idx_qrf_scope
  on public.question_review_feedback (workspace_id, opposition_id);

-- =====================================================================
-- ai_error_memories: ambito minimo + recencia + ejemplo, manteniendo type/
-- severity/summary/avoid_instruction/occurrences. `scope` distingue memoria de
-- oposicion (general) de la acotada por dificultad. La memoria NUNCA guarda
-- fuentes, extractos, prompts ni datos de otro cliente.
-- =====================================================================
alter table public.ai_error_memories
  add column if not exists scope text not null default 'opposition';
alter table public.ai_error_memories
  drop constraint if exists ai_error_memories_scope_check;
alter table public.ai_error_memories
  add constraint ai_error_memories_scope_check
  check (scope in ('opposition', 'difficulty'));
alter table public.ai_error_memories
  add column if not exists difficulty text;
alter table public.ai_error_memories
  drop constraint if exists ai_error_memories_difficulty_check;
alter table public.ai_error_memories
  add constraint ai_error_memories_difficulty_check
  check (difficulty is null or difficulty in ('easy', 'medium', 'hard'));
alter table public.ai_error_memories
  add column if not exists last_seen_at timestamptz;
alter table public.ai_error_memories
  add column if not exists example_question_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_error_memories_example_question_fk'
  ) then
    alter table public.ai_error_memories
      add constraint ai_error_memories_example_question_fk
      foreign key (example_question_id)
      references public.questions (id) on delete set null;
  end if;
end $$;

-- Clave de AGREGACION por workspace + oposicion + tipo + ambito (NO unica: el
-- servicio reconstruye la memoria por oposicion; sirve para la seleccion acotada).
create index if not exists idx_ai_error_memories_aggregation
  on public.ai_error_memories (workspace_id, opposition_id, type, scope, difficulty);
