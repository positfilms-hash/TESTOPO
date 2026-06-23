# OCR & Vision para PDFs escaneados (SPEC 030)

Algunos PDFs subidos no traen **capa de texto**: son escaneos (imágenes de
páginas). El extractor nativo (`PdfJsTextExtractor`, SPEC 012/PR #57) no puede
leerlos y los marca `not_supported`/`failed`, así que su contenido nunca llega a
clasificación, secciones, índice ni generación de preguntas. SPEC 030 añade un
**camino OCR** acotado para recuperar ese texto y devolverlo al pipeline normal.

> **Fase 1**: dominio + persistencia + orquestación con un **proveedor mock
> determinista sin red** (`MockOcrProvider`) y un render placeholder.
> **Fase 2**: UI de gestión en Material (badge + Reintentar OCR + detalle), el
> seam de proveedor real `EdgeFunctionOcrProvider` y el **scaffold** de la Edge
> Function `ocr-material`. La clave del proveedor es un secreto del servidor —
> **nunca** del frontend/Vite. Ver [persistence.md](./persistence.md), la fila 032
> del [runbook de migraciones](../setup/migrations-runbook.md) y
> [supabase-edge-functions.md](../setup/supabase-edge-functions.md).

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

## Fase 2: UI de gestión y seam de proveedor real

### UI (`MaterialPage`, solo gestor)

Por archivo se muestra **un badge de estado OCR** derivado de `extraction_status`
(`OcrBadge`/`ocrStatusInfo` en `components/ui.tsx`):

| `extraction_status` | Badge | Tono |
| --- | --- | --- |
| `completed` | Texto extraído | success |
| `scanned_detected` | Escaneo detectado | info |
| `ocr_processing` | Leyendo escaneo | info |
| `completed_ocr` | Leído con OCR | success |
| `completed_ocr_with_warnings` | OCR con advertencias | warning |
| `ocr_failed` | No se pudo leer | danger |

- **Botón OCR** sólo en estados `scanned_detected` / `completed_ocr_with_warnings`
  / `ocr_failed` (`ocrCanRetry`): **«Leer escaneo (OCR)»** en el primer intento
  (`ocrIsFirstRun` → `startMaterialOcr`) y **«Reintentar OCR»** después
  (`retryMaterialOcr`). La acción `Abrir` (URL firmada/object URL, nunca
  `storage_path`) sigue disponible.
- **Detalle compacto** (`ocrHasOutcome`) sólo para resultados de OCR: páginas
  leídas/total, páginas con fallo, confianza media (%), nº de advertencias y el
  texto de error accionable. Tomado de la metadata `ocr_*` del material (sin
  fetch extra). **El alumno no ve nada de esto** (controles bajo `isAdmin` y el
  facade deniega el acceso).

### `EdgeFunctionOcrProvider` — RETIRADO (superado por SPEC 034)

> El seam browser-image (`OcrProvider` que rendereaba cada página en el navegador y
> la enviaba a `ocr-material` con `{ page_number, image_base64 }`) se **eliminó** en
> SPEC 034. El OCR real es ahora **server-owned**: corre íntegro en la Edge Function
> `ocr-material` (descarga del PDF privado + render server-side MuPDF + visión, todo
> en el servidor). No existe ya `EdgeFunctionOcrProvider` ni el flag
> `VITE_OCR_EDGE_FUNCTION_URL`; el contrato browser-image no debe reutilizarse.

En proceso (InMemory/demo) `createOcrProvider()` devuelve solo el proveedor MOCK
determinista (sin red ni claves); el OCR real vive en la Edge Function, no en el
backend. Ver [`server-side-ocr.md`](./server-side-ocr.md).

### Edge Function `ocr-material` (scaffold)

`supabase/functions/ocr-material/index.ts`: autentica el JWT del gestor, valida el
payload y, sin `OCR_PROVIDER_API_KEY`, responde `501 OCR_PROVIDER_NOT_CONFIGURED`.
Marca el **punto exacto de integración** del proveedor real (paso 4). No contiene
claves; nunca devuelve `storage_path`, claves ni URLs internas. Despliegue,
secretos y pruebas: [supabase-edge-functions.md](../setup/supabase-edge-functions.md).

### Render real de páginas (pendiente)

En Fase 2 el render sigue siendo `PlaceholderPdfPageRenderService` (imágenes
vacías). El render real PDF→imagen en el navegador (canvas/pdfjs) queda como
trabajo posterior; el seam (`PdfPageRenderService`) ya está listo para
sustituirlo sin tocar la orquestación.
