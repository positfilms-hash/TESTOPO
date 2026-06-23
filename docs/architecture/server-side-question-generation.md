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
4. **Proveedor**: lee `AI_PROVIDER` / `OPENAI_API_KEY` / `OPENAI_MODEL` de los
   **secretos de la Edge Function**. Sin proveedor real → **HTTP 501**
   `QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED` y **cero escrituras**.
5. **Integración real (punto marcado en el código)**: recuperación de evidencia
   concreta desde Supabase → construir `EvidenceScope` → llamar al proveedor con el
   prompt de `prompts/server-side-source-grounded-question-generator.md` →
   `validateCandidate` por salida → persistir run + questions + options +
   validation_results → resumen seguro.

> **Estado actual = scaffold honesto** (mismo enfoque que `ocr-material`): pasos
> 1–4 implementados; el paso 5 (recuperación real + proveedor + persistencia) está
> claramente marcado y se cablea cuando haya secretos de servidor. Mientras tanto,
> el comportamiento vivo es el 501 honesto, sin persistir nada.

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

## Despliegue

Ver [`../security/ai-provider-secrets.md`](../security/ai-provider-secrets.md) para
el secret boundary y los comandos exactos de despliegue/secretos.
