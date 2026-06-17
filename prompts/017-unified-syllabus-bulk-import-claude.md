# Claude Prompt - SPEC 017 Unified Syllabus & Bulk Material Import

## Context

TESTOPO ya tiene temario, material, PDFs, workspaces, oposiciones, permisos y frontend admin/student.

Ahora queremos unir la gestion de temario y material: el administrador o usuario Premium debe gestionar materiales desde cada tema, incluyendo subida individual, subida multiple y ZIP.

La beta readiness se movera a SPEC 018. No implementes beta readiness en esta spec.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/017-unified-syllabus-bulk-import.md
```

Branch de trabajo:

```text
feature/unified-syllabus-bulk-import
```

## Product Goal

Unificar Temario y Material en una experiencia clara:

- El usuario selecciona un tema.
- Ve sus materiales asociados.
- Sube uno o varios archivos al tema.
- Importa un ZIP que crea temas/subtemas y materiales.
- Revisa el resumen de importacion.
- Solo despues decide generar preguntas manualmente.

## Scope

Implementa:

- Vista de temario con materiales asociados.
- Subida de archivo desde un tema.
- Subida multiple de archivos desde un tema.
- Importacion de archivo `.zip`.
- Desglose del ZIP por carpetas.
- Creacion de temas desde carpetas.
- Creacion de subtemas desde subcarpetas.
- Creacion de materiales desde archivos permitidos.
- Asociacion automatica material-tema.
- Modelo `MaterialImportBatch` o equivalente.
- Modelo `MaterialImportItem` o equivalente.
- Resumen de importacion.
- Validaciones de seguridad para ZIP.
- Adaptacion del frontend para que Temario y Material esten unidos.
- Tests automaticos de reglas criticas.

## Out of Scope

No implementes:

- OCR.
- IA avanzada para clasificar documentos.
- Deteccion semantica automatica de temas.
- RAG.
- Embeddings.
- Indexacion vectorial.
- Correccion automatica de estructura del temario.
- Deteccion automatica de leyes obsoletas.
- Generacion masiva automatica de preguntas sin revision.
- Generacion automatica de preguntas tras importar.
- Visor PDF avanzado.
- Drag and drop complejo si no es sencillo.
- Integraciones Google Drive, Dropbox o OneDrive.
- Pagos.
- Limites comerciales reales.
- Beta readiness.
- Funciones grandes fuera del MVP.

## UX Rules

- La gestion principal debe ocurrir desde `Temario`.
- Puede seguir existiendo una vista global de materiales, pero debe tener menos protagonismo.
- Desde un tema se deben ver sus materiales.
- La subida de material debe sentirse parte natural del tema.
- Una accion principal visible por pantalla.
- No saturar con muchos botones.
- Mostrar materiales como tarjetas simples.
- Mostrar estado de extraccion de texto.
- Mostrar estado del material: activo, obsoleto o necesita revision.
- La experiencia debe ser elegante, clara e intuitiva.

## Allowed Files

Permitidos:

- `.pdf`
- `.txt`
- `.md`

Opcional si ya esta soportado:

- `.docx`

No permitidos:

- `.exe`
- `.bat`
- `.cmd`
- `.sh`
- `.js`
- `.html`
- `.php`
- ZIP dentro de ZIP

No procesar ZIPs anidados para el MVP.

## ZIP Security Requirements

La importacion ZIP debe proteger contra:

- Zip Slip.
- Rutas con `../`.
- Rutas absolutas.
- Archivos ocultos peligrosos.
- Archivos demasiado grandes.
- Demasiados archivos.
- Extensiones no permitidas.
- ZIPs anidados.
- Nombres vacios o corruptos.

Limites recomendados:

- Tamano maximo ZIP: 200 MB.
- Maximo archivos por ZIP: 300.
- Tamano maximo por archivo: 50 MB.

Si necesitas limites menores por stack, documentalo.

No escribas archivos fuera del directorio de almacenamiento permitido. Normaliza y valida rutas antes de extraer o guardar.

## ZIP Mapping Rules

- Cada carpeta principal crea o reutiliza un tema.
- Cada subcarpeta crea o reutiliza un subtema.
- Los archivos dentro de una carpeta se asocian al tema/subtema de esa carpeta.
- Los archivos en raiz se asocian al tema seleccionado.
- Si no hay tema seleccionado para archivos en raiz, crear o reutilizar `Material importado sin clasificar`.
- Si ya existe un tema con el mismo titulo bajo el mismo padre, usar el existente.
- Si ya existe un material con el mismo nombre dentro del mismo tema, omitir duplicado y reportarlo en el resumen.
- No limpiar agresivamente nombres de carpetas en esta spec.

## Import Models

Crear `MaterialImportBatch` o similar:

- `id`
- `workspace_id`
- `opposition_id`
- `uploaded_by`
- `status`
- `source_type`
- `original_filename`
- `total_files`
- `imported_files`
- `skipped_files`
- `failed_files`
- `errors`
- `created_at`
- `updated_at`

`source_type`:

- `multi_file`
- `zip`

Puede preparar `folder`, pero no es obligatorio.

`status`:

- `pending`
- `processing`
- `completed`
- `completed_with_errors`
- `failed`

Crear `MaterialImportItem` o similar:

- `id`
- `batch_id`
- `material_id`
- `topic_id`
- `original_path`
- `original_filename`
- `status`
- `error`
- `created_at`
- `updated_at`

`status`:

- `imported`
- `skipped`
- `failed`

## Text Extraction

- PDF: usar extraccion basica de SPEC 012.
- Si PDF no extrae texto: `failed` o `not_supported`.
- TXT/MD: guardar contenido directamente en `content_text`.
- DOCX: solo si ya esta soportado.
- No implementar OCR.

## Permissions

Puede importar:

- `owner`
- `admin`
- usuario Premium en su workspace personal si es `owner`

No puede importar:

- `student`

Reutiliza permisos de workspace/oposicion existentes. No dejes esta regla solo en frontend.

## Question Generation Rule

No generar preguntas automaticamente tras importar.

Flujo correcto:

```text
Importar material
  -> Revisar estructura del temario
  -> Comprobar materiales
  -> Elegir tema o material
  -> Generar preguntas
  -> Revisar preguntas
  -> Aprobar
```

## Validation Errors

Usa o adapta:

- `IMPORT_ACCESS_DENIED`
- `IMPORT_OPPOSITION_REQUIRED`
- `IMPORT_OPPOSITION_NOT_FOUND`
- `IMPORT_TOPIC_NOT_FOUND`
- `IMPORT_TOPIC_OPPOSITION_MISMATCH`
- `IMPORT_FILE_REQUIRED`
- `IMPORT_INVALID_FILE_TYPE`
- `IMPORT_ZIP_REQUIRED`
- `IMPORT_ZIP_TOO_LARGE`
- `IMPORT_ZIP_EMPTY`
- `IMPORT_ZIP_TOO_MANY_FILES`
- `IMPORT_ZIP_UNSAFE_PATH`
- `IMPORT_ZIP_NESTED_NOT_ALLOWED`
- `IMPORT_FILE_TOO_LARGE`
- `IMPORT_FILE_EXTENSION_NOT_ALLOWED`
- `IMPORT_STORAGE_FAILED`
- `IMPORT_EXTRACTION_FAILED`
- `IMPORT_DUPLICATE_SKIPPED`

## Frontend Notes

Modificar zona `Temario`.

Debe incluir:

- Arbol de temas.
- Materiales dentro de cada tema.
- Boton `Anadir tema`.
- Boton `Subir material`.
- Boton `Importar ZIP`.
- Resumen de importacion.
- Estado de extraccion de cada material.

Reducir protagonismo de la pestana separada de `Subir PDF` o `Material`, sin romper funcionalidades existentes.

## Required Tests

Anade o actualiza tests para comprobar:

- Admin puede subir archivo a un tema.
- Student no puede subir archivo a un tema.
- Se pueden subir varios archivos a un tema.
- Cada archivo crea un material.
- Cada material queda asociado al tema correcto.
- Se puede importar ZIP valido.
- El ZIP crea temas desde carpetas.
- El ZIP crea subtemas desde subcarpetas.
- El ZIP crea materiales desde archivos permitidos.
- Archivos en raiz se asocian al tema seleccionado o a `Material importado sin clasificar`.
- No se crean temas duplicados bajo el mismo padre.
- No se importan archivos con extension no permitida.
- No se permite ZIP con rutas `../`.
- No se permite ZIP con rutas absolutas.
- No se permiten ZIPs anidados.
- No se permite ZIP demasiado grande.
- No se permite demasiados archivos.
- Se genera resumen de importacion.
- PDFs usan extraccion basica de texto.
- TXT y MD guardan `content_text`.
- No se generan preguntas automaticamente tras importar.
- No se rompen tests existentes.

## Acceptance Criteria

La implementacion esta lista cuando:

- Temario y material estan integrados en una misma experiencia.
- Desde un tema se puede subir material.
- Desde un tema se pueden subir varios archivos.
- Se puede importar ZIP.
- El ZIP crea temas y subtemas desde carpetas.
- El ZIP crea materiales desde archivos permitidos.
- Los materiales quedan asociados al tema correcto.
- La importacion genera resumen claro.
- Los archivos peligrosos se rechazan.
- No se implementa OCR.
- No se implementa IA avanzada de clasificacion.
- No se generan preguntas automaticamente tras importar.
- La interfaz es mas intuitiva y menos fragmentada.
- Existen tests de reglas criticas.

## Expected Output

Claude debe entregar:

- Codigo implementado en `feature/unified-syllabus-bulk-import`.
- Tests nuevos y existentes pasando.
- Documentacion breve si hay limites o decisiones de importacion.
- Smoke visual/manual de la nueva experiencia de Temario.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Resumen de cambios.
- Tests ejecutados.
- Como probar subida individual, subida multiple y ZIP.
- Decisiones de seguridad ZIP.
- Confirmacion explicita de que no se implemento OCR, IA avanzada, RAG, embeddings, generacion automatica de preguntas, integraciones externas ni beta readiness.
