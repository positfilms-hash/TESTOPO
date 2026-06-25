-- TESTOPO - Tracking de coste de OCR por documento (SPEC 034/035).
--
-- NUMERACION (excepcion ya documentada): numero SECUENCIAL (040 tras 039) != SPEC.
--
-- Añade columnas ADITIVAS e IDEMPOTENTES a material_ocr_runs (032) para registrar
-- el uso de tokens y el coste del OCR por documento. El coste REAL se calcula con
-- el `usage` que devuelve el proveedor (acumulado entre lotes); el guard de
-- presupuesto usa una estimacion previa por paginas. NO crea tablas, NO cambia RLS
-- (hereda la de gestion existente), NO guarda contenido del PDF ni prompts.

alter table public.material_ocr_runs
  add column if not exists input_tokens integer;
alter table public.material_ocr_runs
  add column if not exists output_tokens integer;
alter table public.material_ocr_runs
  add column if not exists total_tokens integer;
alter table public.material_ocr_runs
  add column if not exists estimated_cost_usd numeric;
alter table public.material_ocr_runs
  add column if not exists cost_model text;

-- Indice para sumar el coste de OCR por workspace+oposicion (presupuesto/auditoria).
create index if not exists idx_ocr_runs_cost_scope
  on public.material_ocr_runs (workspace_id, opposition_id, created_at);
