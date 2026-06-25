# Activación de IA real en staging (SPEC 035; ampliada por 038/039)

Esta guía describe **cómo un operador autorizado** activa la IA real (OCR,
estudio de material y generación de preguntas) en el proyecto Supabase de
**staging**. No contiene claves ni valores de secretos: solo nombres de variables,
comandos con **placeholders**, límites seguros, despliegue y rollback.

> **Regla dura.** Claude/Codex **no** configuran secretos, **no** despliegan, y
> **no** generan/recuperan/transmiten claves. El operador humano introduce los
> secretos **directamente en Supabase** (fuera del control de versiones) y
> confirma el `project ref` de staging antes de cada acción.

## Precondiciones (deben estar verdes antes de activar)

Dependen de SPEC 033 y 034 ya mergeadas:

- `generate-questions` valida **cada** `topic_source_reference` (mismo workspace/
  oposición, material activo no obsoleto y legible, clasificación efectiva
  permitida, puntero concreto) antes de llegar al proveedor — ver
  `evaluateTopicSourceReference`.
- `ocr-material` **conserva** runs/páginas previos al reintentar (no borra
  historial); cada reintento crea un `ocr_run_id` nuevo y aislado.
- `cd app/backend && npx vitest run` y `cd app/frontend && npx vitest run` verdes;
  `cd app/frontend && npx vite build` OK.
- El renderer de la Edge Function (`pdfRender.ts`, MuPDF WASM) está listo para una
  comprobación real en staging (riesgo principal: que inicialice/rasterice dentro
  del runtime de Edge Functions; si no, falla cerrado `OCR_RENDER_FAILED`).

Si una precondición falla, documentar `BLOCKED` con evidencia en
`docs/qa/staging-ai-activation-result.md`. **No** sustituir por un mock.

## Secretos de servidor (solo Edge Functions; nunca `VITE_*`)

El operador fija estos secretos en el proyecto de staging. **OpenAI** es la
referencia MVP (único proveedor soportado por las funciones). Valores reales
**fuera** del repo:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=<operator-supplied secret>
OPENAI_MODEL=<approved structured-output model>     # p. ej. salida json_schema
OCR_PROVIDER=openai
OCR_MODEL=<approved vision model>                   # debe soportar visión
# Límites seguros (la función los CLAMPEA al máximo seguro; solo pueden endurecer)
MAX_GENERATED_QUESTIONS=20
MAX_QUESTION_SOURCE_CHARS=20000
OCR_MAX_PAGES_PER_DOCUMENT=300
OCR_MAX_CONCURRENT_PAGES=3
OCR_PAGE_TIMEOUT_SECONDS=60
# Tracking/limite de coste de IA (opcionales; los limites solo pueden REDUCIR).
# Requiere aplicar la migracion 039 (columnas de coste en las tablas de run).
AI_PRICE_INPUT_PER_M=0.15        # USD por 1M tokens de entrada (override de la tabla)
AI_PRICE_OUTPUT_PER_M=0.60       # USD por 1M tokens de salida
MAX_QUESTIONS_PER_RUN=20
MAX_COST_PER_RUN_USD=0.5
MAX_DAILY_COST_USD=5.0           # por workspace+oposicion (suma generacion + estudio)
```

Notas sobre los límites (SPEC 035):

- Las funciones **leen** estos límites desde el entorno y los **clampean** al
  máximo seguro compilado (`resolveQuestionLimits` / `resolveOcrLimits`): un valor
  del operador solo puede **endurecer** el límite, nunca superar el máximo
  (20 preguntas / 20000 chars / 300 páginas / 3 concurrentes / 60 s por página).
  Si una variable falta o es inválida, se usa el máximo seguro.
- `OCR_MAX_CONCURRENT_PAGES` documenta el tope; el procesamiento actual es
  **secuencial** en orden de página (1 a la vez), que satisface el cap.
- `OPENAI_MODEL`/`OCR_MODEL` y un **tope de coste de staging** los aprueba el
  operador. No se commitean, no se pegan en issues/PR, no se imprimen en logs ni
  van en `VITE_*`.

```bash
# El operador, con la Supabase CLI vinculada al proyecto de STAGING:
supabase secrets set AI_PROVIDER=openai OCR_PROVIDER=openai
supabase secrets set OPENAI_API_KEY=<...> OPENAI_MODEL=<...> OCR_MODEL=<...>
supabase secrets set MAX_GENERATED_QUESTIONS=20 MAX_QUESTION_SOURCE_CHARS=20000 \
  OCR_MAX_PAGES_PER_DOCUMENT=300 OCR_MAX_CONCURRENT_PAGES=3 OCR_PAGE_TIMEOUT_SECONDS=60
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta
Supabase. Las funciones usan el **cliente del usuario** (RLS) para leer/escribir;
no requieren service-role.

## Despliegue (funciones de IA)

```bash
# Verificar que el project ref es STAGING ANTES de cada deploy:
supabase projects list           # confirmar el ref de staging
supabase functions deploy ocr-material
supabase functions deploy generate-questions
supabase functions deploy study-material                          # SPEC 038
supabase functions deploy generate-questions-from-studied-material  # SPEC 039
```

`verify_jwt` permanece activado: todas exigen `Authorization`.

### SPEC 038/039 (estudio + generación directa)

- **Migraciones a aplicar** (aditivas, idempotentes; `docs/setup/migrations-runbook.md`):
  `035_material_study.sql` (estudio) y `036_direct_question_generation.sql` (enlaces
  estudio→pregunta). Aplicarlas **antes** de desplegar las funciones que las usan.
- `study-material` (SPEC 038) usa los mismos secretos de proveedor; sin proveedor →
  `501 MATERIAL_STUDY_PROVIDER_NOT_CONFIGURED`, cero escrituras.
- `generate-questions-from-studied-material` (SPEC 039) reutiliza
  `AI_PROVIDER`/`OPENAI_API_KEY`/`OPENAI_MODEL` y los mismos límites
  (`MAX_GENERATED_QUESTIONS`, `MAX_QUESTION_SOURCE_CHARS`; opcional
  `MAX_DIRECT_EVIDENCE_UNITS`, clampeado al máximo seguro 40). Sin proveedor →
  `501 DIRECT_QG_PROVIDER_NOT_CONFIGURED`, cero escrituras. No requiere `topic_id`;
  la evidencia procede solo de unidades/conceptos estudiados.

## Rollback (operacional, no fallback de frontend)

```bash
# Desactivar el proveedor -> las funciones vuelven a su 501 honesto sin escrituras.
supabase secrets unset AI_PROVIDER OCR_PROVIDER
# (rotar/eliminar la clave del proveedor si es necesario) y redeploy si procede.
```

Tras el rollback, sin proveedor: `generate-questions` y `ocr-material` devuelven
su **501 honesto**, OCR **preserva** `scanned_detected`, y **no** se crea ninguna
escritura mock.

## Smoke y resultado

- Flujo de smoke aislado: [`../qa/staging-ai-activation-smoke-test.md`](../qa/staging-ai-activation-smoke-test.md).
- Resultado (PASS/FAIL/BLOCKED tras retest real):
  [`../qa/staging-ai-activation-result.md`](../qa/staging-ai-activation-result.md).
- Secret boundary: [`../security/ai-provider-secrets.md`](../security/ai-provider-secrets.md),
  [`../security/ocr-provider-secrets.md`](../security/ocr-provider-secrets.md).

> No se puede afirmar que la activación pasó sin un **retest real con proveedor**
> en staging. Los tests unitarios y los fixtures (incluido `scanned-image.pdf`, que
> solo prueba detección de escaneo) **no** demuestran OCR/generación reales.
