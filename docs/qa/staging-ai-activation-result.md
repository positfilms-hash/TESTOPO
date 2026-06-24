# Resultado de activación de IA en staging (SPEC 035)

Documento de **resultado** del retest real. Debe distinguir `PASS`, `FAIL` y
`BLOCKED` e incluir el commit/función desplegados, el scope de QA seguro, comandos
**sin valores de secretos**, hallazgos y estado de rollback. **No** puede afirmar
OCR/generación reales a partir de tests unitarios, fixtures mock o pruebas
sin proveedor.

---

## Estado actual: `BLOCKED` (luz verde dada; ejecución pendiente del operador)

**Fecha:** 2026-06-24 · **Commit objetivo a desplegar:** `b1ee773` (y sus padres).

**Luz verde recibida** para desplegar `b1ee773` en staging (no producción). Sin
embargo, el despliegue + smoke **no se han ejecutado** porque deben hacerlos un
**operador autorizado**: requieren la configuración de secretos reales y acceso al
proyecto de staging que, por diseño de SPEC 035, **no** corresponden a Claude/Codex.

**Por qué Claude no puede ejecutarlo desde su entorno (evidencia, solo lectura):**

- la CLI `supabase` **no está instalada** en el entorno de trabajo;
- **no hay proyecto vinculado** (`supabase/.temp` ausente) → no se puede **confirmar
  el project ref de staging**, requisito previo a cada operación;
- **sin `SUPABASE_ACCESS_TOKEN`** → no se puede autenticar un `functions deploy`;
- **sin `OPENAI_API_KEY`** (correcto: el operador la introduce directamente; Claude
  no debe poseerla, generarla ni transmitirla);
- **sin navegador/sesión** → no se puede subir un PDF escaneado real, recorrer el
  flujo de UI ni capturar a 1366×900 / 390×844.

No se ha configurado ningún secreto, no se ha desplegado nada y **no** se inventa
ningún resultado de smoke (PASS/FAIL/IDs/capturas). Estado: **BLOCKED** hasta que el
operador ejecute el runbook.

**Runbook que debe ejecutar el operador** (confirmando el ref de staging ANTES de
cada operación; ver [`../setup/staging-ai-activation.md`](../setup/staging-ai-activation.md)
y el smoke en [`staging-ai-activation-smoke-test.md`](./staging-ai-activation-smoke-test.md)):

```bash
# 0) Confirmar que el proyecto vinculado es STAGING (no produccion):
supabase projects list            # anotar el ref de staging
supabase link --project-ref <STAGING_REF>   # si no esta vinculado
# 1) Secretos (valores reales introducidos por el operador; nunca en repo/logs/PR):
supabase secrets set AI_PROVIDER=openai OCR_PROVIDER=openai
supabase secrets set OPENAI_API_KEY=<...> OPENAI_MODEL=<...> OCR_MODEL=<...>
supabase secrets set MAX_GENERATED_QUESTIONS=20 MAX_QUESTION_SOURCE_CHARS=20000 \
  OCR_MAX_PAGES_PER_DOCUMENT=300 OCR_MAX_CONCURRENT_PAGES=3 OCR_PAGE_TIMEOUT_SECONDS=60
# 2) Desplegar SOLO estas dos funciones (re-confirmar ref staging antes):
supabase functions deploy ocr-material
supabase functions deploy generate-questions
# 3) Ejecutar el smoke aislado (pasos 1-9) y volcar el resultado abajo.
```

Tras ejecutarlo, rellenar la tabla de resultado con PASS/FAIL/BLOCKED, el commit
desplegado, IDs/contadores/estados y capturas seguras (sin secretos, prompts, texto
OCR completo ni URLs firmadas).

**Motivo histórico del BLOCKED previo:** la activación real requiere que un
operador autorizado configure los secretos directamente en staging y despliegue.

**Preparado y verificado en este paso (sin staging):**

- Precondiciones 033/034 confirmadas en el código mergeado:
  - `generate-questions` valida cada `topic_source_reference`
    (`evaluateTopicSourceReference`) antes del proveedor.
  - `ocr-material` **no** borra `material_ocr_runs`/`material_ocr_pages` al
    reintentar (historial conservado; run nuevo aislado).
- Límites por secreto efectivos y acotados (`resolveQuestionLimits` /
  `resolveOcrLimits`): un valor del operador solo puede endurecer, nunca superar
  el máximo seguro. Cubierto por vitest.
- Tests/build verdes (ver §Comandos).
- Documentación de setup/smoke/seguridad completa.

**Limitación clave de verificación:** las Edge Functions (`index.ts`,
`pdfRender.ts`) corren en **Deno** y **no** las ejecuta el suite. La integración
real (OpenAI, Supabase, descarga Storage y **render MuPDF en Edge Functions** —
riesgo principal) **solo** se verifica en staging con secretos reales y un escaneo
con texto visible.

---

## Plantilla de resultado del retest (rellenar tras la activación real)

| Comprobación | Resultado | Evidencia segura (IDs/contadores/estado) |
| --- | --- | --- |
| Commit/función desplegados | `PASS`/`FAIL`/`BLOCKED` | commit `<sha>`, `ocr-material` + `generate-questions` |
| Sin proveedor → 501 sin escrituras (OCR/gen) | | conserva `scanned_detected`; 0 filas |
| Student/revocado/cross-scope/input arbitrario rechazados | | códigos `*_ACCESS_DENIED` / `*_FORBIDDEN` |
| OCR real: 1 run + 1 página/proc., texto real, estado honesto | | `run_id`, nº páginas, estado terminal |
| Reintento OCR conserva historial, nuevo `ocr_run_id` | | nº runs antes/después |
| Generación: run + candidatas trazables, solo `pending_review`/`needs_fix` | | `run_id`, nº creadas, estados |
| Ninguna pregunta `validated` automáticamente | | — |
| Revisión humana sigue obligatoria | | — |
| Sin secretos en frontend/build; React solo llama a las 2 funciones | | grep = 0 |
| Smoke visual 1366x900 / 390x844 | | capturas `smoke-*.png` (ignoradas por Git) |
| Rollback probado (unset proveedor → 501 honesto) | | — |

**Veredicto final:** `PASS` / `FAIL` / `BLOCKED` — _(rellenar)_

## Comandos (sin valores de secretos)

```bash
cd app/backend && npx vitest run          # backend
cd app/frontend && npx vitest run         # frontend
cd app/frontend && npx vite build         # build
# Despliegue/secretos: ver ../setup/staging-ai-activation.md (los ejecuta el operador)
```
