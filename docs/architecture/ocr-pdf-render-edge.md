# OCR: rasterizado de PDF en Edge — diagnóstico y alternativas (SPEC 034)

## Estado (confirmado en staging)

La Edge Function `ocr-material` **falla en el rasterizado del PDF** (`renderPdfToPages`
/ MuPDF WASM) **antes** de llamar al proveedor de visión. Evidencia: `material_ocr_runs`
con `processed_pages=0`, `failed_pages=0`, `status=failed`; `materials.extraction_status
=ocr_failed`, `content_text_chars=0`. **No es cuota ni fallo del proveedor**: el
proveedor no llega a invocarse.

> Por diseño, un fallo de render **no** marca el run como *provider failed*: el run
> queda `failed` con un código de diagnóstico de **render**, y el material queda
> `ocr_failed`/`needs_review`. Nunca se inventa texto ni se rasteriza en el navegador.

## Diagnóstico seguro (este fix)

`classifyRenderFailure(stage, message)` (puro, en `_shared/ocr-material/contract.ts`)
mapea la etapa del render + señales del error a un **código estable y seguro** (sin
contenido del PDF ni secretos), que se guarda en `material_ocr_runs.errors` y se
añade a `materials.extraction_error`:

| Código | Significado |
| --- | --- |
| `renderer_init_failed` | El motor de render no inicializa (import/instanciado). |
| `wasm_runtime_failed` | Fallo del runtime WASM (instanciado/memoria). |
| `pdf_load_failed` | El documento PDF no se pudo abrir. |
| `page_rasterize_failed` | Una página no se pudo rasterizar. |
| `pdf_password_or_encrypted` | PDF protegido/cifrado. |
| `pdf_too_large` | La imagen rasterizada excede el tamaño máximo. |

Log seguro: `console.error("ocr_render_failed stage=… page=… diag=…")` — solo etapa,
página y código; **nunca** bytes del PDF ni `Authorization`.

## DECISIÓN (2026-06-25): rasterizar con MuPDF en Edge queda DESCARTADO

Tras el redeploy del diagnóstico, staging confirma `material_ocr_runs.errors =
["renderer_init_failed"]` (page_count=24, processed_pages=0): **MuPDF/WASM no
inicializa en Supabase Edge Runtime**. No es un problema de tamaño ni de contenido,
es del runtime. Por tanto el rasterizado local en Edge **no es viable** y se sustituye
por enviar el PDF directamente al proveedor.

### Alternativas evaluadas

1. **Proveedor que acepte el PDF directamente (ELEGIDA — Opción A).** Evita rasterizar
   en nuestro código: el servidor descarga el PDF y lo manda como **adjunto** al
   proveedor, que devuelve texto por página + confianza. Implementada con **OpenAI
   file input** (Chat Completions, content part `type:"file"` con el PDF en base64),
   reutilizando el secreto `OPENAI_API_KEY` ya configurado. Alternativas equivalentes
   para el mismo seam: **Mistral OCR API**, **Google Document AI**, **AWS Textract**,
   **Azure Document Intelligence**.
2. **Worker de rasterizado fuera de Edge.** Servicio con más memoria (Node +
   `pdfjs-dist`/canvas, o contenedor con `poppler`/`pdftoppm` o MuPDF nativo) que
   devuelve PNG por página; la Edge Function lo invoca y hace la visión. No necesario
   con la Opción A; queda como plan B si el file input no rinde.
3. **Conversión server-side por pipeline** (subir PDF → worker rasteriza a Storage →
   Edge lee imágenes → visión). Mayor infraestructura; descartada de momento.

**No** se rasteriza en el frontend y **no** se genera OCR simulado en ningún caso.

## Implementación: estrategia `provider_pdf` (Opción A)

La Edge Function `ocr-material` elige la estrategia por secreto **`OCR_STRATEGY`**
(`resolveOcrStrategy`, contrato puro):

| `OCR_STRATEGY` | Comportamiento |
| --- | --- |
| (sin valor) / cualquiera | **`provider_pdf`** — envía el PDF al proveedor sin rasterizar (POR DEFECTO). |
| `edge_rasterize` | Camino legado MuPDF (solo si el entorno lo soporta; si no, falla cerrado `renderer_init_failed`). |

Ruta `provider_pdf` (pura + Deno):
- `buildOcrPdfRequest({ model, pdfBase64, fileName })` arma la llamada a OpenAI con el
  PDF como adjunto y `response_format: json_schema (ocr_document)` que pide
  `{ pages: [{ page_number, text, confidence, warnings }] }`.
- `parseOcrPdfResponse` parsea de forma tolerante (reasigna `page_number`, acota
  confianza, basura → sin páginas → fallo honesto).
- Guarda de entrada antes de llamar: PDF > 32 MB o > 100 páginas → `pdf_too_large`
  (`OCR_PAGE_LIMIT_EXCEEDED`), sin invocar al proveedor.
- Si **se llamó** al proveedor y falla (timeout/red o `!ok`) → `OCR_PROVIDER_FAILED`
  con diag `provider_timeout_or_network` / `provider_http_<status>` (NO render).
- El resto (persistencia por página, bandas de confianza, agregación, estados
  terminales) es común a ambas estrategias.

Mientras no haya proveedor configurado se mantiene el **bloqueo honesto**
(`OCR_PROVIDER_NOT_CONFIGURED`, 501, cero escrituras). Si se fuerza `edge_rasterize`
en Edge, el bloqueo honesto es `OCR_RENDER_FAILED` / `renderer_init_failed`.

> **Estado SPEC 034/035:** el OCR de PDFs escaneados vía `edge_rasterize` queda
> **BLOCKED** en Supabase Edge por `renderer_init_failed` (MuPDF/WASM no inicializa).
> La ruta soportada es `provider_pdf`. El resto del MVP con **PDFs de texto** (capa de
> texto nativa, sin OCR) sigue funcionando con normalidad.

### Pendiente de operador (no codificable; no afirmar éxito sin retest en staging)

- Secretos: `OCR_PROVIDER=openai`, `OPENAI_API_KEY`, opcional `OCR_MODEL`
  (def. `gpt-4o-mini`), opcional `OCR_STRATEGY` (def. `provider_pdf`).
- `supabase functions deploy ocr-material`.
- Reintentar OCR sobre un PDF escaneado conocido y verificar
  `material_ocr_runs.processed_pages > 0` con texto/confianza reales.
- **Riesgo a validar:** límite de páginas/tokens y latencia del file input para PDFs
  largos (24+ páginas en una sola llamada). Si no rinde, activar la Opción 2 (worker
  de rasterizado fuera de Edge).

## Smoke de Edge (verificación en staging — no testeable en vitest)

El rasterizado real (MuPDF WASM) corre en Deno; el suite de vitest solo cubre el
**clasificador** `classifyRenderFailure`. El smoke de render se hace en staging:

1. Desplegar `ocr-material` con secretos (`OCR_PROVIDER=openai` + `OPENAI_API_KEY` +
   `OCR_MODEL`).
2. Invocar OCR sobre un material **escaneado conocido** (estado `scanned_detected`).
3. Inspeccionar el resultado:
   - **Éxito de render:** `material_ocr_runs.processed_pages > 0` y la página tiene
     texto/confianza (entonces el problema, si lo hubiera, sería del proveedor).
   - **Fallo de render (caso actual):** `status=failed`, `processed_pages=0` y
     `material_ocr_runs.errors=[<diag>]` con uno de los códigos de la tabla; el
     material queda `ocr_failed` con `extraction_error` que incluye el código.
4. Probar variantes esperadas: PDF protegido → `pdf_password_or_encrypted`; PDF muy
   grande → `pdf_too_large` o `wasm_runtime_failed`; si MuPDF no instancia →
   `renderer_init_failed`/`wasm_runtime_failed`.

El código exacto indica si la solución es de límites (tamaño), de contenido (PDF
cifrado) o de runtime (WASM) — y, si es de runtime para PDFs normales, confirma que
hay que adoptar una de las alternativas anteriores.
