# OCR & Vision para PDFs escaneados (SPEC 030)

Algunos PDFs subidos no traen **capa de texto**: son escaneos (imágenes de
páginas). El extractor nativo (`PdfJsTextExtractor`, SPEC 012/PR #57) no puede
leerlos y los marca `not_supported`/`failed`, así que su contenido nunca llega a
clasificación, secciones, índice ni generación de preguntas. SPEC 030 añade un
**camino OCR** acotado para recuperar ese texto y devolverlo al pipeline normal.

> **Fase 1 (esta entrega)**: dominio + persistencia + orquestación con un
> **proveedor mock determinista sin red** (`MockOcrProvider`) y un render
> placeholder. El proveedor real (visión por IA) se enchufa en **Fase 2** vía
> **Edge Function**, donde la clave es un secreto del servidor — **nunca** del
> frontend/Vite. Ver [persistence.md](./persistence.md) y la fila 032 del
> [runbook de migraciones](../setup/migrations-runbook.md).

OCR sólo **recupera texto**: no clasifica el documento ni genera contenido. Es
metadata operativa de **gestión**; el alumno no la ve.

## Detección: ¿escaneo o texto nativo?

`PdfScanDetectionService.evaluate(result)` es determinista y reutiliza el gate de
calidad `assessTextQuality` (SPEC 012). A partir del resultado de la extracción
nativa decide si el PDF es un **probable escaneo** (candidato a OCR):

- `completed` con texto **suficiente** → `likely_scan: false` (camino sin-OCR).
- `completed` pero texto **pobre/ilegible** y con páginas → `likely_scan: true`.
- `not_supported` (sin capa de texto) y con páginas → `likely_scan: true`.
- `failed` (dañado) o sin páginas → `likely_scan: false` (el OCR no ayuda).

En la subida (`pdfMaterialService` / `materialImportService`, con la dependencia
opcional `scanDetection`) un PDF detectado como escaneo se marca
`extraction_status = scanned_detected`, a la espera de OCR. **El texto nativo
suficiente nunca dispara OCR.**

## Estados de extracción (modelo `Material`)

`EXTRACTION_STATUSES` añade cinco estados OCR sobre los nativos:

`scanned_detected` · `ocr_processing` · `completed_ocr` ·
`completed_ocr_with_warnings` · `ocr_failed`.

Y `EXTRACTION_METHODS` (`text` · `ocr` · `mixed`) registra **cómo** se obtuvo el
texto. Metadata OCR aditiva/nullable en `Material`: `extraction_method`,
`ocr_status`, `ocr_confidence`, `ocr_page_count`, `ocr_processed_pages`,
`ocr_failed_pages`, `ocr_warning_count`.

## Orquestación: `MaterialOcrService`

`startOcr` / `retryOcr` / `getStatus`. Solo se (re)lanza desde un estado
elegible: `scanned_detected`, `completed_ocr_with_warnings` o `ocr_failed`. El
flujo de `runOcr`:

1. Valida material PDF con `storage_path`, estado elegible y `page_count` dentro
   del límite (`OcrConfig.max_pages`, 300 por defecto). Lee los bytes del
   almacenamiento (privado).
2. **Reintento**: borra runs/páginas previos del material (no se acumulan).
3. Marca el material `ocr_processing` y crea un `MaterialOcrRun` (`processing`).
4. Renderiza páginas (Fase 1: `PlaceholderPdfPageRenderService`, una entrada por
   página hasta `max_pages`; el render real PDF→imagen vive en la Edge Function).
5. Por página, llama a `provider.recognizePage`. **Un fallo del proveedor en una
   página no rompe el run**: esa página queda como `failed`.
6. Clasifica cada página por **banda de confianza** y persiste la página.
7. Agrega el texto **utilizable en orden de página** (`\n\n`), calcula la
   confianza media y fija el estado final del run y del material.

### Bandas de confianza (`confidenceBand`)

| Confianza | Estado de página | Efecto |
| --- | --- | --- |
| `>= 0.70` | `completed` | texto utilizable |
| `0.40`–`0.69` | `warning` | utilizable pero revisable (genera advertencia) |
| `< 0.40` o `null` | `failed` | sin texto utilizable |

### Estado final

- Algún texto utilizable y **sin** fallos/advertencias → run `completed`,
  material `completed_ocr`, `status = active`.
- Algún texto utilizable **con** fallos o advertencias → run
  `completed_with_warnings`, material `completed_ocr_with_warnings`,
  `status = needs_review`.
- **Sin** texto utilizable → run `failed`, material `ocr_failed`,
  `status = needs_review`, con `extraction_error`.

### Invariante: un fallo total NO borra el texto nativo

`content_text` y `extraction_method` **solo** se sobreescriben cuando hay texto
OCR utilizable (`aggregated.length > 0`). Si el OCR no extrae nada, el material
conserva intacto su texto/método nativo previo. Así un OCR fallido nunca degrada
una extracción nativa válida.

## Autorización (facade)

`PlatformService.startMaterialOcr` / `retryMaterialOcr` / `getMaterialOcrStatus`
exigen `requireManageOpposition` (owner/admin del workspace de la oposición); el
**alumno queda denegado** (`AccessError`). Si no hay proveedor OCR cableado, el
facade responde con `OcrError(PROVIDER_NOT_CONFIGURED)`.

## Persistencia

`MaterialOcrRepository` (runs + páginas) con implementación `InMemory` y
`Supabase` (`material_ocr_runs` / `material_ocr_pages`, arrays como JSONB). El
factory `createCoreRepositories` selecciona la implementación por modo y la expone
como `core.materialOcr`. Migración **032** (aditiva, idempotente): columnas OCR en
`materials`, ampliación del CHECK de `extraction_status`, las dos tablas internas
con **RLS de solo gestión** (scope por la oposición; el alumno no ve
runs/páginas/confianza/errores/imágenes) e índices. **Nunca** se guardan bytes de
imagen, sólo `image_ref` opcional.

## Límites (`OcrConfig`)

`max_pages` 300 · `max_image_bytes` 10 MB · `max_concurrent_pages` 3 ·
`per_page_timeout_ms` 30 000 · umbrales `usable_threshold` 0.70 /
`warning_threshold` 0.40. Documentados y deterministas; sobreescribibles donde
aplique (proveedor real).

## Lo que SPEC 030 NO hace

- No clasifica el documento ni genera preguntas/tests/índice.
- No usa RAG/embeddings ni fine-tuning.
- No expone claves al frontend: el proveedor real corre en la Edge Function.

## Fase 2 (PR aparte)

UI en `MaterialPage` (badge por archivo: *Texto extraído / Escaneo detectado /
Leyendo escaneo / Leído con OCR / OCR con advertencias / No se pudo leer* +
**Reintentar OCR** sólo en `scanned`/`warning`/`failed`, detalle compacto sólo
gestor), Edge Function `supabase/functions/ocr-material/` (scaffold) +
`EdgeFunctionOcrProvider`, y pasos de despliegue.
