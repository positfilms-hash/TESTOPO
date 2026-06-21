-- TESTOPO - SPEC 028-E: Source-Grounded Question Generation.
--
-- Refuerza el generador de preguntas (SPEC 004/018.4/023) para que las
-- candidatas se creen desde un tema aplicado y fragmentos de fuente concretos y
-- trazables. Esta migracion solo ANADE columnas (idempotente, sigue
-- docs/setup/migrations-runbook.md) a tablas que ya existen en Supabase
-- (SPEC 023). No crea tablas nuevas, no toca la RLS (hereda la de 023), no
-- genera preguntas validated.

-- =====================================================================
-- questions: punteros de fuente concretos (SPEC 028-E).
-- =====================================================================
alter table public.questions
  add column if not exists material_section_id uuid;
alter table public.questions
  add column if not exists source_reference_id uuid;
alter table public.questions
  add column if not exists topic_source_reference_id uuid;

-- Nota: material_sections / source_references viven en 028-C; las propuestas/
-- topic_source_references del indice (028-D) son InMemory por ahora, por eso NO
-- se anaden FKs aqui (forward-compat). Son punteros de trazabilidad.

create index if not exists idx_questions_material_section
  on public.questions (material_section_id);
create index if not exists idx_questions_source_reference
  on public.questions (source_reference_id);

-- =====================================================================
-- question_generation_runs: estrategia y fuentes usadas (SPEC 028-E).
-- =====================================================================
alter table public.question_generation_runs
  add column if not exists source_strategy text;
alter table public.question_generation_runs
  add column if not exists source_reference_ids jsonb not null default '[]'::jsonb;
alter table public.question_generation_runs
  add column if not exists material_section_ids jsonb not null default '[]'::jsonb;
