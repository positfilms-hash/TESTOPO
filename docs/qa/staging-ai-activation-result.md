# Resultado de activación de IA en staging (SPEC 035)

Documento de **resultado** del retest real. Debe distinguir `PASS`, `FAIL` y
`BLOCKED` e incluir el commit/función desplegados, el scope de QA seguro, comandos
**sin valores de secretos**, hallazgos y estado de rollback. **No** puede afirmar
OCR/generación reales a partir de tests unitarios, fixtures mock o pruebas
sin proveedor.

---

## Estado actual: `BLOCKED` (pendiente de activación por operador)

**Fecha:** 2026-06-24 · **Autor del preparado:** Claude (implementación)

**Motivo del BLOCKED:** la activación real requiere que un **operador autorizado**
configure los secretos del proveedor directamente en el proyecto Supabase de
staging y despliegue las funciones. En este paso **no** se han configurado
secretos ni desplegado nada (ni autorizado). Por tanto **no** existe aún un retest
real con proveedor.

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
