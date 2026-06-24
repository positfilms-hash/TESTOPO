# Generación directa de preguntas desde material estudiado (SPEC 039)

Flujo PRINCIPAL de generación de preguntas. Parte del **material estudiado**
internamente (SPEC 038) y NO depende de un índice visible, de aplicar un temario
ni de un `topic_id`.

```text
subir material -> extracción/OCR usable -> Estudiar material (SPEC 038)
  -> unidades/conceptos/referencias internas trazables
  -> Generar preguntas desde material estudiado (SPEC 039)
  -> candidatas pending_review / needs_fix -> revisión humana
```

El usuario gestor entiende: **subir → estudiar → generar preguntas → revisar**.
El alumno no ve generación, runs, fuentes internas ni candidatas.

## Camino independiente (no toca el flujo por tema)

SPEC 039 es un camino **separado**: ni la Edge Function ni el contrato importan o
invocan `generate-questions` (flujo por tema, SPEC 033). La generación histórica
por tema puede permanecer por compatibilidad, pero deja de ser el flujo principal
y **no** bloquea ni alimenta el nuevo. Las garantías de seguridad de SPEC 033/034/
035/036 (secretos solo en servidor, guarda explícita de gestión, no-mock,
rehidratación) **siguen vigentes**.

## Frontera de servidor

Una sola operación autenticada:
`supabase/functions/generate-questions-from-studied-material/index.ts`.

Request (whitelist estricta — solo IDs de alcance y parámetros):

```json
{
  "workspace_id": "uuid",
  "opposition_id": "uuid",
  "material_study_run_id": "uuid opcional",
  "scope": "all_studied_material | selected_materials | selected_units | selected_concepts",
  "material_ids": ["uuid"],
  "material_study_unit_ids": ["uuid"],
  "material_study_concept_ids": ["uuid"],
  "question_count": 5,
  "difficulty": "easy | medium | hard | mixed"
}
```

- Rechaza `user_id`, `source_text`, `raw_text`, `ocr_text`, `excerpt`,
  `source_excerpt`, `prompt`, `custom_prompt`, `messages`, `api_key`,
  `image_base64`, `correct_answer`, `options`, `statement` y campos desconocidos →
  `DIRECT_QG_ARBITRARY_INPUT_FORBIDDEN`.
- Los arrays solo son válidos para su `scope` (`isSelectionCoherent`) y tienen
  límites pequeños; se validan contra datos existentes en servidor.
- Auth JWT (actor solo del token) + **guarda explícita de gestión**
  (`evaluateManagementAccess`: perfil no eliminado/bloqueado + membership activa
  owner/admin) + scope (oposición↔workspace). Student/revocado/eliminado/fuera de
  scope fallan **antes** del proveedor o de la BD.
- Exige un **estudio listo**: el `material_study_run_id` indicado (o el run más
  reciente de la oposición) debe estar `completed`/`completed_with_warnings`. Sin
  estudio → `DIRECT_QG_STUDY_NOT_READY` (409).
- Resuelve evidencia **exclusivamente** desde `material_study_units` (y
  `material_study_concepts` cuando el alcance es de conceptos) del run, con su
  material legible y del scope (`isUsableStudiedMaterial`: no obsoleto, no
  failed/ocr_failed). Exámenes/preguntas antiguas **no** son fuente factual.
- Sin evidencia utilizable → `DIRECT_QG_NO_EVIDENCE` (422), cero escrituras.
- Proveedor (`resolveProvider`, **OpenAI-only**). Sin proveedor real → **HTTP 501
  `DIRECT_QG_PROVIDER_NOT_CONFIGURED`** y **cero escrituras** (ni run, ni pregunta,
  ni opción, ni validación).

La lógica determinista vive en
`supabase/functions/_shared/direct-question-generation/contract.ts` (testeada en
vitest). El `index.ts` corre en **Deno** y **no** lo ejecuta el suite: OpenAI,
Supabase y la persistencia **solo** se verifican en staging con secretos reales.

## Anclaje por puntero (no a una bolsa global)

Cada candidata cita el `material_study_unit_id` **exacto** que la sustenta.
`validateDirectCandidate` ancla el `source_excerpt` contra el texto de **esa
unidad concreta**, nunca contra la concatenación de todas las unidades (lección de
SPEC 038 P0). Si la IA inventa una cita no contenida, se sustituye por el texto de
la unidad y la candidata pasa a `needs_fix`. El material/sección/referencia que
declare la IA deben coincidir con el puntero real de la unidad o la candidata se
descarta.

## Persistencia y trazabilidad

Reutiliza el esquema de preguntas (SPEC 023/028-E). La migración aditiva
`036_direct_question_generation.sql` añade los enlaces mínimos:

- `questions.material_study_run_id`, `questions.material_study_unit_id`,
  `questions.material_study_concept_id` (FKs `on delete set null`).
  `material_section_id`/`source_reference_id` ya existían (028-E).
- `question_generation_runs.material_study_run_id` (enlace al estudio origen).

Cada candidata persistida tiene: enunciado, opciones (exactamente una correcta),
explicación, dificultad (`easy|medium|hard`), `material_id` (en `source`), puntero
concreto a unidad estudiada (+ sección/referencia/concepto cuando aplique),
extracto **coherente con ese puntero**, y metadatos de run/proveedor.

`topic_id` queda **NULL**; la columna `topic` lleva una **etiqueta descriptiva**
derivada del título de la unidad (compatibilidad con controles históricos sin
exigir tema). Estado exclusivo: `pending_review` o `needs_fix`. **Ninguna ruta**
escribe `validated`, publica preguntas ni crea un test. El generador de tests
sigue usando **solo** preguntas validadas por humanos.

El ciclo de vida del run (`runDirectGeneration`) crea el run **antes** de cualquier
candidata; si el proveedor/parsing/persistencia falla, el run queda
`failed`/`partial` y nunca hay candidatas huérfanas; `created` cuenta solo
candidatas completamente persistidas.

## Frontend

En Temario/Análisis, tras el estudio, el panel `GenerateFromStudiedMaterialPanel`
ofrece **Generar preguntas** (alcance: todo el material estudiado o un documento;
cantidad; dificultad), progreso honesto, bloqueos comprensibles y un resumen con
enlace a revisión. En modo Supabase invoca la Edge Function
(`serverDirectQuestionGeneration`); en **InMemory/demo** NO se aparenta generación
real: avisa de que el flujo directo vive en servidor (fallback explícito de
desarrollo). El alumno no ve este panel.

## Fuera de alcance

Embeddings/RAG/fine-tuning, métricas avanzadas, generación automática de tests,
OCR/clasificación/estudio (otras SPEC), cambios grandes de Auth/RLS.

## Estado de esta entrega

Edge Function honesta + contrato puro (testeado) + migración aditiva + wrapper +
UI + docs. **Pendiente solo de staging** (operador): secretos del proveedor +
`functions deploy generate-questions-from-studied-material` + aplicar la migración
036 + retest real (estudio → generación → candidatas). No se afirma éxito del
proveedor sin ese retest. Smoke visual cuando el operador valide en staging.
