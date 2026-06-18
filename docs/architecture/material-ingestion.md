# Ingesta de material (SPEC 028 - Smart Bulk Upload)

Cómo TESTOPO convierte una subida masiva de documentos en una base organizada
para generar temario y preguntas fiables. Une piezas previas (SPEC 012 extracción
PDF, SPEC 017 import ZIP, SPEC 019 índice IA, SPEC 022 Supabase) en **un único
flujo** detrás del botón `Subir material`.

## Principio rector

```text
Subir ZIP/carpeta/PDFs
  -> Desglosar archivos
  -> Crear materiales + extraer texto
  -> Clasificar por categoria (material de oposicion / tests antiguos)
  -> IA PROPONE indice de temario (no lo aplica)
  -> IA analiza tests antiguos (estilo/cobertura, NO preguntas)
  -> Revision humana
  -> (mas tarde) Generar preguntas candidatas -> revisar -> validated
  -> Tests de estudiante SOLO desde preguntas validated
```

La IA **nunca** aplica nada sola y **nunca** genera preguntas `validated` ni tests
de estudiante a partir de un PDF.

## Pipeline

### 1. Upload (frontend)

`MaterialPage` → `SmartUploadForm`. El usuario elige **una de dos categorías**
(`Material de la oposicion` / `Tests antiguos`) y sube por uno de tres caminos:

| Entrada | `source_type` | Cómo llegan los archivos |
| --- | --- | --- |
| Subir ZIP | `zip` | El servicio expande el ZIP en backend. |
| Subir carpeta | `folder` | `<input webkitdirectory>`; rutas vía `webkitRelativePath`. |
| Subir PDFs | `multi_file` | Selección múltiple; ruta = nombre de archivo. |

Si el navegador no soporta `webkitdirectory`, la UI recomienda comprimir en ZIP.

### 2. Batch (lote)

`material_import_batches` registra el lote: `upload_category`
(`opposition_material` | `old_tests` | `mixed`), `source_type`, contadores
(`imported`/`skipped`/`failed`/`analyzed_files`), `errors` y `warnings`. Solo
gestores (owner/admin) lo ven; el estudiante nunca accede a estas tablas.

### 3. Items

`material_import_items`: un registro por archivo con su `original_path`,
`upload_category`, `detected_category` (`opposition_material` | `old_tests` |
`unknown`), `ai_classification_confidence`, estado (`imported`/`skipped`/`failed`)
y error. La clasificación combina la elección del usuario y, en un ZIP `mixed`, la
carpeta top-level (`Material de la oposicion` / `Tests antiguos`). Lo que no encaja
queda `unknown` + warning.

### 4. Materials

Cada archivo aceptado crea un `materials` asociado a `workspace_id`/`opposition_id`/
`uploaded_by`:

- `opposition_material` → `type = syllabus` por defecto.
- `old_tests` → `type = old_test` por defecto.
- Problema de extracción o categoría ambigua → `status = needs_review`.

Los archivos **no** se guardan en el repo ni en Supabase: solo metadatos +
`storage_path` interno (ver [persistence.md](./persistence.md) y SPEC 028 §28). Si
se necesitara Storage privado, sería una futura **SPEC 030**.

La carga masiva **no crea temas definitivos**. La estructura de carpetas se guarda
en `item.original_path` y alimenta las *sugerencias* del índice IA (paso 6).

### 5. Extracción de texto

`PdfTextExtractor` (SPEC 012) por PDF; TXT/MD se decodifican directos. Estados:
`not_started` · `processing` · `completed` · `failed` · `not_supported`. Un PDF
escaneado sin capa de texto queda `not_supported` (**sin OCR** en esta spec).

### 6. Índice de temario con IA (SPEC 019)

Para material de oposición, tras importar se ofrece `Crear indice con IA`
(`proposeSyllabusIndex`). El proveedor recibe `folder_paths` (material → ruta) y
propone tema/subtema reflejando las carpetas. La propuesta nace `pending_review`;
se revisa, aprueba y solo entonces se **aplica** al Topic Map, asociando
materiales. Nada se aplica sin acción humana.

### 7. Análisis de tests antiguos

Los `old_test`/`official_exam` se enrutan a `ExamPatternSummary` (sellado con
`workspace_id`/`opposition_id`/`batch_id`): estilo, dificultad, temas frecuentes y
`coverage_notes`. Es **contexto**, no un banco de preguntas. No crea temas ni
preguntas.

### 8. Generación posterior de preguntas (fuera de esta spec)

```text
Indice aprobado + materiales asociados
  -> Admin pulsa "Generar preguntas"
  -> IA genera candidatas (pending_review / needs_fix)
  -> Admin revisa
  -> Preguntas validated
  -> Tests de estudiante SOLO desde el banco validated
```

Los tests antiguos aportan estilo/cobertura como *contexto* de generación; nunca
se copian como preguntas `validated` ni se sirven como test de estudiante.

## Garantías de seguridad y permisos

- Suben material: `owner`, `admin`, `manager` autorizado, `premium owner` en
  workspace personal. **No** suben: `student`, sin acceso, eliminado. Guard:
  `requireManageOpposition` en `PlatformService.smartUpload`.
- `upload_category` y `source_type` se validan **en runtime** dentro de
  `smartUpload` (no solo por TypeScript): una llamada directa con un valor raro
  recibe `SMART_UPLOAD_INVALID_CATEGORY` / `SMART_UPLOAD_INVALID_FILE_TYPE` antes
  de tocar el repositorio (evita romper el check constraint de la tabla).
- **Criterio de rechazo** (decidido en SPEC 028):
  - **Amenazas estructurales del lote → abortan TODO** (no se importa nada):
    rutas `../`, rutas absolutas, backslash/drive Windows, ZIP anidado, ZIP
    demasiado grande, lote con más de 500 archivos. Lanzan `SmartUploadError`.
  - **Archivo individual no apto → se OMITE (skipped), sin abortar el lote**:
    extensión peligrosa/no permitida (`.exe`, `.bat`, …), archivo > 50 MB,
    duplicado. El resto del lote se importa y el archivo queda registrado como
    `skipped` en su `material_import_item` con el motivo. Así un único archivo
    problemático no tira abajo una subida de cientos de documentos.
  - Límites: 200 MB ZIP / 500 archivos por lote / 50 MB por archivo
    (`import/importErrors.ts`, `import/smartUploadErrors.ts`).
- El estudiante no ve lotes/items de importación, errores internos, material
  `needs_review`/`obsolete`, ni los materiales `old_test`/`official_exam` (son
  **fuente interna de generación**, no material de estudio: `listMaterials`/
  `getMaterial` los excluyen para no gestores vía `isStudentVisibleMaterial`).
  RLS (022/025) + guards de servicio siguen activos.

## Mapa de código

| Capa | Archivo |
| --- | --- |
| Tipos categoría | `app/backend/src/models/uploadCategory.ts` |
| Lote/item | `app/backend/src/models/materialImportBatch.ts`, `materialImportItem.ts` |
| Errores | `app/backend/src/import/smartUploadErrors.ts` |
| Servicio | `app/backend/src/service/materialImportService.ts` (`smartUpload`) |
| Facade | `app/backend/src/service/platformService.ts` (`smartUpload`, `proposeSyllabusIndex`) |
| Índice IA | `app/backend/src/service/syllabusIndexService.ts`, `generation/mockSyllabusIndexProvider.ts` |
| Migración | `supabase/migrations/028_smart_upload_categories.sql` |
| UI | `app/frontend/src/pages/MaterialPage.tsx` (`SmartUploadForm`), `SyllabusIndexPanel.tsx` |
| Tests | `app/backend/tests/smartUpload.test.ts` |
