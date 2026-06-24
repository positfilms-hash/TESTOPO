# Estudio interno del material (SPEC 038)

Reset del camino principal del material: ya **no** hace falta un índice de temario
visible, aplicar un índice, Topics ni revisión por tema para preparar el material
de cara a la futura generación de preguntas.

```text
subir material -> extracción nativa o OCR usable -> Estudiar material
  -> bloques + conceptos internos anclados a fuente -> Material estudiado (listo para SPEC 039)
```

El usuario solo entiende: **subir material → dejar que la IA lo estudie → (luego)
generar preguntas**. La organización interna existe pero **no** es un temario
visible obligatorio ni un paso de selección de tema.

## Supersesión y compatibilidad (transición precisa)

- Esta SPEC **supera la dependencia del índice VISIBLE** introducida/retenida en el
  flujo temario→preguntas (las partes de índice público de SPEC 032 y 037, y la
  precondición de índice del smoke de SPEC 035). **No se borran** tablas, rutas,
  propuestas, Topics ni registros de fuente: quedan como datos de
  compatibilidad/historial y siguen funcionando para flujos legacy.
- **SPEC 036** (rehidratación de sesión/workspace) **sigue vigente** y es base.
- **SPEC 035** (secretos solo de servidor / no-mock) **sigue vigente** y es base.
- El nuevo camino primario **no depende** del índice visible ni de un `topic_id`.

## Frontera de servidor

Una sola operación autenticada: `supabase/functions/study-material/index.ts`.

Request (whitelist estricta):

```json
{ "workspace_id": "uuid", "opposition_id": "uuid", "mode": "all_eligible", "force_retry": false }
```

- Rechaza `user_id`, `material_text`, `ocr_text`, `prompt`, `concepts`,
  `image_base64`, `api_key` y campos desconocidos → `MATERIAL_STUDY_ARBITRARY_INPUT_FORBIDDEN`.
- Auth JWT (actor solo del token) + **guarda explícita de gestión**
  (`evaluateManagementAccess`: perfil no eliminado/bloqueado + membership activa
  owner/admin) + scope (oposición↔workspace). Student/revocado/eliminado/fuera de
  scope fallan **antes** del proveedor o de la BD.
- Proveedor (`resolveStudyProvider`, **OpenAI-only**, `OPENAI_API_KEY`). Sin
  proveedor real → **HTTP 501 `MATERIAL_STUDY_PROVIDER_NOT_CONFIGURED`** y **cero
  escrituras** (ni run, ni unidad, ni concepto, ni estado mock).
- Flujo real (solo con proveedor): material elegible → evidencia (secciones
  activas) → OpenAI (salida estructurada) → `validateStudyUnit` (título/resumen,
  material y puntero del scope, excerpt anclado) → persiste run + units → marca el
  material `studied`/`studied_with_warnings`/`study_failed`.

La lógica determinista vive en `_shared/material-study/contract.ts` (testeada en
vitest). El `index.ts` corre en **Deno** y **no** lo ejecuta el suite: OpenAI,
Supabase y la persistencia **solo** se verifican en staging con secretos reales.

## Modelo de datos interno (razón)

Auditoría: `material_sections` (028-C), `source_references` (028-C) y
`document_classifications` (028-B) ya guardan secciones/referencias/clasificación,
**pero no** el ciclo de vida del estudio ni los bloques/conceptos preparados. Por
eso la migración **`035_material_study.sql`** añade lo mínimo (aditiva, idempotente,
RLS de solo gestión, grants de la Data API):

- `material_study_runs`: ciclo de vida agregado por scope (`pending`/`processing`/
  `completed`/`completed_with_warnings`/`failed`), actor, contadores,
  provider/model, warnings/errors.
- `material_study_units`: bloques internos **anclados a fuente** (material + sección
  o referencia + excerpt acotado), título, resumen, importancia, confianza. Nunca
  un bloque sin puntero concreto.
- `material_study_concepts`: conceptos **opcionales** anclados a una unidad (mismo
  scope, puntero concreto). Solo si el proveedor devuelve conceptos válidos.
- `materials.study_status` (aditivo): `not_studied`/`studying`/`studied`/
  `studied_with_warnings`/`study_failed`. Un material es `studied` **solo** tras un
  run completado con unidades usables; OCR con avisos → `studied_with_warnings`. No
  se sobreescribe el texto de extracción/OCR ni se borran runs/units históricos.

## Elegibilidad de material

Solo material del scope que sea legible (`completed`/`completed_ocr`/
`completed_ocr_with_warnings`), no obsoleto, con clasificación efectiva **primaria**
(`syllabus_material`/`legal_text`/`notes_or_summary`/`index_or_table_of_contents`)
y **sin `needs_review`**. Se excluye failed/ocr_failed/not_supported/obsoleto/
irrelevante/no-analizable/ambiguo no corregido. Los exámenes antiguos solo aportan
estilo; nunca son unidad factual. (Misma regla autoritativa que SPEC 037/
`generate-questions`.)

## Aislamiento y permisos

Tablas de estudio = **solo gestión** (owner/admin/manager autorizado/premium owner):
estudiar y listar resúmenes. El **Student no** puede invocar el estudio ni ver
runs/units/conceptos/excerpts, ni inferir datos de otro workspace. RLS por la
oposición (patrón OCR 032). InMemory: estado de estudio determinista en local/demo,
pero la salida mock es **imposible** de presentar como real en Supabase.

## Contrato de la futura generación (SPEC 039)

SPEC 038 **no** crea candidatas ni UI de generación: solo prepara la capa estable
de units/concepts anclados. Las futuras preguntas deberán enlazar a `material_id`,
una sección/referencia o `material_study_unit_id`, source excerpt y explicación, y
**nunca** guardarse sin evidencia ni como `validated`.

## Estado de esta entrega

**Fase 1 (server data layer):** migración + contrato puro (testeado) + Edge Function
honesta + wrapper frontend + docs. **Fase 2 (pendiente):** la UI de Temario/Análisis
con el estado `Estudiar material`/`Material estudiado` (progreso honesto, sin índice
visible ni `topic_id`) y el servicio InMemory de estudio para demo/tests. El retest
real con proveedor (estudio→units) queda para staging (SPEC 035).
