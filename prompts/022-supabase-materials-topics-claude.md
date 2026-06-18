# Claude Prompt - SPEC 022 Supabase Repositories: Materials & Topics

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 022 - Supabase Repositories: Materials & Topics
```

La app ya tiene:

- SPEC 017 - Unified Syllabus & Bulk Material Import.
- SPEC 019 - AI Syllabus Index Builder.
- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- Tooling/runbook de migraciones Supabase.

## Spec

Implementa estrictamente:

```text
docs/specs/022-supabase-materials-topics.md
```

Branch de trabajo:

```text
feature/supabase-materials-topics
```

Runbook obligatorio:

```text
docs/setup/migrations-runbook.md
```

No crees un proceso paralelo de migracion.

## Product Goal

Persistir en Supabase el bloque de materiales, temario e importaciones:

- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.

Estado esperado tras esta spec:

```text
Supabase:
- Auth
- profiles
- workspaces
- workspace_members
- oppositions
- opposition_access
- materials
- topics
- material_topic_links
- material_import_batches
- material_import_items

InMemory:
- questions
- question_options
- validation results
- reviews
- review feedback
- generation runs
- syllabus index runs/proposals
- tests
- attempts
- answers
```

## Non-Negotiable Rules

- Usa `docs/setup/migrations-runbook.md`.
- No migres `questions`.
- No migres `question_options`.
- No migres `tests`.
- No migres attempts/results.
- No migres syllabus index proposal tables.
- No implementes Supabase Storage salvo que ya este preparado y sea imprescindible.
- No generes preguntas automaticamente tras subir material.
- No cambies reglas de negocio.
- No elimines InMemory.
- Mantener fallback InMemory si Supabase no esta configurado.
- No hardcodees claves.
- No subas `.env`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- CI/tests deben poder pasar sin Supabase real configurado.

## Required Implementation

### 1. SQL migration

Crear:

```text
supabase/migrations/022_materials_topics.sql
```

Debe seguir el runbook:

- Nombre alineado con la SPEC.
- Idempotente.
- Sin datos reales ni claves.
- `updated_at` + trigger.
- RLS basica.
- Documentacion actualizada.

Debe crear o consolidar:

- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.

Incluye:

- Primary keys.
- Foreign keys.
- Checks.
- Uniques recomendados.
- Indices utiles.
- RLS basica.

No tocar tablas fuera de alcance salvo referencias necesarias.

### 2. Supabase repositories

Crear repositorios Supabase que implementen las interfaces async existentes:

- `SupabaseMaterialRepository`.
- `SupabaseTopicRepository`.
- `SupabaseMaterialTopicLinkRepository`.
- `SupabaseMaterialImportBatchRepository`.
- `SupabaseMaterialImportItemRepository`.

Los repos deben mapear filas Supabase a modelos de dominio sin cambiar contratos de servicios.

### 3. Repository factory / persistence selector

Actualizar el factory para que:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos siguen InMemory

APP_PERSISTENCE_MODE=supabase
-> profiles/workspaces/workspace_members/oppositions/opposition_access/materials/topics/imports usan Supabase
-> questions/tests/attempts siguen InMemory
```

### 4. Compatibility

Mantener:

- PDF upload.
- ZIP import.
- AI Syllabus Index Builder.
- Question generation solo como consumidor de materials/topics, sin migrar preguntas.

No implementar Supabase Storage salvo necesidad estricta y ya preparada.

### 5. UX change

Unificar los botones de alta individual:

```text
Anadir material + Subir PDF -> Subir material
```

Reglas:

- En la pantalla de materiales debe haber un unico CTA principal "Subir material".
- Ese flujo debe permitir registrar material manual/textual y subir PDF desde la misma experiencia.
- Si existe ZIP/multiple import, puede mantenerse como flujo secundario separado.
- No romper PDF upload.
- No generar preguntas automaticamente tras subir material.

## Required Tests

Anade tests para:

- Crear/listar/actualizar materials en Supabase port/mock.
- Filtros por type/status/extraction_status.
- Marcar material obsolete.
- Crear/listar topics y arbol de topics.
- Reglas de jerarquia: self-parent, ciclos, parent de otra oposicion, duplicado bajo parent.
- Asociar/desasociar material-topic.
- Rechazar asociaciones cruzando opposition/workspace.
- Crear import batch/items.
- ZIP import crea batch/items/materials/topics/links.
- ZIP import rechaza rutas inseguras.
- ZIP import no genera preguntas automaticamente.
- Factory usa InMemory en modo memory.
- Factory usa Supabase para materials/topics/imports en modo supabase.
- Questions/tests siguen InMemory.
- PDF upload sigue funcionando.
- UI muestra un unico CTA principal "Subir material" para alta individual/PDF.
- No se expone `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- Tests existentes siguen pasando.

Los tests con Supabase real deben ser opcionales. Por defecto, CI debe pasar sin red ni Supabase real.

## Required Documentation

Actualizar:

```text
docs/architecture/persistence.md
docs/setup/supabase-setup.md
docs/setup/migrations-runbook.md
```

Debe explicar:

- Que `materials` esta en Supabase.
- Que `topics` esta en Supabase.
- Que `material_topic_links` esta en Supabase.
- Que import batches/items estan en Supabase.
- Que tablas siguen en memoria.
- Como activar Supabase.
- Como volver a InMemory.
- Migracion `022_materials_topics.sql`.
- Estado hibrido actual.
- Specs futuras pendientes.

## Security Checklist

Antes de terminar, verifica:

- No hay claves reales en el repo.
- No hay `SUPABASE_SERVICE_ROLE_KEY` en codigo frontend.
- No hay `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- No se usa service role desde componentes React.
- No se loguean claves.
- `.env` sigue ignorado.
- RLS basica o documentacion explicita de pendientes.
- Guards de aplicacion siguen activos.
- No se exponen rutas internas de `storage_path` a estudiantes.
- ZIP import mantiene validaciones contra rutas inseguras.

## Out Of Scope

No implementes:

- Repositorios Supabase para preguntas.
- Repositorios Supabase para opciones.
- Repositorios Supabase para tests.
- Repositorios Supabase para attempts/results.
- Storage real si no esta preparado.
- OCR.
- RAG avanzado.
- Embeddings.
- Fine-tuning.
- Generacion automatica de preguntas al subir material.

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de cambios.
- Migracion creada.
- Repositorios Supabase creados.
- Como activar modo Supabase.
- Que sigue en InMemory.
- Confirmacion de PDF upload, ZIP import y AI Syllabus Index Builder.
- Confirmacion del cambio UI "Subir material".
- Tests ejecutados.
- Confirmacion explicita de que no se migro nada fuera del bloque `materials/topics/imports`.
