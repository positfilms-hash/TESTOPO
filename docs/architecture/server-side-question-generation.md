# Generación de preguntas en servidor (SPEC 033)

La generación de preguntas **anclada a fuentes** (SPEC 028-E/F) deja de ejecutarse
en el navegador cuando la app corre en modo Supabase: pasa a una **Edge Function
autenticada** (`supabase/functions/generate-questions`). El navegador solo pide la
generación con IDs y parámetros; nunca aporta texto/fuente, ni llama al proveedor,
ni guarda claves privadas o `service_role`.

Esto cierra el bloqueante de la revisión de Codex: sin proveedor real configurado,
la generación se bloquea de forma **honesta** y no crea candidatas mock (ver
[`../qa/staging-retest-033-035-precheck.md`](../qa/staging-retest-033-035-precheck.md)).

## Dónde corre cada cosa

| Modo | Recuperación + proveedor + persistencia | Notas |
| --- | --- | --- |
| **Supabase** (`VITE_APP_PERSISTENCE_MODE=supabase` configurado) | Edge Function `generate-questions` (servidor) | El front llama `supabase.functions.invoke('generate-questions', { body })`. La clave del proveedor es secreto de servidor. |
| **Memoria / demo** (sin Supabase) | `SourceGroundedQuestionGenerationService` en proceso | Igual que 028-E/F. El proveedor mock está **bloqueado** como IA real (`allowMockProvider: false` solo cuando hay `supabasePort`; en demo se permite). |

La lógica **canónica** de validación (forma del body, validación de salida,
elegibilidad, límites, mapeo de estados) vive en un único módulo puro compartido:

```
supabase/functions/_shared/question-generation/contract.ts
```

Lo consumen **a la vez** la Edge Function (Deno) y los tests de vitest del backend
(`app/backend/tests/serverQuestionGenerationContract.test.ts`), de modo que no hay
duplicación de reglas. El frontend (`app/frontend/src/generation/serverQuestionGeneration.ts`)
reutiliza el mismo contrato para construir/validar el body y mapear códigos de
error a mensajes seguros.

## Contrato HTTP

`POST` autenticado (con `verify_jwt`; la función revalida con `auth.getUser()`).

Request (whitelist estricta; cualquier otro campo se rechaza):

```json
{
  "workspace_id": "uuid",
  "opposition_id": "uuid",
  "topic_id": "uuid",
  "difficulty": "easy | medium | hard",
  "question_count": 1,
  "source_mode": "topic_sources | manual_source_selection",
  "selected_source_reference_ids": ["uuid"],
  "selected_material_section_ids": ["uuid"]
}
```

- `question_count`: entero 1–20.
- Se rechaza con `QUESTION_GENERATION_ARBITRARY_TEXT_FORBIDDEN` cualquier body con
  `user_id`, `source_text`, `raw_text`, `manual_context`, `custom_prompt`,
  `prompt`, `context`, `system_prompt`, `messages` o campos desconocidos.

Response (resumen seguro): `{ "run_id": string|null, "created": number, "requested": number, "warnings": string[] }`.
Nunca se devuelven prompts, excerpts completos, errores del proveedor ni secretos.

## Flujo de la Edge Function

1. **Auth**: deriva el actor SOLO del JWT verificado (`auth.getUser()`); nunca del
   body. Todas las lecturas/escrituras van con el cliente del usuario (RLS).
2. **Body**: `validateGenerateRequest` (whitelist + rangos + rechazo de texto
   arbitrario).
3. **Scope**: el tema existe, pertenece a la oposición y no está obsoleto; la
   oposición pertenece al `workspace_id` declarado. La autorización autoritativa de
   escritura la garantiza además la RLS de `questions` (`questions_manage` →
   `can_manage_workspace`).
3b. **Guarda explícita de gestión (no solo RLS)**: además de la RLS, la función
   consulta `profiles` (no eliminado/bloqueado) y `workspace_members` (membership
   `active` con rol `owner`/`admin`) y evalúa `evaluateManagementAccess`
   (`_shared/authz/management.ts`). Student, usuario eliminado/revocado o fuera de
   scope fallan **aquí**, antes del proveedor o de cualquier escritura.
4. **Proveedor**: `resolveProvider` lee `AI_PROVIDER` / `OPENAI_API_KEY` /
   `OPENAI_MODEL` de los **secretos de la Edge Function**. **Solo OpenAI** está
   soportado de verdad (usa `OPENAI_API_KEY`); Anthropic **no** se declara como
   proveedor soportado por esta función (no se promete un proveedor con la clave de
   otro). Sin proveedor real → **HTTP 501**
   `QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED` y **cero escrituras**.
5. **Flujo real (implementado)**: recuperación de evidencia concreta desde Supabase
   (`topic_source_references` → secciones elegibles enlazadas) → `buildOpenAIRequest`
   (salida estructurada `json_schema`) → `fetch` a OpenAI → `parseProviderCandidates`
   → `validateCandidate` por salida (ancla a la evidencia; rechaza `validated`) →
   `buildQuestionRow`/`buildOptionRows`/`buildValidationRow` → persistir run +
   questions + options + validation_results (cliente del usuario, RLS `can_manage`)
   → resumen seguro.

> **Estado de verificación (honesto).** La lógica determinista (validación de body,
> autorización explícita, elegibilidad, construcción de petición, parseo y filas de
> persistencia) vive en `_shared/*` y está **cubierta por vitest**
> (`serverQuestionGenerationContract.test.ts`, `serverGroundedFlowContract.test.ts`).
> El `index.ts` corre en **Deno** y **no** lo ejecuta ningún test de este repo: la
> llamada real a OpenAI, las consultas a Supabase y la persistencia **solo** se
> pueden verificar en **staging con secretos reales**. No se afirma que la
> integración real funcione sin ese retest.

## Persistencia y trazabilidad

Reutiliza las entidades existentes (SPEC 023 + columnas 028-E). Sin migración nueva:

- `question_generation_runs`: actor/scope vía RLS, `provider`/`model`,
  `requested_count`/`created_count`, `source_strategy`, `source_reference_ids`,
  `material_section_ids`. Estado mediante `mapRunStatus()` →
  `completed`/`partial`/`failed` (los estados de ciclo de vida de SPEC 033 —
  `pending`/`processing`/`completed_with_warnings` — se mapean a esos valores para
  no tocar el CHECK de 023).
- `questions`: `generated_by_ai`/metadata presentes, `topic_id`, `material_id`
  (en `source` jsonb), `source_excerpt` anclado y al menos un puntero concreto
  (`material_section_id` / `source_reference_id` / `topic_source_reference_id`).
- `question_options` + `question_validation_results`: validación automática tras
  guardar.

**Reglas duras**: una candidata sin evidencia válida no se guarda; el estado final
es solo `pending_review` (sin hallazgo crítico) o `needs_fix` (con
warnings/reparación). **Nunca `validated`**: solo la revisión humana valida.

## Aislamiento del alumno

Alumnos, usuarios borrados/revocados y sin acceso no pueden invocar la función
(RLS + checks de scope), ni listar runs, ni ver candidatas `pending_review`/
`needs_fix`, ni excerpts internos. Los tests de estudiante siguen usando solo
preguntas `validated`. Nada de OCR, Auth, RLS, embeddings, RAG ni fine-tuning se
modifica aquí.

## Flujo Material → Temario → Preguntas (y limitación de SPEC 032)

El producto encadena tres pasos con revisión humana obligatoria:

1. **Material**: subir/abrir/revisar/eliminar archivos. El material legible
   (`extraction_status = completed`, o `completed_ocr`/`completed_ocr_with_warnings`
   vía SPEC 030/034) habilita proponer índice.
2. **Temario**: `Generar temario` (SPEC 032) analiza el material elegible y propone
   un índice de temas/subtemas **revisable**. **Nunca** escribe temario completo,
   preguntas ni tests, y **no aplica** nada sin un clic humano explícito.
3. **Preguntas**: la generación anclada a fuentes (esta función) exige un **tema
   aplicado** (`topics.status = 'active'`) y **fuentes reales** del scope; si no las
   hay, falla honestamente sin escribir.

> **Limitación documentada (no se arregla aquí).** El índice de SPEC 032 usa un
> proveedor **mock/heurístico** (`compressed-text`) en proceso, no IA real. **No
> debe presentarse como "IA real" en staging/producción.** Esta tarea **no** amplía
> el alcance para sustituirlo por un generador de índice en servidor; solo deja
> constancia de la limitación. Mientras tanto, la propuesta de índice sigue
> requiriendo revisión y aplicación humana antes de poder generar preguntas, así que
> ninguna pregunta se ancla a un índice aplicado automáticamente sin intervención.

## Despliegue

Ver [`../security/ai-provider-secrets.md`](../security/ai-provider-secrets.md) para
el secret boundary y los comandos exactos de despliegue/secretos.
