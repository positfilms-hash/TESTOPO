# Clasificación documental e inventario (SPEC 028-B)

Tras subir material (SPEC 028), TESTOPO responde a una única pregunta: **¿qué es
cada archivo?** Cada material importado recibe una clasificación documental y se
genera un **inventario revisable** por admin/owner antes de cualquier paso
posterior (índice de temario o generación de preguntas, que llegan en specs
futuras). La IA/heurística **solo clasifica**; la corrección humana prevalece.

## Pipeline

```text
Subir ZIP/carpeta/PDFs (SPEC 028)
  -> Extraer texto
  -> Clasificar cada documento (run + classification por material)
  -> Inventario agrupado (admin revisa)
  -> Corrección humana (prevalece sobre la IA)
  -> Documentos clasificados, listos para 028-C (índice) y posteriores
```

No genera índice ni preguntas. Sin OCR/RAG/embeddings.

## Clases documentales

`syllabus_material` · `old_exam_or_test` · `legal_text` · `notes_or_summary` ·
`index_or_table_of_contents` · `irrelevant` · `not_analyzable` · `ambiguous`
(etiquetas visibles en `DOCUMENT_CLASS_LABELS`).

## Modelos y datos

- **`DocumentUnderstandingRun`** — una ejecución de clasificación por lote
  (`batch_id`), con contadores (`classified`/`needs_review`/`not_analyzable`),
  proveedor/modelo, warnings/errors.
- **`DocumentClassification`** — clasificación por material: `classification`,
  `confidence`, `reason`, `detected_title`/`detected_question_count`,
  `needs_review`, `manually_corrected`/`corrected_by`/`corrected_at`.
- Migración `supabase/migrations/028_b_document_classification_inventory.sql`:
  tablas `document_understanding_runs` + `document_classifications`, índices y
  **RLS de solo gestión** (`can_manage_workspace`); el alumno **no accede**.
- Fallback InMemory para tests/demo; persistencia real vía
  `createCoreRepositories` (`documentRuns`/`documentClassifications`).

## Proveedor de clasificación

Arquitectura igual que el índice IA (SPEC 019):

- **`HeuristicDocumentClassifier`** — determinista, sin red: nombre/ruta + señales
  del texto (opciones A/B/C/D → test; "ley/decreto/artículo" → legal; "tema N" +
  desarrollo → temario; "resumen/esquema" → apuntes; lista de temas corta →
  índice; sin texto → no analizable; sin señales → dudoso). Es el **default**, el
  **fallback** sin IA y el **mock de tests**.
- **`OpenAiDocumentClassifier`** — real (`AI_PROVIDER=openai` + `OPENAI_API_KEY`),
  salida JSON estructurada según `prompts/document-classifier.md`.
- **`createDocumentClassificationProvider(env)`** elige uno u otro.

## Reglas de confianza y estado (SPEC 028-B §11/§12)

- `confidence < 0.75` (configurable por `DOCUMENT_CLASSIFICATION_CONFIDENCE_THRESHOLD`)
  o clase ∈ {`not_analyzable`, `ambiguous`, `irrelevant`} → `needs_review = true`.
- `material.status`: documento claro y útil → `active`; dudoso/no analizable/
  irrelevante → `needs_review`. **Nunca** `obsolete` automático.

## Corrección humana

El admin/owner puede reclasificar cualquier documento (`correctDocumentClassification`).
La corrección marca `manually_corrected=true`, `corrected_by`, `corrected_at`,
pone `needs_review=false` y recalcula `material.status`. **Prevalece** sobre la IA.

## Visibilidad del alumno (cierra el riesgo de SPEC 028, §17.1)

`PlatformService.listMaterials`/`getMaterial` ocultan al alumno, además del filtro
por tipo (SPEC 028), los materiales cuya **clasificación vigente** es interna:
`old_exam_or_test`, `irrelevant`, `not_analyzable`, `ambiguous`
(`STUDENT_HIDDEN_CLASSES`). El alumno nunca ve runs, clasificaciones, razones,
warnings ni el inventario.

## Permisos

Ven/corrigen inventario: `owner`, `admin`, manager autorizado, premium owner en
workspace personal. No: `student`, sin acceso, eliminado. Guard
`requireManageOpposition` en cada método del facade; RLS de solo gestión como
defensa adicional.

## Relación con specs futuras

- **028-C (índice IA desde documentos clasificados)**: el índice solo usará
  `syllabus_material`/`legal_text`/`notes_or_summary`/`index_or_table_of_contents`;
  nunca `old_exam_or_test`/`irrelevant`/`not_analyzable`/`ambiguous` como fuente
  principal.
- **Generación de preguntas**: no se generará desde `not_analyzable`/`irrelevant`/
  `ambiguous` sin revisión humana.

## Mapa de código

| Capa | Archivo |
| --- | --- |
| Modelos | `app/backend/src/models/documentClassification.ts` |
| Proveedor | `app/backend/src/classification/*` + `prompts/document-classifier.md` |
| Servicio | `app/backend/src/service/documentClassificationService.ts` |
| Repos | `app/backend/src/repository/{inMemory,supabase}DocumentClassification*` |
| Facade | `app/backend/src/service/platformService.ts` (`classifyImportBatch`, `getDocumentInventory`, `correctDocumentClassification`) |
| Migración | `supabase/migrations/028_b_document_classification_inventory.sql` |
| UI | `app/frontend/src/pages/DocumentInventory.tsx`, `MaterialPage.tsx` (`SmartUploadForm`) |
| Tests | `app/backend/tests/documentClassification.test.ts` |
