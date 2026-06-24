-- TESTOPO - SPEC 039: generacion DIRECTA de preguntas desde material estudiado.
--
-- NUMERACION (excepcion explicita, ya documentada en 035): el numero de migracion
-- es SECUENCIAL en su carpeta (036 = la siguiente tras 035) y NO coincide con el
-- numero de SPEC (039). La SPEC que origina la migracion se identifica por este
-- encabezado, no por el numero.
--
-- Enlace MINIMO y trazable entre la pregunta candidata / el run de generacion y el
-- ESTUDIO interno (SPEC 038: material_study_runs / _units / _concepts). Solo ANADE
-- columnas aditivas (idempotente, sigue docs/setup/migrations-runbook.md). NO crea
-- tablas, NO cambia la RLS (questions / question_generation_runs heredan la de 023:
-- escritura solo gestores), NO genera preguntas validated.

-- =====================================================================
-- questions: punteros trazables al estudio (SPEC 039). material_section_id y
-- source_reference_id ya existen (028-E). topic_id permanece NULL en este flujo
-- (la etiqueta descriptiva derivada de la unidad va en la columna `topic`).
-- =====================================================================
alter table public.questions
  add column if not exists material_study_run_id uuid;
alter table public.questions
  add column if not exists material_study_unit_id uuid;
alter table public.questions
  add column if not exists material_study_concept_id uuid;

-- FKs aditivas (on delete set null: borrar el estudio no borra la pregunta ya
-- revisable, solo desancla el puntero historico). Idempotente via guardas.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_material_study_run_fk') then
    alter table public.questions
      add constraint questions_material_study_run_fk
      foreign key (material_study_run_id)
      references public.material_study_runs (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'questions_material_study_unit_fk') then
    alter table public.questions
      add constraint questions_material_study_unit_fk
      foreign key (material_study_unit_id)
      references public.material_study_units (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'questions_material_study_concept_fk') then
    alter table public.questions
      add constraint questions_material_study_concept_fk
      foreign key (material_study_concept_id)
      references public.material_study_concepts (id) on delete set null;
  end if;
end $$;

create index if not exists idx_questions_material_study_run
  on public.questions (material_study_run_id);
create index if not exists idx_questions_material_study_unit
  on public.questions (material_study_unit_id);

-- =====================================================================
-- question_generation_runs: enlace al estudio del que parte la generacion directa.
-- `mode` = 'studied_material', `source_strategy` = 'studied_material' (028-E),
-- `topic_id` NULL. Solo se anade la columna de enlace.
-- =====================================================================
alter table public.question_generation_runs
  add column if not exists material_study_run_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'qgen_runs_material_study_run_fk'
  ) then
    alter table public.question_generation_runs
      add constraint qgen_runs_material_study_run_fk
      foreign key (material_study_run_id)
      references public.material_study_runs (id) on delete set null;
  end if;
end $$;

create index if not exists idx_qgen_runs_material_study_run
  on public.question_generation_runs (material_study_run_id);
