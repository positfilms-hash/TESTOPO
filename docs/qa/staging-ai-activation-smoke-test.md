# Smoke test de activación de IA en staging (SPEC 035)

Flujo de QA **aislado** para verificar OCR real y generación anclada a fuentes en
staging, **tras** que el operador haya configurado secretos y desplegado
(`../setup/staging-ai-activation.md`). No registrar valores de secretos, texto de
fuente/OCR completo, URLs firmadas ni rutas internas: solo IDs de run, contadores,
estado terminal y códigos seguros.

> Usar un **workspace/oposición de QA aislados** y un **PDF escaneado pequeño cuya
> página renderizada contenga texto legible visible**. Un fixture en blanco o solo
> imagen (como `app/backend/tests/fixtures/scanned-image.pdf`) **solo** prueba
> detección de escaneo, **no** lectura OCR real.

## A. Comprobaciones negativas (primero, o en una oposición aislada aparte)

1. **Sin proveedor** (antes de fijar `AI_PROVIDER`/`OCR_PROVIDER`):
   - OCR de un escaneo → HTTP **501 `OCR_PROVIDER_NOT_CONFIGURED`**, el material
     **conserva** `scanned_detected`, y **no** hay run/página/`content_text`.
   - Generación → HTTP **501 `QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED`**, sin
     run ni candidata.
2. **Student / revocado / eliminado** no pueden invocar ninguna función
   (`*_AUTH_REQUIRED` / `*_ACCESS_DENIED`).
3. **Cross-workspace/oposición**, IDs ajenos, **input arbitrario** (imagen/texto
   OCR/fuente/prompt/`user_id`), **fuentes prohibidas** (clasificación no elegible,
   material obsoleto, test antiguo como fuente factual) y **tema no aplicado** →
   rechazados antes de proveedor/Storage/escrituras.
4. **Fallo del proveedor** → solo estados/runs **fallidos honestos**, nunca texto
   ni preguntas mock.

## B. Flujo positivo (proveedor configurado)

1. Login como **owner/admin**; anotar IDs de workspace/oposición en el log de QA
   (privado), **no** valores de secretos.
2. Subir el PDF escaneado (con texto visible) y verificar `scanned_detected`.
3. Pedir OCR desde la UI. Confirmar que el navegador envía **solo IDs** (sin
   imagen ni texto OCR).
4. Verificar persistencia real:
   - **un** `material_ocr_run` nuevo; **una** `material_ocr_page` por página
     procesada; **texto OCR real no vacío**; confianza/warnings/errores;
   - `materials.content_text` agregado **en orden de página**;
   - estado terminal **honesto**: `completed_ocr`, `completed_ocr_with_warnings`
     o `ocr_failed`.
   - Reintento (si aplica): **nuevo** `ocr_run_id`; los runs/páginas anteriores
     **se conservan** (historial auditado).
5. Si el OCR tiene éxito, usar el flujo de **Temario** existente para crear y
   **aplicar explícitamente** un índice con fuentes (SPEC 035 no cambia el pipeline
   de índice).
6. Seleccionar un **tema aplicado activo** con fuentes concretas elegibles y pedir
   **generación** desde la UI.
7. Verificar `question_generation_run`, questions, options, validation_results, y
   trazabilidad (topic/material/sección-o-referencia/excerpt). Estados **solo**
   `pending_review` o `needs_fix`. **Ninguna** pregunta `validated`.
8. Confirmar que **la revisión humana sigue siendo obligatoria** antes de usar una
   pregunta en un test normal.

## C. Seguridad y no-mock

- `grep` en `app/frontend/src` y en el **build** de producción: cero
  `OPENAI_API_KEY` / claves de proveedor / `SUPABASE_SERVICE_ROLE_KEY` / `VITE_*`
  privadas.
- React invoca **solo** las funciones autenticadas `ocr-material` y
  `generate-questions`; **nunca** URLs de OpenAI/proveedor directamente.
- En modo staging **no** se puede seleccionar el proveedor mock InMemory.
- Logs: solo IDs de run, contadores, estado terminal y códigos seguros. Nunca
  prompt/fuente/OCR completos, claves, URLs firmadas ni rutas internas.

## D. Smoke visual (runbook de Codex)

`docs/qa/codex-visual-review-runbook.md` a **1366x900** y **390x844**: estados de
Material (badges OCR), generación y cola de revisión; sin secretos ni internals a
la vista.

## Registro del resultado

Volcar PASS/FAIL/BLOCKED y evidencia segura en
[`staging-ai-activation-result.md`](./staging-ai-activation-result.md).
