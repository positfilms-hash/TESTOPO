-- TESTOPO - Tracking de coste de IA por run (SPEC 038/039).
--
-- NUMERACION (excepcion ya documentada): numero SECUENCIAL (039 tras 038) != SPEC.
--
-- Añade columnas ADITIVAS e IDEMPOTENTES a las tablas de run de generacion y de
-- estudio para registrar el uso de tokens y el coste estimado por run. NO crea
-- tablas, NO cambia RLS (heredan la de gestion existente), NO guarda prompts ni
-- excerpts: solo agregados de tokens y coste. `cost_per_question` se DERIVA
-- (estimated_cost_usd / created_count) y no se almacena.

-- =====================================================================
-- question_generation_runs (023): coste del run de generacion de preguntas.
-- =====================================================================
alter table public.question_generation_runs
  add column if not exists input_tokens integer;
alter table public.question_generation_runs
  add column if not exists output_tokens integer;
alter table public.question_generation_runs
  add column if not exists total_tokens integer;
alter table public.question_generation_runs
  add column if not exists estimated_cost_usd numeric;
alter table public.question_generation_runs
  add column if not exists cost_model text;

-- Indice para sumar el coste diario por workspace+oposicion (guard de presupuesto).
create index if not exists idx_qgen_runs_cost_scope
  on public.question_generation_runs (workspace_id, opposition_id, created_at);

-- =====================================================================
-- material_study_runs (035): coste del run de estudio de material.
-- =====================================================================
alter table public.material_study_runs
  add column if not exists input_tokens integer;
alter table public.material_study_runs
  add column if not exists output_tokens integer;
alter table public.material_study_runs
  add column if not exists total_tokens integer;
alter table public.material_study_runs
  add column if not exists estimated_cost_usd numeric;
alter table public.material_study_runs
  add column if not exists cost_model text;

create index if not exists idx_study_runs_cost_scope
  on public.material_study_runs (workspace_id, opposition_id, created_at);
