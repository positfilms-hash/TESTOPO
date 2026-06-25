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
- **Presupuesto GLOBAL por run** (`resolveStudyLimits`, no por material): máximo de
  materiales, caracteres totales, unidades totales, concurrencia (secuencial) y
  timeout por llamada. El presupuesto de caracteres/unidades se consume de forma
  **acumulativa** entre materiales (no se reinicia) y el run se detiene al agotarlo;
  nunca se lanzan llamadas sin límite. Un secreto solo puede ENDURECER el tope.
- **Anclaje por puntero**: el `source_excerpt` se valida contra el texto de la
  `material_section`/`source_reference` CONCRETA citada por la unidad, **nunca**
  contra la concatenación de todas las secciones del material.
- **Estado honesto en TODOS los caminos**: secciones vacías, fallo/timeout del
  proveedor, parse inválido o error de persistencia con 0 unidades → `study_failed`;
  con unidades y avisos OCR → `studied_with_warnings`; limpio → `studied`.
- `force_retry`: sin reintento se SALTAN los materiales ya estudiados; con reintento
  se reestudian todos (siempre un run nuevo; nunca se borra historial).

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

### Sección/fuente canónica desde `content_text` (fix staging)

Un material **legible** (`completed`) puede no tener `material_sections` (la
sección 028-C nunca corrió) pero **sí** tener el texto extraído en
`materials.content_text` (`active_sections=0` pero `content_text` no vacío). Antes la
Edge Function solo leía `material_sections`, así que la auto-clasificación recibía
**vacío** y el material caía en `NO_ELIGIBLE_MATERIAL`.

Ahora, **antes** de clasificar/estudiar, la función comprueba si cada material
legible tiene secciones activas; si no, lee **exclusivamente en servidor**
`materials.content_text` y crea internamente una **sección canónica** trazable
(`resolveCanonicalSection`: una `material_section` `study_content` con el texto del
documento). La clasificación y el estudio operan sobre esa sección, y las **unidades
quedan ancladas a ella** (`material_section_id`), de modo que SPEC 039 genera
preguntas con evidencia concreta. **Nunca** usa texto enviado por el frontend.

- Si `content_text` falta pese a `completed` (ni secciones ni texto) → motivo honesto
  y específico `material_completed_without_text` (no se estudia).
- Errores de **lectura/escritura** de la sección canónica o de la clasificación **no
  se silencian**: la función devuelve un bloqueo trazable
  `MATERIAL_STUDY_PREP_FAILED` (502).

### Troceado en bloques + fallback determinista (fix staging)

Una sección grande (p. ej. un BOE de ~163k caracteres) **no** se envía entera como
una sola fuente al modelo (eso provocaba `NO_VALID_UNITS`: el modelo no echaba bien
el `material_section_id` o el `source_excerpt`). La Edge Function **trocea** cada
sección en **bloques manejables** (`chunkSectionText`, por encabezados legales/
estructurales —Artículo/Título/Capítulo/Sección/Disposición/Anexo— y por tamaño,
`MAX_STUDY_CHUNK_CHARS`), respetando el presupuesto global y `MAX_STUDY_BLOCKS_PER_MATERIAL`.
Cada bloque conserva su `material_section_id` **real** (subreferencia trazable). El
prompt **fuerza** citar un `material_section_id` exacto y un `source_excerpt`
**copiado literalmente** del bloque.

Si el proveedor no devuelve unidades válidas, se aplica un **fallback determinista
seguro** (`buildFallbackStudyUnits`): crea bloques de estudio desde los chunks con un
`source_excerpt` **real** (texto literal del material, anclado a la sección). **No es
un mock**: es estructuración determinista del texto real, no contenido inventado;
garantiza unidades cuando hay texto. Las unidades quedan ancladas a la sección
concreta (evidencia para SPEC 039).

Cuando no se crean unidades, la respuesta `NO_VALID_UNITS` incluye `warnings` y
`errors` internos para QA (sin secretos ni texto): p. ej. `provider_parse_failed`,
`provider_units_rejected=N`, `provider_zero_valid_units`, `deterministic_fallback_used`,
`unit_persist_failed`.

### Autosuficiencia: clasificación interna (fix staging)

"Estudiar material" **no depende** de que el usuario haya ejecutado antes
"Analizar material" ni un índice/temario. Si un material **legible** no tiene
`document_classifications`, la Edge Function lo clasifica **internamente** con la
heurística determinista `classifyStudyDocument` (señales de texto/nombre; **no es un
mock de IA**) usando el texto recuperado **en servidor** de sus secciones (incluida la
sección canónica anterior), y **persiste** una fila `document_classifications`
trazable (run interno `document_understanding_runs` provider `heuristic`). Se respetan
las clasificaciones existentes (manuales o previas). **Fail-closed:** si la heurística
no produce una clase primaria con confianza (`confidence ≥ 0.75` y clase no
ambigua/irrelevante/no-analizable), el material **no** se estudia.

Cuando un material legible no resulta elegible, la respuesta incluye `ineligible`
con el **motivo exacto** por material (`material_obsolete`, `material_not_readable`,
`classification_unresolved`, `classification_needs_review`,
`classification_not_primary`, `material_completed_without_text`) para que la UI lo
explique. El filtro del frontend
(`StudyMaterialPanel`) usa el mismo conjunto de extracción legible que el servidor
(`USABLE_EXTRACTION_STATUSES` = `STUDY_READABLE_EXTRACTION`) y muestra esos motivos:
ya no puede mostrar "1 documento listo" y recibir `NO_ELIGIBLE_MATERIAL` sin
explicación.

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

## UI: Temario / Análisis (fase 2)

El contenido **primario** de Temario/Análisis pasa a ser **`Estudiar material`**
(`StudyMaterialPanel`), sin índice visible obligatorio, sin aplicar índice, sin
revisión por tema ni selección de `topic_id`. Estados (progreso honesto, sin
porcentajes):

| Estado | UX |
| --- | --- |
| Sin material | Explica subir material; enlace a Material. |
| Leyéndose/OCR | Explica que el material debe terminar de leerse antes de estudiarlo. |
| Listo | `Estudiar material` + recuento de documentos legibles. |
| Estudiando | `La IA está estudiando tus documentos…` + pasos gruesos (revisar elegibles · leer texto · preparar bloques · guardar). |
| Estudiado | `Material estudiado` + recuentos seguros (documentos, bloques, avisos). |
| Fallido | Error seguro reintentable; sin completado falso. |

En modo **Supabase** el botón llama a la Edge Function `study-material`
(`serverStudyMaterial`); en **InMemory/demo** produce un resumen **local
determinista** (nunca presentable como real en Supabase). La pantalla Temario/
Análisis es la ruta **Material → Estudiar material → Generar preguntas**
(`StudyMaterialPanel` + `GenerateFromStudiedMaterialPanel`, SPEC 039). El **índice/
temario público** (propuestas, Topic Map, "Aplicar índice", "Añadir tema") queda
**fuera del flujo normal**: los Topics/propuestas legacy siguen existiendo en el
dominio para compatibilidad/historial, pero **ya no se exponen** en esta ruta ni son
requisito para estudiar o generar preguntas. El Student no ve esta pantalla.

## Estado de esta entrega

**Fase 1 + 2 entregadas**: migración + contrato puro (testeado) + Edge Function
honesta + wrapper + **UI `Estudiar material`** (Temario reusado, índice clásico
secundario) + fallback InMemory determinista + docs. **Pendiente solo de staging**
(operador): secretos del proveedor + `functions deploy study-material` + aplicar la
migración 035 + retest real (estudio→units). No se afirma éxito del proveedor sin
ese retest. Smoke visual cuando el operador valide en staging.
