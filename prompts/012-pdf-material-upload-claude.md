# Claude Prompt - SPEC 012 PDF Material Upload & Basic Text Extraction

## Context

TESTOPO ya tiene:

- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 010 - Oppositions, Users & Access.
- SPEC 011 - Workspaces & Account Plans.

La jerarquia actual esperada es:

```text
Workspace -> Opposition -> Material / Topic / Question / Test / TestAttempt
```

Ahora necesitamos permitir subir temarios en PDF dentro de una oposicion concreta y convertirlos en `Material` trazable para futuras preguntas.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/012-pdf-material-upload.md
```

Branch de trabajo:

```text
feature/pdf-material-upload
```

## Product Goal

Permitir que owner/admin de workspace, organizacion o usuario Premium propietario suba PDFs dentro de una oposicion, los registre como material, los vincule opcionalmente a temas y extraiga texto basico cuando el PDF tenga texto seleccionable.

El PDF debe ser fuente trazable para preguntas y explicaciones futuras.

## Scope

Implementa:

- Subida de archivos PDF.
- Registro del PDF como `Material`.
- Asociacion obligatoria a `Opposition`.
- Asociacion opcional a uno o varios `Topic`.
- Validacion de permisos por workspace/oposicion.
- Validacion de extension `.pdf`.
- Validacion de MIME type PDF.
- Validacion de tamano maximo razonable, recomendado 50 MB.
- Validacion de archivo no vacio.
- Guardado seguro fuera del repo o en carpeta ignorada por Git.
- Uso de nombre interno seguro, por ejemplo `uploads/materials/<uuid>.pdf`.
- Conservacion de `original_filename`.
- Conservacion de `mime_type`.
- Conservacion de `size_bytes`.
- Conservacion de `storage_path`.
- Campos de extraccion si hacen falta: `file_extension`, `extraction_status`, `extraction_error`, `page_count`, `uploaded_by`.
- Extraccion basica de texto si el PDF tiene texto seleccionable.
- Estados de extraccion: `not_started`, `processing`, `completed`, `failed`, `not_supported`.
- Consulta de detalle de PDF.
- Consulta de texto extraido.
- Listado de PDFs de una oposicion.
- Marcado de PDF como `obsolete`.
- Adaptacion minima del frontend en la pantalla de Material.
- Tests automaticos de reglas criticas.

## Out of Scope

No implementes:

- OCR.
- Lectura de PDFs escaneados por imagen.
- Analisis semantico avanzado.
- Division inteligente automatica por temas.
- Deteccion automatica de articulos legales.
- Comparacion entre versiones de leyes.
- Deteccion automatica de temario obsoleto.
- Resumen automatico.
- Generacion automatica directa de preguntas desde PDF sin revision.
- Visor PDF avanzado con anotaciones.
- Busqueda avanzada dentro del PDF.
- Indexacion vectorial.
- RAG avanzado.
- Permisos complejos por documento.

No conviertas esta spec en procesamiento inteligente de documentos. Solo subida y extraccion basica.

## Business Rules

- Todo PDF debe pertenecer a una oposicion.
- Toda oposicion pertenece a un workspace.
- Solo `owner` o `admin` del workspace/oposicion puede subir PDF.
- Un usuario Premium puede subir PDF dentro de su workspace personal si es `owner`.
- Un `student` no puede subir PDF.
- Un `student` autorizado solo puede ver PDFs `active` de oposiciones autorizadas.
- Los PDFs reales no deben guardarse dentro del repositorio si no es una carpeta ignorada por Git.
- `/uploads` o `/private-materials` deben estar en `.gitignore`.
- `storage_path` es interno y no debe exponerse directamente si puede saltarse permisos.
- Para esta spec solo se aceptan PDFs.
- Si se asocian `topic_ids`, todos deben pertenecer a la misma oposicion que el PDF.
- Si el PDF no tiene texto seleccionable, no implementar OCR: marcar como `not_supported` o `failed` con mensaje claro.
- Si el PDF tiene texto extraible, guardar texto en `content_text`.
- Si no hay `content_text`, la generacion de preguntas desde ese material debe bloquearse con error claro.

## Integration Notes

- Reutiliza el modelo `Material` siempre que sea razonable.
- No crees un modelo paralelo de PDF si `Material` puede representar el archivo con campos adicionales.
- Reutiliza `TopicMaterialLink` o la relacion existente con temas.
- Reutiliza el facade/plataforma de permisos si existe desde SPEC 011.
- No dupliques reglas de acceso en el frontend.
- El frontend debe llamar a servicios/adapters existentes; la logica de permisos debe vivir en backend/servicios.
- Mantén separada la capa de almacenamiento de archivos de la logica de negocio.
- Si anades una dependencia para extraer texto PDF, que sea pequena, justificada y cubierta por tests.
- Si no es viable extraer texto con el stack actual sin complicar demasiado, implementa subida funcional y deja extraccion como servicio preparado/documentado; no simules extraccion.

## Validation Errors

Usa o adapta estos codigos:

- `PDF_OPPOSITION_REQUIRED`
- `PDF_OPPOSITION_NOT_FOUND`
- `PDF_UPLOAD_ACCESS_DENIED`
- `PDF_TITLE_REQUIRED`
- `PDF_TYPE_REQUIRED`
- `PDF_INVALID_MATERIAL_TYPE`
- `PDF_FILE_REQUIRED`
- `PDF_INVALID_FILE_TYPE`
- `PDF_INVALID_MIME_TYPE`
- `PDF_FILE_TOO_LARGE`
- `PDF_FILE_EMPTY`
- `PDF_TOPIC_NOT_FOUND`
- `PDF_TOPIC_OPPOSITION_MISMATCH`
- `PDF_WORKSPACE_ACCESS_DENIED`
- `PDF_STORAGE_FAILED`
- `PDF_EXTRACTION_FAILED`
- `PDF_TEXT_NOT_EXTRACTABLE`
- `MATERIAL_CONTENT_REQUIRED_FOR_GENERATION`

## Frontend Notes

Adaptar la pantalla de Material con una accion clara:

- Boton principal: `Subir PDF`.

Formulario recomendado:

- Titulo.
- Tipo de material.
- Tema relacionado opcional.
- Referencia.
- Archivo PDF.
- Descripcion.

Tras subir, mostrar:

- `PDF subido correctamente.`
- Si hay texto: `Texto extraido correctamente. Ya puedes usar este material para generar preguntas.`
- Si no hay texto: `El PDF se ha subido, pero no se ha podido extraer texto. Puede que sea un PDF escaneado.`

Mantener la UI simple. No crear visor avanzado ni buscador dentro del PDF.

## Required Tests

Anade o actualiza tests para comprobar:

- Un owner/admin puede subir PDF a una oposicion autorizada.
- Un student no puede subir PDF.
- No se puede subir PDF sin oposicion.
- No se puede subir PDF a oposicion inexistente.
- No se puede subir PDF sin titulo.
- No se puede subir PDF sin tipo.
- No se puede subir archivo no PDF.
- No se puede subir PDF vacio.
- No se puede subir PDF demasiado grande.
- El PDF se registra como `Material`.
- El PDF queda asociado a la oposicion correcta.
- El PDF puede asociarse a temas de la misma oposicion.
- No se puede asociar PDF a temas de otra oposicion.
- El archivo se guarda fuera del repo o en carpeta ignorada.
- Se guarda `original_filename`.
- Se guarda `storage_path`.
- Se guarda `mime_type`.
- Se guarda `size_bytes`.
- Se puede listar PDFs de una oposicion.
- Se puede ver detalle de PDF.
- Se puede consultar texto extraido si existe.
- Si el PDF tiene texto extraible, `content_text` se rellena.
- Si el PDF no tiene texto extraible, se marca como `not_supported` o `failed`.
- Se puede marcar PDF como `obsolete`.
- Un estudiante autorizado puede ver material activo.
- Un estudiante no autorizado no puede ver el PDF.
- No se rompen tests existentes de SPEC 001 a SPEC 011.

## Acceptance Criteria

La implementacion esta lista cuando:

- Se pueden subir PDFs.
- Cada PDF se registra como `Material`.
- Cada PDF pertenece a una oposicion.
- Cada PDF queda dentro de un workspace mediante la oposicion.
- Se validan permisos.
- Se validan tipo y tamano de archivo.
- Los PDFs se guardan fuera del repositorio o en carpeta ignorada.
- `.gitignore` protege las carpetas de subida.
- Se conserva metadata basica del archivo.
- Se extrae texto basico si el PDF lo permite.
- Se informa claramente si el texto no puede extraerse.
- El PDF puede vincularse a temas.
- El material PDF puede usarse como fuente para futuras preguntas cuando tenga `content_text`.
- Se puede consultar el material PDF desde admin.
- El estudiante solo ve PDFs activos de oposiciones autorizadas.
- Existen tests automaticos de reglas criticas.
- No se implementa OCR.
- No se implementa analisis semantico avanzado, embeddings ni RAG.
- No se anaden funcionalidades fuera de alcance.

## Expected Output

Claude debe entregar:

- Codigo implementado en `feature/pdf-material-upload`.
- Tests nuevos y existentes pasando.
- `.gitignore` actualizado para proteger PDFs subidos.
- Documentacion breve de almacenamiento, limite de tamano y estrategia de extraccion.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Resumen de cambios.
- Tests ejecutados.
- Dependencias nuevas, si las hay, y por que son necesarias.
- Confirmacion explicita de que no se implemento OCR, RAG, embeddings, resumen automatico, visor avanzado ni generacion directa de preguntas sin revision.
