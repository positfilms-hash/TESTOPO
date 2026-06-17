# Importación de material (SPEC 017)

Notas de límites y decisiones de la importación unificada de temario/material.

## Dónde se gestiona

La gestión principal de material ocurre desde **Temario**: se selecciona un tema
y, en su detalle, se ven sus materiales y se puede **Subir material** (uno o
varios archivos) o **Importar ZIP**. La pantalla **Material** sigue existiendo
como vista global, con menos protagonismo.

## Tipos de archivo permitidos

- `.pdf` — extracción básica de texto (SPEC 012). Sin OCR: si no hay texto
  seleccionable, `extraction_status` queda en `failed`/`not_supported`.
- `.txt`, `.md` — el contenido se guarda directamente en `content_text`.

No permitidos (se omiten o rechazan): `.exe`, `.bat`, `.cmd`, `.sh`, `.js`,
`.html`, `.php`, y cualquier otra extensión. `.docx` queda fuera de esta spec.

## Importación ZIP

- Las **carpetas** crean (o reutilizan) temas; las **subcarpetas**, subtemas.
- Los **archivos** crean materiales asociados al tema de su carpeta.
- Archivos en la raíz del ZIP se asocian al tema seleccionado o, si no hay,
  a un tema automático `Material importado sin clasificar`.
- **Duplicados**: si ya existe un tema con el mismo título bajo el mismo padre,
  se reutiliza; si ya existe un material con el mismo nombre en el tema, se
  **omite** y se reporta en el resumen.

## Límites (MVP)

| Límite | Valor |
| --- | --- |
| Tamaño máximo del ZIP | 200 MB |
| Máximo de archivos por ZIP | 300 |
| Tamaño máximo por archivo | 50 MB |

## Seguridad ZIP

Antes de extraer nada, se valida cada entrada y se **aborta** la importación si
hay rutas inseguras:

- Rutas con `..`, rutas absolutas (`/...`) o estilo Windows (`C:\...`).
- Rutas con `\` (backslash).
- **ZIP anidados** (`.zip` dentro del ZIP) → rechazados.

Las entradas de metadatos de macOS (`__MACOSX/`) se ignoran. Los archivos con
extensión no permitida, duplicados o demasiado grandes se registran como
`skipped`/`failed` en el resumen sin abortar el resto.

## Motor de descompresión

Se usa la librería **fflate** (`unzipSync`/`zipSync`): diminuta, síncrona, sin
dependencias transitivas y compatible con Node y navegador. Es la primera
dependencia runtime del backend, justificada por la necesidad de inflar DEFLATE.
El lector ZIP es inyectable (`ZipReader`), así que puede sustituirse sin tocar la
lógica de importación.

## Trazabilidad

Cada importación crea un `MaterialImportBatch` (resumen: total, importados,
omitidos, fallidos, errores) y un `MaterialImportItem` por archivo (con su ruta
original, material/tema generado y estado). Consultable vía
`PlatformService.getImportBatch`.

## Generación de preguntas

Importar **no** genera preguntas automáticamente. El flujo sigue siendo:
importar → revisar temario y materiales → elegir tema/material → generar →
revisar → aprobar.
