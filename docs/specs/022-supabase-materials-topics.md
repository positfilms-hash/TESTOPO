# SPEC 022 - Supabase Repositories: Materials & Topics

## 1. Objetivo

Migrar a Supabase el bloque de temario y materiales de TESTOPO.

Esta spec continua la migracion progresiva iniciada en specs anteriores.

Se migran:

- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.

No se migran todavia:

- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.
- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.
- `syllabus_index_runs`.
- `syllabus_index_proposals`.

## 2. Contexto

Specs previas relevantes:

- SPEC 017 - Unified Syllabus & Bulk Material Import.
- SPEC 019 - AI Syllabus Index Builder.
- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.

Despues de la SPEC 021 ya existen en Supabase:

- Auth.
- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.

Ahora toca migrar el bloque que permite organizar la oposicion:

```text
Oposicion
  -> Temario
  -> Materiales
  -> Importaciones
```

Esta SPEC 022 debe usar el tooling/runbook existente:

```text
docs/setup/migrations-runbook.md
```

No crear un proceso paralelo de migracion.

## 3. Branch

```text
feature/supabase-materials-topics
```

## 4. Principio Central

La migracion sigue siendo progresiva.

Correcto:

- Migrar `materials`, `topics` e import batches/items.
- Mantener `questions`, `tests`, `attempts` y resultados en memoria.
- Mantener fallback InMemory.
- Usar tooling/runbook existente.
- Documentar estado hibrido.
- Mantener compatibilidad con subida PDF, ZIP import y AI Syllabus Index Builder.

Incorrecto:

- Migrar preguntas y tests en esta spec.
- Cambiar reglas de negocio.
- Romper subida de PDFs.
- Romper importacion ZIP.
- Implementar Supabase Storage si no esta previsto.
- Ignorar el runbook de migracion.

## 5. Alcance

Claude debe implementar:

- Migracion SQL para `materials`.
- Migracion SQL para `topics`.
- Migracion SQL para `material_topic_links`.
- Migracion SQL para `material_import_batches`.
- Migracion SQL para `material_import_items`.
- Repositorio Supabase para `materials`.
- Repositorio Supabase para `topics`.
- Repositorio Supabase para relaciones material-topic.
- Repositorios Supabase para import batches/items.
- Adaptacion del factory de repositorios.
- Integracion con `oppositions` reales en Supabase.
- Integracion con `workspaces` reales en Supabase.
- Tests criticos.
- Actualizacion de documentacion de persistencia.
- Uso del tooling/runbook de migracion ya existente.
- UX: unificar los botones de alta de material/PDF en un unico boton "Subir material".

## 6. Fuera De Alcance

No implementar todavia:

- Repositorios Supabase para `questions`.
- Repositorios Supabase para `question_options`.
- Repositorios Supabase para `tests`.
- Repositorios Supabase para attempts/results.
- Supabase Storage para archivos si no esta ya preparado.
- RLS completa de todo el dominio.
- Edge Functions.
- Borrado real de cuenta Auth.
- OCR.
- RAG avanzado.
- Embeddings.
- Fine-tuning.
- Generacion automatica de preguntas al subir material.
- Beta readiness.

## 7. Estado Esperado Tras Esta Spec

Supabase:

- Auth.
- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.

InMemory:

- `questions`.
- `question_options`.
- Validation results.
- Reviews.
- Review feedback.
- Generation runs.
- Syllabus index runs/proposals.
- `tests`.
- Attempts.
- Answers.

Este estado hibrido es correcto.

## 8. Tablas Afectadas

### 8.1 `materials`

Representa cualquier material subido o registrado en una oposicion.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
uploaded_by uuid references profiles(id)
title text not null
description text
type text not null
status text not null default 'active'
original_filename text
mime_type text
file_extension text
size_bytes bigint
storage_path text
content_text text
reference text
extraction_status text default 'not_started'
extraction_error text
page_count integer
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `type`:

- `syllabus`.
- `old_test`.
- `official_exam`.
- `law`.
- `notes`.
- `other`.

Valores permitidos para `status`:

- `active`.
- `deprecated`.
- `obsolete`.
- `needs_review`.

Valores permitidos para `extraction_status`:

- `not_started`.
- `processing`.
- `completed`.
- `failed`.
- `not_supported`.

Reglas:

- Un material siempre pertenece a una oposicion.
- Un material siempre pertenece indirectamente a un workspace.
- `workspace_id` debe coincidir con el workspace de la oposicion.
- `uploaded_by` debe ser profile existente si esta disponible.
- Un material `obsolete` no debe usarse para validar nuevas preguntas.
- Un estudiante solo debe ver materiales activos de oposiciones autorizadas.
- No guardar archivos reales dentro del repo.
- `storage_path` debe ser una referencia interna, no una URL publica sin control.

### 8.2 `topics`

Representa temas y subtemas dentro de una oposicion.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
parent_id uuid references topics(id)
title text not null
description text
code text
order_index integer default 0
status text not null default 'active'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `status`:

- `active`.
- `needs_review`.
- `deprecated`.
- `obsolete`.

Restriccion recomendada:

```text
unique(opposition_id, parent_id, title)
```

Reglas:

- Un topic siempre pertenece a una oposicion.
- Un topic siempre pertenece a un workspace.
- `parent_id` debe pertenecer a la misma oposicion.
- No permitir ciclos en la jerarquia.
- No permitir que un topic sea padre de si mismo.
- Un topic `obsolete` no debe usarse para validar nuevas preguntas.
- Student solo debe ver topics activos asociados a oposiciones autorizadas.

### 8.3 `material_topic_links`

Relacion entre materiales y temas.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
material_id uuid not null references materials(id)
topic_id uuid not null references topics(id)
reference text
created_at timestamptz not null default now()
```

Restriccion recomendada:

```text
unique(material_id, topic_id)
```

Reglas:

- `material_id` y `topic_id` deben pertenecer a la misma oposicion.
- No permitir enlaces cruzados entre oposiciones.
- No permitir enlaces cruzados entre workspaces.
- Un material puede pertenecer a varios temas.
- Un tema puede tener varios materiales.

### 8.4 `material_import_batches`

Representa una importacion multiple de archivos o ZIP.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
uploaded_by uuid references profiles(id)
status text not null default 'pending'
source_type text not null
original_filename text
total_files integer default 0
imported_files integer default 0
skipped_files integer default 0
failed_files integer default 0
errors jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `source_type`:

- `multi_file`.
- `zip`.
- `folder`.

Para MVP:

- `multi_file`.
- `zip`.

Valores permitidos para `status`:

- `pending`.
- `processing`.
- `completed`.
- `completed_with_errors`.
- `failed`.

### 8.5 `material_import_items`

Representa cada archivo procesado dentro de un lote.

Campos recomendados:

```text
id uuid primary key
batch_id uuid not null references material_import_batches(id)
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
material_id uuid references materials(id)
topic_id uuid references topics(id)
original_path text
original_filename text
status text not null
error text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `status`:

- `imported`.
- `skipped`.
- `failed`.

Reglas:

- Cada item pertenece a un batch.
- Si `status = imported`, debe existir `material_id`.
- Si hay `topic_id`, debe pertenecer a la misma oposicion.
- `original_path` conserva la ruta original del ZIP.
- No guardar rutas inseguras con `../` ni rutas absolutas.

## 9. Migraciones

Crear migracion en:

```text
supabase/migrations
```

Nombre obligatorio segun runbook:

```text
022_materials_topics.sql
```

La migracion debe:

1. Crear `materials`.
2. Crear `topics`.
3. Crear `material_topic_links`.
4. Crear `material_import_batches`.
5. Crear `material_import_items`.
6. Crear constraints basicos.
7. Crear indices.
8. Crear o reutilizar trigger de `updated_at`.
9. Activar RLS basica siguiendo el patron de specs previas.
10. No tocar tablas fuera de alcance salvo referencias necesarias.

Debe seguir las reglas de idempotencia de:

```text
docs/setup/migrations-runbook.md
```

## 10. Indices Recomendados

Crear indices para:

- `materials.workspace_id`.
- `materials.opposition_id`.
- `materials.uploaded_by`.
- `materials.status`.
- `materials.type`.
- `materials.extraction_status`.
- `topics.workspace_id`.
- `topics.opposition_id`.
- `topics.parent_id`.
- `topics.status`.
- `topics.opposition_id + parent_id + title`.
- `material_topic_links.material_id`.
- `material_topic_links.topic_id`.
- `material_topic_links.opposition_id`.
- `material_import_batches.workspace_id`.
- `material_import_batches.opposition_id`.
- `material_import_batches.uploaded_by`.
- `material_import_batches.status`.
- `material_import_items.batch_id`.
- `material_import_items.material_id`.
- `material_import_items.topic_id`.
- `material_import_items.status`.

## 11. Row Level Security Basica

Seguir el patron de la SPEC 020 y SPEC 021.

No hace falta implementar todavia toda la RLS final del producto. Eso sera una spec posterior de hardening.

Politicas minimas recomendadas:

`materials`:

- Owner/admin puede crear materiales en oposiciones de su workspace.
- Owner/admin puede actualizar materiales.
- Owner/admin puede marcar materiales como `obsolete`.
- Student puede leer solo materiales `active` de oposiciones con acceso activo.
- Student no puede crear, actualizar ni borrar materiales.

`topics`:

- Owner/admin puede crear y editar temas.
- Owner/admin puede marcar temas como `obsolete`.
- Student puede leer solo temas `active` de oposiciones con acceso activo.
- Student no puede crear ni editar temas.

`material_topic_links`:

- Owner/admin puede crear/eliminar asociaciones.
- Student puede leer asociaciones de materiales/temas visibles.

`material_import_batches` y `material_import_items`:

- Owner/admin puede crear y ver importaciones de su oposicion.
- Student no puede crear importaciones.
- Student normalmente no necesita ver batches de importacion.

Si la RLS complica la implementacion:

- Activar RLS.
- Anadir politicas basicas.
- Mantener guards de aplicacion.
- Documentar politicas pendientes.

## 12. Repositorios Supabase

Crear implementaciones similares a:

- `SupabaseMaterialRepository`.
- `SupabaseTopicRepository`.
- `SupabaseMaterialTopicLinkRepository`.
- `SupabaseMaterialImportBatchRepository`.
- `SupabaseMaterialImportItemRepository`.

Deben cumplir las interfaces async existentes.

## 13. Metodos Esperados: `MaterialRepository`

Ejemplo conceptual:

```ts
class SupabaseMaterialRepository implements MaterialRepository {
  async findById(id: string): Promise<Material | null> {}
  async listByOpposition(oppositionId: string, filters?: MaterialFilters): Promise<Material[]> {}
  async listByTopic(topicId: string): Promise<Material[]> {}
  async create(input: CreateMaterialInput): Promise<Material> {}
  async update(id: string, input: UpdateMaterialInput): Promise<Material> {}
  async markObsolete(id: string): Promise<Material> {}
}
```

Debe soportar filtros por:

- `type`.
- `status`.
- `extraction_status`.
- `topic_id`.

## 14. Metodos Esperados: `TopicRepository`

Ejemplo conceptual:

```ts
class SupabaseTopicRepository implements TopicRepository {
  async findById(id: string): Promise<Topic | null> {}
  async listByOpposition(oppositionId: string): Promise<Topic[]> {}
  async listTreeByOpposition(oppositionId: string): Promise<TopicTreeNode[]> {}
  async create(input: CreateTopicInput): Promise<Topic> {}
  async update(id: string, input: UpdateTopicInput): Promise<Topic> {}
  async markObsolete(id: string): Promise<Topic> {}
}
```

Debe mantener reglas de jerarquia:

- No self-parent.
- No ciclos.
- No parent de otra oposicion.
- No duplicado bajo mismo parent.

## 15. Metodos Esperados: `MaterialTopicLinkRepository`

Ejemplo conceptual:

```ts
class SupabaseMaterialTopicLinkRepository implements MaterialTopicLinkRepository {
  async linkMaterialToTopic(input: LinkMaterialToTopicInput): Promise<MaterialTopicLink> {}
  async unlinkMaterialFromTopic(materialId: string, topicId: string): Promise<void> {}
  async listByMaterial(materialId: string): Promise<MaterialTopicLink[]> {}
  async listByTopic(topicId: string): Promise<MaterialTopicLink[]> {}
}
```

Reglas:

- No duplicar enlace.
- No cruzar oposicion.
- No cruzar workspace.

## 16. Metodos Esperados: Import Batch Repositories

Ejemplo conceptual:

```ts
class SupabaseMaterialImportBatchRepository implements MaterialImportBatchRepository {
  async create(input: CreateMaterialImportBatchInput): Promise<MaterialImportBatch> {}
  async update(id: string, input: UpdateMaterialImportBatchInput): Promise<MaterialImportBatch> {}
  async findById(id: string): Promise<MaterialImportBatch | null> {}
  async listByOpposition(oppositionId: string): Promise<MaterialImportBatch[]> {}
}

class SupabaseMaterialImportItemRepository implements MaterialImportItemRepository {
  async create(input: CreateMaterialImportItemInput): Promise<MaterialImportItem> {}
  async listByBatch(batchId: string): Promise<MaterialImportItem[]> {}
  async update(id: string, input: UpdateMaterialImportItemInput): Promise<MaterialImportItem> {}
}
```

## 17. Factory De Repositorios

Actualizar el factory siguiendo el patron de specs previas.

Comportamiento esperado:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos usan InMemory

APP_PERSISTENCE_MODE=supabase
-> profiles/workspaces/workspace_members/oppositions/opposition_access/materials/topics/imports usan Supabase
-> questions/tests/attempts siguen en InMemory
```

Debe quedar documentado el estado hibrido.

## 18. Compatibilidad Con Subida PDF

La subida PDF debe seguir funcionando.

Esta spec migra metadatos de material a Supabase, pero no obliga a migrar almacenamiento fisico de archivos.

Reglas:

- El archivo puede seguir guardandose donde la app lo guarde actualmente.
- La base de datos guarda `storage_path`, metadatos y `content_text`.
- No guardar archivos reales en el repo.
- No exponer `storage_path` directamente a estudiantes si contiene rutas internas.
- La extraccion de texto debe actualizar `content_text` y `extraction_status`.

## 19. Compatibilidad Con ZIP Import

La importacion ZIP debe seguir funcionando.

Al importar un ZIP:

```text
ZIP
  -> batch en material_import_batches
  -> items en material_import_items
  -> topics creados en Supabase
  -> materials creados en Supabase
  -> links material-topic en Supabase
```

Reglas:

- Mantener validaciones de seguridad ZIP.
- No permitir rutas `../`.
- No permitir rutas absolutas.
- No permitir ZIP anidado.
- No importar extensiones no permitidas.
- No generar preguntas automaticamente tras importar.

## 20. Compatibilidad Con AI Syllabus Index Builder

La SPEC 019 debe seguir funcionando.

Si el AI Syllabus Index Builder usa materiales y topics:

- Debe leer materiales desde Supabase en modo Supabase.
- Debe crear/aplicar topics en Supabase en modo Supabase.
- Sus propias entidades de propuesta pueden seguir en memoria si no se migran en esta spec.
- No migrar todavia `syllabus_index_runs` ni `syllabus_index_proposals`.

## 21. Compatibilidad Con Generacion De Preguntas

La generacion de preguntas debe poder leer materiales y topics desde Supabase.

Pero:

- Las preguntas generadas pueden seguir guardandose en InMemory hasta SPEC 023.
- No cambiar reglas de generacion.
- No permitir que preguntas generadas nazcan como `validated`.
- No generar preguntas automaticamente tras subir material.

## 22. UX: Unificar Subida De Material

Actualmente la UI puede exponer acciones separadas como "Anadir material" y "Subir PDF".

Esta spec debe unificarlas en un unico punto de entrada:

```text
Subir material
```

Reglas UX:

- El usuario debe ver un unico boton principal "Subir material".
- Ese flujo debe permitir registrar material manual/textual y subir PDF desde la misma experiencia.
- Si existe importacion ZIP/multiple, puede mantenerse como flujo secundario separado si ya existe y tiene sentido operativo, pero no debe confundirse con la subida individual de material.
- No duplicar CTAs equivalentes en la misma pantalla.
- No romper el flujo actual de PDF upload.
- No implementar generacion automatica de preguntas tras subir material.

Tests/validaciones recomendadas:

- En la pantalla de materiales no deben aparecer simultaneamente "Anadir material" y "Subir PDF" como botones principales separados.
- El flujo "Subir material" debe permitir completar una subida PDF.
- El flujo "Subir material" debe permitir registrar material no-PDF si esa capacidad ya existia.

## 23. Servicios Afectados

Actualizar servicios de:

- `MaterialService`.
- `TopicService`.
- Material-topic link service/repository.
- `MaterialImportService`.
- PDF upload flow.
- ZIP import flow.
- Syllabus Index apply flow, solo si usa `TopicService`/`MaterialService`.
- `QuestionGenerationService`, solo para leer material/topic si corresponde.

No modificar todavia servicios de:

- `QuestionRepository`.
- `TestRepository`.
- `TestAttemptRepository`.
- Result repository.

Salvo cambios minimos necesarios para compilar.

## 24. Reglas De Negocio Que Deben Mantenerse

Deben seguir cumpliendose:

1. No existe material sin oposicion.
2. No existe topic sin oposicion.
3. No se cruzan materiales y topics de oposiciones distintas.
4. No se cruzan workspaces.
5. Student no puede subir material.
6. Student no puede crear temas.
7. Student solo ve materiales activos.
8. Student solo ve temas activos.
9. Material `obsolete` no debe usarse para validar preguntas nuevas.
10. Topic `obsolete` no debe usarse para validar preguntas nuevas.
11. ZIP import no genera preguntas automaticamente.
12. AI Syllabus Index no aplica indice sin aprobacion humana.
13. No se rompen permisos de workspace/opposition.

## 25. Errores Recomendados

- `MATERIAL_NOT_FOUND`.
- `MATERIAL_REQUIRED`.
- `MATERIAL_OPPOSITION_REQUIRED`.
- `MATERIAL_WORKSPACE_REQUIRED`.
- `MATERIAL_CREATE_FAILED`.
- `MATERIAL_UPDATE_FAILED`.
- `MATERIAL_ACCESS_DENIED`.
- `MATERIAL_TYPE_INVALID`.
- `MATERIAL_STATUS_INVALID`.
- `MATERIAL_OBSOLETE`.
- `TOPIC_NOT_FOUND`.
- `TOPIC_REQUIRED`.
- `TOPIC_OPPOSITION_REQUIRED`.
- `TOPIC_WORKSPACE_REQUIRED`.
- `TOPIC_CREATE_FAILED`.
- `TOPIC_UPDATE_FAILED`.
- `TOPIC_ACCESS_DENIED`.
- `TOPIC_INVALID_STATUS`.
- `TOPIC_PARENT_NOT_FOUND`.
- `TOPIC_PARENT_OPPOSITION_MISMATCH`.
- `TOPIC_CANNOT_BE_OWN_PARENT`.
- `TOPIC_HIERARCHY_CYCLE_DETECTED`.
- `TOPIC_DUPLICATE_UNDER_PARENT`.
- `MATERIAL_TOPIC_LINK_NOT_FOUND`.
- `MATERIAL_TOPIC_LINK_ALREADY_EXISTS`.
- `MATERIAL_TOPIC_OPPOSITION_MISMATCH`.
- `MATERIAL_TOPIC_WORKSPACE_MISMATCH`.
- `IMPORT_BATCH_NOT_FOUND`.
- `IMPORT_BATCH_CREATE_FAILED`.
- `IMPORT_ITEM_CREATE_FAILED`.
- `IMPORT_ZIP_UNSAFE_PATH`.
- `IMPORT_FILE_EXTENSION_NOT_ALLOWED`.
- `SUPABASE_QUERY_FAILED`.
- `PERSISTENCE_MODE_INVALID`.

## 26. Tests Obligatorios

Materials:

- Crear material en oposicion valida.
- No crear material sin oposicion.
- No crear material cruzando workspace/opposition.
- Buscar material por id.
- Listar materiales por oposicion.
- Filtrar materiales por type/status/extraction_status.
- Actualizar `extraction_status` y `content_text`.
- Marcar material `obsolete`.
- Student solo ve materiales `active`.
- Student no puede crear material.

Topics:

- Crear topic en oposicion valida.
- Crear subtopic.
- No crear topic sin oposicion.
- No crear topic con parent de otra oposicion.
- No permitir self-parent.
- No permitir ciclos.
- No duplicar titulo bajo mismo parent.
- Listar arbol de temas.
- Marcar topic `obsolete`.
- Student solo ve topics `active`.
- Student no puede crear topic.

Material-topic links:

- Asociar material a topic.
- No duplicar asociacion.
- No asociar material y topic de distinta oposicion.
- No asociar material y topic de distinto workspace.
- Listar materiales por topic.
- Listar topics por material.
- Desvincular material de topic.

Imports:

- Crear batch de importacion.
- Crear items de importacion.
- Asociar item importado a material/topic.
- Registrar item skipped.
- Registrar item failed.
- ZIP import crea batch/items/materials/topics/links.
- ZIP import rechaza rutas inseguras.
- ZIP import no genera preguntas automaticamente.

Factory/persistencia:

- Factory usa InMemory en modo memory.
- Factory usa Supabase para materials/topics/imports en modo supabase.
- Questions/tests siguen en InMemory.
- Tests existentes siguen pasando.
- No se expone service role en frontend.

UX:

- Existe un unico CTA principal "Subir material" para alta individual/PDF.
- No quedan botones principales separados "Anadir material" y "Subir PDF" en la misma vista.
- PDF upload sigue funcionando desde el nuevo flujo.

## 27. Documentacion

Actualizar:

```text
docs/architecture/persistence.md
docs/setup/supabase-setup.md
docs/setup/migrations-runbook.md
```

Debe explicar:

- Que `materials` ya esta en Supabase.
- Que `topics` ya esta en Supabase.
- Que import batches/items ya estan en Supabase.
- Que sigue en memoria.
- Como ejecutar la migracion.
- Como usar el tooling/runbook existente.
- Como volver a modo memory.
- Que queda pendiente.
- Si existe un runbook especifico, referenciarlo.

## 28. Tooling/Runbook De Migracion

Claude debe usar el tooling/runbook existente para:

- Crear migracion.
- Validar migracion.
- Crear repositorios Supabase.
- Actualizar factory.
- Anadir tests.
- Actualizar documentacion.
- Verificar que no se migran entidades fuera de alcance.

No crear tooling paralelo salvo que sea estrictamente necesario.

## 29. Estado Esperado Tras Esta Spec

Al terminar:

- Auth real funciona.
- Profiles funcionan en Supabase.
- Workspaces funcionan en Supabase.
- Workspace members funcionan en Supabase.
- Oppositions funcionan en Supabase.
- Opposition access funciona en Supabase.
- Materials funcionan en Supabase.
- Topics funcionan en Supabase.
- Material-topic links funcionan en Supabase.
- Material import batches/items funcionan en Supabase.
- Questions siguen en memoria.
- Tests siguen en memoria.
- Attempts siguen en memoria.

## 30. Futuras Specs Previstas

Despues de esta spec, el orden recomendado sera:

- SPEC 023 - Supabase Repositories: Questions & Options.
- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
- SPEC 025 - Supabase RLS Hardening.
- SPEC 026 - Supabase Edge Functions for Account Deletion.
- SPEC 027 - Beta Readiness.

## 31. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existe migracion para `materials`.
- Existe migracion para `topics`.
- Existe migracion para `material_topic_links`.
- Existe migracion para `material_import_batches`.
- Existe migracion para `material_import_items`.
- Existen repositorios Supabase para estas entidades.
- El factory los usa en modo Supabase.
- El fallback InMemory sigue funcionando.
- PDF upload sigue funcionando.
- ZIP import sigue funcionando.
- AI Syllabus Index Builder puede leer/aplicar topics/materials.
- Student solo ve materiales y temas activos autorizados.
- Owner/admin puede gestionar materiales y temas.
- La UI usa un unico boton principal "Subir material" para alta individual/PDF.
- No se migran questions/tests/attempts.
- La documentacion explica el nuevo estado hibrido.
- Se ha usado el tooling/runbook existente.
- No se expone `SUPABASE_SERVICE_ROLE_KEY`.
- Tests existentes siguen pasando.

## 32. Prompt Para Claude

Claude, implementa la SPEC 022 - Supabase Repositories: Materials & Topics.

Debes continuar la migracion progresiva a Supabase usando el tooling/runbook ya creado:

```text
docs/setup/migrations-runbook.md
```

Migra unicamente:

- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.

No migres todavia:

- `questions`.
- `question_options`.
- Validation results.
- Reviews.
- Review feedback.
- `question_generation_runs`.
- `tests`.
- Attempts.
- Answers.
- Syllabus index proposal tables.

Debes implementar:

1. Migraciones SQL para las tablas indicadas.
2. Repositorios Supabase para materials/topics/links/import batches/import items.
3. Adaptacion del factory de repositorios.
4. Integracion con workspaces/oppositions ya migrados.
5. Compatibilidad con subida PDF.
6. Compatibilidad con ZIP import.
7. Compatibilidad con AI Syllabus Index Builder.
8. Fallback InMemory.
9. Tests criticos.
10. Documentacion del nuevo estado hibrido.
11. Uso del runbook/tooling existente.
12. UX: unificar "Anadir material" y "Subir PDF" en un unico boton "Subir material".

Reglas obligatorias:

- Usa el tooling/runbook existente.
- No crees un proceso paralelo de migracion.
- No hardcodees claves.
- No subas `.env`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- No migres tablas fuera de alcance.
- Manten fallback InMemory.
- No implementes Supabase Storage salvo que ya este preparado y sea imprescindible.
- No generes preguntas automaticamente tras subir material.
- Manten los tests existentes en verde.
- Documenta que queda en Supabase y que sigue en memoria.

Objetivo:

Dejar TESTOPO con oposiciones, materiales y temarios reales persistidos en Supabase, manteniendo preguntas y tests estables para migrarlos en specs posteriores.
