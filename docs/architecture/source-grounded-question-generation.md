# Generación de preguntas anclada a fuentes (SPEC 028-E)

Cierra la serie IA+subida: refuerza el generador de preguntas existente para que
las candidatas se creen desde un **tema aplicado del Topic Map** y **fragmentos de
fuente concretos y trazables** (sección 028-C / referencia 028-C / referencia de
fuente del tema aplicado 028-D), no desde un PDF entero. Cada candidata conserva
material, excerpt, tema y al menos un puntero de fuente. **Sigue siendo revisión
humana: la IA nunca crea una pregunta `validated`.**

## Pipeline

```text
Tema aplicado (028-D) + secciones/fuentes (028-C)
  -> Recuperar fuentes primarias del tema (SourceRetrievalService)
  -> Generar candidatas por fragmento (reusa el provider existente)
  -> Validar la salida + anclaje de fuente
  -> Crear pregunta (con punteros de fuente) + validacion automatica
  -> pending_review / needs_fix  (NUNCA validated)
  -> Revision humana -> validated -> tests de estudiante
```

Reutiliza `QuestionGenerationService`/providers, `QuestionService`,
`QuestionValidationService`, feedback, la cola de revisión y el repo de runs.

## Recuperación de fuentes (`SourceRetrievalService`)

`retrieveForTopic` busca evidencia **primaria** sellada al mismo workspace+
oposición, por prioridad:

1. `TopicSourceReference` del tema aplicado (028-D).
2. Selección manual (secciones/referencias elegidas en la UI).
3. Secciones del material asociado al tema (`topic_material_links`).
4. Match de texto del título del tema en secciones elegibles.

**Primarias** = `syllabus_material`/`legal_text`/`notes_or_summary`/
`index_or_table_of_contents`, material `active`. Se excluyen `irrelevant`/
`not_analyzable`/obsoleto/`needs_review`/`ambiguous` no corregido. Los
`old_exam_or_test` solo aportan **contexto secundario** (estilo/cobertura), nunca
fuente factual ni se copian. **Sin primaria → `QUESTION_GENERATION_NO_SOURCES`** y
no se persiste nada.

## Generación (`SourceGroundedQuestionGenerationService`)

`generateFromTopic({ opposition_id, topic_id, difficulty, count(1..20),
manual_source_selection? })`:
- Verifica tema **activo, de la oposición** (aplicado).
- Acota: `MAX_QUESTION_SOURCE_REFERENCES=20`, `MAX_QUESTION_SOURCE_CHARS=20000`;
  prioriza primarias de mayor confianza; warnings al recortar.
- Por fragmento llama al provider y **etiqueta** cada candidata con los punteros de
  esa fuente. Valida (estructura, una correcta, dificultad, excerpt, anclaje;
  rechaza `validated`). Sin puntero → se descarta.
- Crea la pregunta con `source` + `material_section_id`/`source_reference_id`/
  `topic_source_reference_id` + metadata IA. Corre la **validación automática**:
  pasa → `pending_review`; falla crítico → `needs_fix`. **Nunca `validated`.**
- El run guarda `source_strategy` + `source_reference_ids` + `material_section_ids`.

`prompts/source-grounded-question-generator.md` exige salida estructurada con
fuente y prohíbe conocimiento externo, copiar exámenes y `validated`.

## Persistencia (migración aditiva)

A diferencia de 028-D, el dominio de preguntas **ya está en Supabase** (SPEC 023).
La migración `028_e_source_grounded_question_generation.sql` solo **añade
columnas** (idempotente, sin RLS nueva):
- `questions`: `material_section_id`, `source_reference_id`,
  `topic_source_reference_id` (punteros de trazabilidad; sin FK por forward-compat:
  las refs del índice 028-D son InMemory por ahora).
- `question_generation_runs`: `source_strategy`, `source_reference_ids`,
  `material_section_ids`.

## Permisos

Generan/inspeccionan: `owner`/`admin`/manager autorizado/premium owner. El
**estudiante no** genera, ni ve runs, ni `pending_review`/`needs_fix`, ni excerpts
internos. Los tests de estudiante siguen usando **solo `validated`** (sin cambios).
Guard `requireManageOpposition`; RLS de 023 intacta; aislamiento workspace+
oposición.

## Mapa de código

| Capa | Archivo |
| --- | --- |
| Modelos | `models/question.ts`, `models/questionGenerationRun.ts` (campos nuevos) |
| Recuperación | `service/sourceRetrievalService.ts` |
| Generación | `service/sourceGroundedQuestionGenerationService.ts` + `prompts/source-grounded-question-generator.md` |
| Facade | `platformService.ts` (`previewTopicSources`, `generateQuestionsFromTopic`) |
| Migración | `supabase/migrations/028_e_source_grounded_question_generation.sql` |
| UI | `app/frontend/src/pages/QuestionsPage.tsx` ("Generar desde tema") |
| Tests | `app/backend/tests/sourceGroundedQuestionGeneration.test.ts` |

## Cierre de la serie

028 (subir) → 028-B (clasificar) → 028-C (seccionar/fuentes) → 028-D (índice con
fuente) → **028-E (preguntas con fuente)**. El círculo de ingestión-a-banco queda
completo, siempre con revisión humana y trazabilidad.
