# Flujo material → temario → preguntas (SPEC 037)

```text
PDF nativo legible / OCR usable
  -> propuesta de índice compacta (bloques de estudio)
  -> una aplicación humana global ("Aplicar índice completo")
  -> Topics activos con fuentes reales del scope
  -> candidatas de pregunta ancladas a fuente (servidor)
```

El temario es un **índice de bloques de estudio**, no una transcripción del PDF ni
un mapa artículo por artículo.

## Diagnóstico del desajuste de fuentes (P0 observado)

Síntoma en staging:

```text
Questions UI: "2 fuentes disponibles"
generate-questions: "Este tema no tiene fuentes elegibles"
```

**Causa raíz:** la readiness visible y la elegibilidad autoritativa del servidor
usaban **reglas distintas** sobre la misma evidencia.

- La UI muestra `sourceCount` desde `previewTopicSources` →
  `SourceRetrievalService.isEligibleMaterial`, que solo exigía: material `active`,
  misma oposición y **clasificación primaria** (`syllabus_material`/`legal_text`/
  `notes_or_summary`/`index_or_table_of_contents`).
- El servidor (`generate-questions` → `evaluateTopicSourceReference`, SPEC 033 P0)
  exige, **además**:
  1. la clasificación efectiva **no** está `needs_review`;
  2. el material es **legible** (`extraction_status` ∉ {`failed`, `ocr_failed`,
     `not_supported`});
  3. existe un **puntero concreto válido** (una sección **activa** del mismo
     material, o una `source_reference`).

Por tanto, una `topic_source_reference` con clasificación pendiente de revisión, o
material no leído, o sin sección activa/referencia, **se contaba** en la UI pero el
servidor la **rechazaba** → el contador positivo no implicaba evidencia usable.

## Reparación (mínima y coherente)

`SourceRetrievalService.isEligibleMaterial` + `addSource` ahora replican
**exactamente** la regla autoritativa del servidor (mismo origen de verdad de
elegibilidad):

- rechaza clasificación `needs_review`;
- rechaza material no legible (`failed`/`ocr_failed`/`not_supported`) y obsoleto
  (acepta `completed`, `completed_ocr`, `completed_ocr_with_warnings`; el último
  queda `needs_review` de material, que **sí** es elegible);
- exige puntero concreto válido (sección activa del mismo material, o referencia);
  un row "vinculado pero no usable" **ya no cuenta**.

Resultado: **la readiness visible no puede contradecir la elegibilidad del Edge**.
No se ha relajado la guarda del servidor ni se acepta evidencia del navegador.

### Mensajes seguros (español, orientados a la acción)

`generate-questions` (vía `serverQuestionGeneration.ts`) devuelve:

| Condición | Mensaje |
| --- | --- |
| Sin fuente elegible | `Este tema no tiene fuentes asociadas y utilizables. Regenera o reaplica el temario para vincularlo al material.` |
| Tema no aplicado | `Este tema todavía no está aplicado. Aplica el índice antes de generar preguntas.` |
| Proveedor ausente | `La generación de preguntas todavía no está configurada en servidor.` |
| Acceso denegado | `No tienes permisos para generar preguntas en esta oposición.` |
| Otro fallo seguro | `No se pudieron generar preguntas. Revisa que el tema tenga fuentes válidas e inténtalo de nuevo.` |

Nunca se exponen prompts, excerpts completos, errores del proveedor, URLs firmadas,
secretos ni detalles internos.

## Garantías que se conservan

- El navegador llama **solo** a la Edge Function autenticada con IDs/parámetros;
  nunca texto de fuente, prompts, `user_id`, imágenes ni claves.
- Las candidatas quedan **solo** `pending_review`/`needs_fix`, nunca `validated`.
- Límites de workspace/oposición, aislamiento de Student, material privado, RLS y
  fallback InMemory intactos.

## Verificación

- `app/backend/tests/sourceReadinessEligibility.test.ts`: la readiness rechaza
  `needs_review`, material no legible, puntero inválido y obsoleto; cuenta la fuente
  limpia y la referencia válida.
- Regresión: `sourceGroundedQuestionGeneration.test.ts` y `adaptiveGeneration.test.ts`
  verdes.
- Retest real de generación (proveedor) queda para staging (SPEC 035); no se afirma
  éxito real del proveedor sin ese retest.

## Pendiente de SPEC 037 (fuera de esta reparación de readiness)

El endurecimiento del **índice compacto** (prompt/validación: 5–15 temas raíz, tope
20, profundidad 1–2, sin nodos artículo/página) y la revisión/aplicación **global**
del índice se abordan como continuación; esta entrega corrige el desajuste de
readiness observado y los mensajes, que era el bloqueante reportado.
