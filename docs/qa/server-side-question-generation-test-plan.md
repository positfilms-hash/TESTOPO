# Plan de pruebas: generación de preguntas en servidor (SPEC 033)

Cubre la Edge Function `generate-questions` y su integración. Los tests
automáticos **no usan red ni proveedor real**: validan la lógica canónica del
contrato compartido y el wrapper del frontend.

## Tests automáticos (vitest)

### Contrato compartido — `app/backend/tests/serverQuestionGenerationContract.test.ts`

Importa el mismo módulo que la Edge Function
(`supabase/functions/_shared/question-generation/contract.ts`).

- **Body válido**: acepta solo IDs/parámetros; `source_mode` por defecto
  `topic_sources`; arrays vacíos por defecto.
- **Texto arbitrario prohibido**: rechaza `user_id`, `source_text`, `raw_text`,
  `manual_context`, `custom_prompt`, `prompt` y campos desconocidos con
  `QUESTION_GENERATION_ARBITRARY_TEXT_FORBIDDEN`.
- **Scope obligatorio**: exige `workspace_id`/`opposition_id`/`topic_id`.
- **Parámetros acotados**: rechaza dificultad inválida y `question_count` fuera de
  1–20 o no entero; rechaza IDs manuales mal formados.
- **Elegibilidad**: `isEligiblePrimaryClass` acepta solo
  `syllabus_material`/`legal_text`/`notes_or_summary`/`index_or_table_of_contents`
  y rechaza `old_exam_or_test`/`not_analyzable`/`ambiguous`/`irrelevant`/`needs_review`.
- **Validación de salida**: rechaza estructura incompleta, < 2 opciones, ≠ 1
  correcta, dificultad inválida, tema que no coincide, material/sección/referencia
  ajenos, ausencia de puntero concreto y la regla dura `status: validated`.
- **Anclaje de excerpt**: una cita inventada se sustituye por la evidencia y
  genera warning ⇒ candidata `needs_fix`.
- **Estados**: `candidateStatus` nunca devuelve `validated`; `mapRunStatus` mapea a
  `completed`/`partial`/`failed`.

### Wrapper del frontend — `app/frontend/tests/serverQuestionGeneration.test.ts`

- El body construido contiene **solo** campos permitidos (sin texto/fuente/prompt).
- Mapea códigos de error a mensajes seguros (incluido el 501 sin proveedor).
- No invoca la función si el body no pasa la validación del contrato.

### Regresión

- Suite de backend (`app/backend`: vitest) y de frontend (`app/frontend`: vitest)
  verde, incluido `sourceGroundedQuestionGeneration.test.ts` (camino InMemory) y
  los tests de OCR/Auth/RLS sin cambios.

## Verificación manual en staging (cuando haya secretos)

> Hasta que se configuren los secretos del proveedor, el comportamiento vivo es el
> **501 honesto** sin escrituras. No se debe afirmar que la integración real
> funciona sin un retest de staging con secretos.

1. **Sin proveedor**: invocar generación desde *Generar desde tema* ⇒ mensaje
   «La generación de preguntas todavía no está configurada en servidor.»; sin run,
   sin candidata, sin texto mock (comprobar por API autenticada: 0 filas nuevas).
2. **Alumno**: un usuario `student` no puede invocar la función ni ver candidatas
   `pending_review`/`needs_fix` ni runs.
3. **Cross-scope**: `topic_id` de otra oposición/workspace ⇒ `TOPIC_NOT_FOUND` /
   `*_MISMATCH`; sin escrituras.
4. **Con proveedor** (tras `supabase secrets set` + deploy): generar para un tema
   aplicado con evidencia ⇒ candidatas `pending_review`/`needs_fix` trazables
   (material, excerpt, sección/referencia), nunca `validated`; aparecen en la cola
   de revisión existente.
5. **No-filtración**: `grep` de claves de proveedor / `service_role` en el bundle
   del front = 0; la respuesta no contiene prompts ni excerpts completos.

## Smoke visual

Runbook de Codex (`docs/qa/codex-visual-review-runbook.md`) a `1366x900` y
`390x844`: pantalla *Generar desde tema* con estado de carga, mensaje de
no-proveedor y enlace a la cola de revisión. Sin internals ni secretos a la vista.
