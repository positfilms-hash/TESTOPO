-- TESTOPO - SPEC 028: Smart Bulk Upload - Categorias de carga.
--
-- Anade a las tablas de importacion (creadas en 022) los campos que la carga
-- masiva inteligente necesita para distinguir DOS categorias de subida
-- (`Material de la oposicion` / `Tests antiguos`) y trazar la clasificacion por
-- archivo. Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md): solo
-- anade columnas con `add column if not exists`; no borra datos, no cambia
-- reglas de negocio ni modelos existentes.
--
-- NOTA: los resumenes de patrones de examen / propuestas de indice IA (SPEC 019)
-- siguen viviendo en memoria (ver docs/architecture/persistence.md); esta spec
-- NO crea tablas para ellos. Los archivos subidos NUNCA se guardan en Supabase
-- ni en el repo (solo metadatos + storage_path interno).

-- =====================================================================
-- material_import_batches: categoria elegida, contador de analizados, avisos.
-- =====================================================================
alter table public.material_import_batches
  add column if not exists upload_category text not null default 'opposition_material';

alter table public.material_import_batches
  add column if not exists analyzed_files integer not null default 0;

alter table public.material_import_batches
  add column if not exists warnings jsonb not null default '[]'::jsonb;

-- Constraint de valores validos (idempotente: se recrea).
alter table public.material_import_batches
  drop constraint if exists material_import_batches_upload_category_check;
alter table public.material_import_batches
  add constraint material_import_batches_upload_category_check
  check (upload_category in ('opposition_material', 'old_tests', 'mixed'));

-- =====================================================================
-- material_import_items: categoria elegida + detectada + confianza.
-- (`workspace_id`/`opposition_id` ya existen nullable desde 022.)
-- =====================================================================
alter table public.material_import_items
  add column if not exists upload_category text not null default 'opposition_material';

alter table public.material_import_items
  add column if not exists detected_category text not null default 'opposition_material';

alter table public.material_import_items
  add column if not exists ai_classification_confidence numeric;

alter table public.material_import_items
  drop constraint if exists material_import_items_upload_category_check;
alter table public.material_import_items
  add constraint material_import_items_upload_category_check
  check (upload_category in ('opposition_material', 'old_tests', 'mixed'));

alter table public.material_import_items
  drop constraint if exists material_import_items_detected_category_check;
alter table public.material_import_items
  add constraint material_import_items_detected_category_check
  check (detected_category in ('opposition_material', 'old_tests', 'unknown'));

-- =====================================================================
-- RLS: sin cambios. Las politicas `*_manage` por `can_manage_workspace`
-- (022/025) ya cubren estas columnas: solo gestores (owner/admin) acceden a
-- los lotes/items de importacion. El alumno NUNCA ve estas tablas.
-- =====================================================================
