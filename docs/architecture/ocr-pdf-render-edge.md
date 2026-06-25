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

## Alternativas reales si MuPDF WASM no funciona en Supabase Edge Runtime

El runtime de Edge Functions (Deno aislado) tiene límites de memoria/CPU y de WASM
que pueden impedir inicializar/rasterizar MuPDF para PDFs grandes (33/24 páginas).
Opciones, de menor a mayor infraestructura:

1. **Proveedor OCR/visión que acepte PDF directamente (recomendada).** Evita
   rasterizar en nuestro código: se envían los bytes del PDF y el proveedor devuelve
   texto por página + confianza. Candidatos: **Mistral OCR API**, **Google Document
   AI**, **AWS Textract**, **Azure Document Intelligence**. La Edge Function seguiría
   siendo la frontera de confianza (auth/scope/no-mock) y solo cambiaría el adaptador
   de proveedor (de “rasterizar + chat vision” a “subir PDF + leer resultado”). OpenAI
   Chat Vision **no** acepta PDF directamente hoy, por eso requiere rasterizado.
2. **Worker de rasterizado fuera de Edge.** Una función/servicio con más memoria
   (Node + `pdfjs-dist`/canvas, o un contenedor con `poppler`/`pdftoppm` o MuPDF
   nativo) que recibe el PDF y devuelve PNG por página; la Edge Function lo invoca y
   luego hace la visión. Mantiene OpenAI como proveedor de visión.
3. **Conversión server-side en infraestructura compatible.** Igual que (2) pero como
   paso de pipeline (cola/almacenamiento): subir PDF → worker rasteriza a Storage →
   Edge Function lee imágenes → visión.

**Recomendación:** evaluar (1) primero (menos infraestructura y sin rasterizado
propio). Si se mantiene OpenAI Vision, hace falta (2). **No** se rasteriza en el
frontend y **no** se genera OCR simulado en ningún caso.

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
