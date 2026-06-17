# SPEC 012 - PDF Material Upload & Basic Text Extraction

## 1. Objetivo

Permitir la subida de material en formato PDF dentro de TESTOPO.

El objetivo es que un administrador, organizacion o usuario Premium pueda subir temarios, leyes, tests antiguos o examenes oficiales en PDF, asociarlos a una oposicion concreta y dejarlos disponibles como fuente para generar preguntas.

Esta spec debe mejorar la SPEC 002 - Material Upload & Source Registry, anadiendo soporte especifico para PDFs.

## 2. Contexto del producto

TESTOPO permite crear tests randomizados de oposiciones a partir de material aportado por el usuario.

La estructura actual del producto debe ser:

```text
Workspace
  -> Opposition
      -> Material
      -> Topic
      -> Question
      -> Test
      -> TestAttempt
```

Los PDFs deben quedar asociados a una oposicion concreta y, opcionalmente, a uno o varios temas.

Principio central:

```text
El PDF no es solo un archivo subido. Debe convertirse en una fuente trazable para preguntas, explicaciones y revision humana.
```

## 3. Branch recomendada

```text
feature/pdf-material-upload
```

## 4. Alcance

Claude debe implementar:

- Subida de archivos PDF.
- Registro del PDF como `Material`.
- Asociacion obligatoria del PDF a una `Opposition`.
- Asociacion opcional del PDF a uno o varios `Topic`.
- Guardado seguro del archivo fuera del repositorio.
- Extraccion basica de texto del PDF, si es tecnicamente viable con el stack actual.
- Estado de extraccion del texto.
- Vista o consulta basica del material PDF.
- Validaciones de tipo, tamano y permisos.
- Tests automaticos de reglas criticas.
- Adaptacion minima del frontend para subir PDFs.

## 5. Fuera de alcance

No implementar todavia:

- OCR.
- Lectura de PDFs escaneados mediante imagen.
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

Esta spec solo cubre subida y extraccion basica de texto.

## 6. Relacion con specs anteriores

### SPEC 002 - Material Upload & Source Registry

El PDF debe registrarse como `Material`.

Debe aprovechar el modelo existente de material:

- `id`
- `title`
- `description`
- `type`
- `status`
- `original_filename`
- `mime_type`
- `size_bytes`
- `storage_path`
- `content_text`
- `reference`
- `created_at`
- `updated_at`

Esta spec puede anadir campos si son necesarios.

### SPEC 003 - Topic Map

El PDF puede vincularse a uno o varios temas.

Ejemplo:

- PDF: `Tema 1 Constitucion Espanola.pdf`
- Tema vinculado: `Tema 1 - Constitucion Espanola`

### SPEC 010 - Oppositions, Users & Access

El PDF debe pertenecer a una oposicion.

Un usuario solo puede subir PDF si tiene permisos dentro de esa oposicion.

### SPEC 011 - Workspaces & Account Plans

La oposicion pertenece a un workspace.

El usuario debe tener rol adecuado dentro del workspace para subir material.

## 7. Modelo de material PDF

Ampliar el modelo `Material` si es necesario.

Campos recomendados adicionales:

- `file_extension`
- `extraction_status`
- `extraction_error`
- `page_count`
- `uploaded_by`
- `opposition_id`

### file_extension

Para esta spec:

- `pdf`

### extraction_status

Estado de extraccion de texto.

Valores permitidos:

- `not_started`
- `processing`
- `completed`
- `failed`
- `not_supported`

Estado inicial recomendado:

- `not_started`

### extraction_error

Mensaje o codigo de error si la extraccion falla.

No debe contener datos sensibles innecesarios.

### page_count

Numero de paginas del PDF, si se puede obtener facilmente.

### uploaded_by

Usuario que subio el archivo.

### opposition_id

Oposicion a la que pertenece el material.

Debe ser obligatorio.

## 8. Tipos de material admitidos para PDF

El campo `type` de material debe seguir usando los valores de la SPEC 002:

- `syllabus`
- `old_test`
- `official_exam`
- `law`
- `notes`
- `other`

Ejemplos:

- Temario oficial en PDF -> `syllabus`
- Test antiguo en PDF -> `old_test`
- Examen oficial en PDF -> `official_exam`
- Ley en PDF -> `law`
- Apuntes en PDF -> `notes`

## 9. Reglas de almacenamiento

### 9.1 No guardar PDFs en el repositorio

Los PDFs reales pueden contener material privado o protegido.

Deben guardarse fuera del repositorio o en una carpeta ignorada por Git.

Carpetas recomendadas:

- `/uploads`
- `/private-materials`

Estas rutas deben estar en `.gitignore`.

### 9.2 Ruta interna

El campo `storage_path` debe guardar la ruta interna del archivo.

No debe exponerse directamente al estudiante si eso supone riesgo de acceso no autorizado.

### 9.3 Nombre de archivo

Debe conservarse `original_filename`, pero el archivo guardado internamente deberia usar un nombre seguro.

Ejemplo:

```text
original_filename: Tema 1 Constitucion.pdf
storage_path: uploads/materials/uuid.pdf
```

### 9.4 Archivos permitidos

Para esta spec solo se permite:

- `.pdf`

No ampliar a otros formatos en esta tarea.

### 9.5 Tamano maximo

Definir un tamano maximo razonable para MVP.

Recomendacion inicial:

- 50 MB

Si el stack ya tiene limite diferente, documentarlo.

## 10. Extraccion basica de texto

### 10.1 Objetivo

Extraer texto del PDF cuando el archivo tenga texto seleccionable.

Ejemplos validos:

- PDF generado desde Word.
- PDF oficial con texto embebido.
- Temario exportado como PDF digital.

Ejemplos no cubiertos:

- PDF escaneado como imagen.
- Fotografias convertidas a PDF.
- Documentos que requieren OCR.

### 10.2 Resultado

Si la extraccion funciona:

- `content_text = texto extraido del PDF`
- `extraction_status = completed`

Si falla:

- `content_text = vacio o texto parcial`
- `extraction_status = failed`
- `extraction_error = codigo o mensaje controlado`

Si el PDF no contiene texto extraible:

- `extraction_status = not_supported`

### 10.3 Texto parcial

Si se extrae texto parcial, puede guardarse, pero debe quedar reflejado.

Opcional:

- `extraction_status = completed`

o:

- `extraction_status = completed_with_warnings`

Para el MVP, si se quiere evitar anadir mas estados, usar `completed` y guardar advertencia en `extraction_error` o metadatos.

### 10.4 No OCR

No implementar OCR.

Si el PDF no tiene texto seleccionable, mostrar mensaje claro:

```text
Este PDF parece escaneado o no contiene texto extraible. La extraccion automatica no esta disponible en esta version.
```

## 11. Permisos

### 11.1 Quien puede subir PDF

Puede subir PDF:

- `owner`
- `admin`

dentro del workspace/oposicion correspondiente.

Tambien puede subir PDF un usuario Premium dentro de su workspace personal si tiene rol:

- `owner`

### 11.2 Quien puede ver PDF

Puede ver material PDF:

- Owner/admin dentro del workspace.
- Student con acceso a la oposicion, solo si el material esta `active`.

### 11.3 Quien puede editar metadatos

Puede editar metadatos:

- `owner`
- `admin`

No puede editar metadatos:

- `student`

### 11.4 Quien puede marcar PDF como obsoleto

Puede marcar como obsoleto:

- `owner`
- `admin`

## 12. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 12.1 Subir PDF

Entrada:

- `opposition_id`
- `title`
- `description`
- `type`
- `reference`
- `topic_ids`
- `file`

Debe:

1. Validar permisos.
2. Validar oposicion.
3. Validar archivo PDF.
4. Guardar archivo.
5. Crear registro `Material`.
6. Asociarlo a oposicion.
7. Asociarlo a temas si se proporcionan.
8. Iniciar extraccion basica de texto o dejarla lista para ejecutarse.
9. Guardar resultado de extraccion.

### 12.2 Listar PDFs de una oposicion

Debe permitir listar materiales PDF de una oposicion.

Filtros recomendados:

- `status`
- `type`
- `topic_id`
- `extraction_status`

### 12.3 Ver detalle de PDF

Debe permitir consultar:

- `title`
- `description`
- `type`
- `status`
- `original_filename`
- `size_bytes`
- `page_count`
- `extraction_status`
- `reference`
- `topics`
- `created_at`
- `updated_at`

No mostrar informacion sensible innecesaria.

### 12.4 Ver texto extraido

Debe permitir consultar `content_text` si existe.

Para estudiantes, solo si tienen acceso a la oposicion y el material esta `active`.

### 12.5 Descargar o abrir PDF

Si el stack lo permite, permitir acceder al archivo PDF de forma controlada.

No exponer directamente rutas internas.

Si no se implementa descarga todavia, debe quedar documentado.

### 12.6 Reintentar extraccion

Permitir reintentar extraccion de texto si:

- `extraction_status = failed`

o:

- `extraction_status = not_supported`

Para el MVP, esta operacion es recomendable pero no obligatoria si complica demasiado.

### 12.7 Editar metadatos

Permitir editar:

- `title`
- `description`
- `type`
- `status`
- `reference`
- `topic_ids`

### 12.8 Marcar PDF como obsoleto

Debe cambiar `status` a:

- `obsolete`

No borrar fisicamente el archivo en esta spec.

## 13. Relacion con generacion de preguntas

Las preguntas generadas a partir de PDF deben usar el `Material` del PDF como fuente.

Si el PDF tiene `content_text`, podra utilizarse en la SPEC 004 para generar preguntas desde material.

Si no tiene `content_text`, el sistema debe bloquear la generacion automatica y mostrar un error claro.

Error recomendado:

- `MATERIAL_CONTENT_REQUIRED_FOR_GENERATION`

## 14. Validaciones minimas

No se puede subir PDF si:

- Falta `opposition_id`.
- La oposicion no existe.
- El usuario no tiene permisos.
- Falta titulo.
- Falta tipo.
- El tipo no esta permitido.
- No se adjunta archivo.
- El archivo no es PDF.
- El MIME type no corresponde a PDF.
- El archivo supera el tamano maximo.
- El archivo esta vacio.
- Se intenta asociar a temas de otra oposicion.
- Se intenta subir dentro de un workspace no autorizado.

Errores recomendados:

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

## 15. Cambios minimos en frontend

Adaptar la pantalla de Material.

Debe permitir:

- Boton principal: Subir PDF.
- Seleccionar oposicion actual.
- Anadir titulo.
- Elegir tipo de material.
- Asociar tema opcional.
- Subir archivo.
- Ver estado de extraccion.

Formulario recomendado:

- Titulo
- Tipo de material
- Tema relacionado
- Referencia
- Archivo PDF
- Descripcion

Despues de subir, mostrar un mensaje claro:

```text
PDF subido correctamente.
```

Si se extrae texto:

```text
Texto extraido correctamente. Ya puedes usar este material para generar preguntas.
```

Si no se puede extraer texto:

```text
El PDF se ha subido, pero no se ha podido extraer texto. Puede que sea un PDF escaneado.
```

## 16. Tests automaticos obligatorios

Deben existir tests para comprobar:

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
- El archivo se guarda fuera del repositorio o en carpeta ignorada.
- Se guarda `original_filename`.
- Se guarda `storage_path`.
- Se guarda `mime_type`.
- Se guarda `size_bytes`.
- Se puede listar PDFs de una oposicion.
- Se puede ver detalle de PDF.
- Se puede consultar texto extraido si existe.
- Si el PDF tiene texto extraible, `content_text` se rellena.
- Si el PDF no tiene texto extraible, se marca como no soportado o fallido.
- Se puede marcar PDF como `obsolete`.
- Un estudiante autorizado puede ver material activo.
- Un estudiante no autorizado no puede ver el PDF.
- No se rompen tests existentes de SPEC 001 a SPEC 011.

## 17. Criterios de aceptacion

La tarea se considera completada cuando:

- Se pueden subir PDFs.
- Cada PDF se registra como `Material`.
- Cada PDF pertenece a una oposicion.
- Cada PDF queda dentro de un workspace mediante la oposicion.
- Se validan permisos.
- Se validan tipo y tamano de archivo.
- Los PDFs se guardan fuera del repositorio o en carpeta ignorada.
- Se conserva metadata basica del archivo.
- Se extrae texto basico si el PDF lo permite.
- Se informa claramente si el texto no puede extraerse.
- El PDF puede vincularse a temas.
- El material PDF puede usarse como fuente para futuras preguntas.
- Se puede consultar el material PDF desde admin.
- El estudiante solo ve PDFs activos de oposiciones autorizadas.
- Existen tests automaticos de reglas criticas.
- No se implementa OCR.
- No se implementa analisis semantico avanzado.
- No se anaden funcionalidades fuera del MVP.

## 18. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del proyecto.

Prioridades:

- Mantener compatibilidad con SPEC 002.
- No crear un modelo paralelo innecesario si `Material` ya sirve.
- No guardar PDFs reales en el repositorio.
- Centralizar validaciones de permisos.
- Mantener separacion entre almacenamiento y logica de negocio.
- No implementar OCR.
- No implementar RAG ni embeddings todavia.
- Anadir tests de permisos, tipo de archivo y extraccion.
- Si el stack no tiene libreria de extraccion PDF, Claude puede anadir una dependencia sencilla y justificada.
- Si anadir dependencia complica demasiado el proyecto, debe dejar subida de PDF funcional y extraccion como servicio preparado/documentado, pero no fingir que extrae texto.

## 19. Prompt para Claude

Claude, implementa la SPEC 012 - PDF Material Upload & Basic Text Extraction.

Queremos permitir que administradores, organizaciones y usuarios Premium suban temarios en PDF dentro de una oposicion concreta.

Debes implementar:

- Subida de PDF.
- Registro del PDF como `Material`.
- Asociacion obligatoria a `Opposition`.
- Asociacion opcional a `Topic`.
- Validacion de permisos por workspace/oposicion.
- Validacion de tipo de archivo.
- Validacion de tamano.
- Guardado seguro fuera del repositorio o en carpeta ignorada.
- Metadata del archivo: nombre original, MIME type, tamano, ruta interna.
- Extraccion basica de texto si el PDF tiene texto seleccionable.
- Estados de extraccion.
- Consulta de detalle del PDF.
- Consulta de texto extraido.
- Marcado de PDF como obsoleto.
- Adaptacion minima del frontend en la pantalla de Material.
- Tests automaticos de reglas criticas.

No implementes todavia:

- OCR.
- Lectura de PDFs escaneados.
- Analisis semantico avanzado.
- Indexacion vectorial.
- RAG.
- Resumen automatico.
- Generacion automatica directa de preguntas sin revision.
- Visor PDF avanzado.
- Permisos complejos por documento.

Reglas centrales:

1. Todo PDF debe pertenecer a una oposicion.
2. La oposicion pertenece a un workspace.
3. Solo owner/admin o usuario Premium propietario puede subir PDF.
4. El estudiante solo puede ver PDFs activos de oposiciones autorizadas.
5. Los PDFs no deben guardarse dentro del repositorio.
6. La extraccion basica solo debe funcionar si el PDF contiene texto seleccionable.
7. No implementar OCR en esta spec.

Manten la implementacion simple, segura y compatible con SPEC 001 a SPEC 011. No rompas tests existentes.
