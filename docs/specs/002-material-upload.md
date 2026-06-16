# SPEC 002 - Material Upload & Source Registry

## 1. Objetivo

Crear el modulo basico de carga y registro de material del proyecto TESTOPO.

Este modulo debe permitir anadir material de estudio al sistema, clasificarlo y dejarlo disponible como fuente para futuras preguntas.

El objetivo de esta spec no es generar preguntas todavia. El objetivo es preparar una base fiable para que cada pregunta pueda estar vinculada a un material concreto.

## 2. Contexto MVP

TESTOPO es una app para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existe la SPEC 001 - Question Bank, que define que toda pregunta validada debe tener una fuente.

Esta SPEC 002 crea el sistema basico para gestionar esas fuentes.

Principio central:

> Ninguna pregunta debe considerarse valida si no puede vincularse a una fuente concreta, revisable y no obsoleta.

## 3. Branch recomendada

```text
feature/material-upload
```

## 4. Alcance

Claude debe implementar un modulo basico para gestionar material.

Debe incluir:

- Modelo de material/documento.
- Estados del material.
- Tipos de material.
- Creacion manual de material.
- Carga basica de archivo, si el stack ya lo permite.
- Listado de materiales.
- Consulta de un material.
- Edicion de metadatos.
- Cambio de estado del material.
- Marcado de material como obsoleto.
- Relacion basica entre material y fuente de pregunta.
- Tests automaticos de las reglas criticas.

## 5. Fuera de alcance

No debe implementarse todavia:

- Generacion de preguntas con IA.
- Analisis semantico del material.
- Troceado inteligente del temario.
- Mapa completo de temas.
- Procesamiento avanzado de PDFs.
- OCR.
- Extraccion avanzada de DOCX.
- Comparacion automatica entre temarios.
- Deteccion automatica de normativa obsoleta.
- Sistema de usuarios.
- Permisos avanzados.
- Panel visual complejo.
- Generacion de tests.
- Estadisticas.

Esta spec solo cubre la carga y registro basico del material.

## 6. Modelo de material

Crear un modelo llamado, segun el estilo del proyecto, `Material`, `MaterialDocument` o similar.

Campos minimos:

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

## 7. Descripcion de campos

### id

Identificador unico del material.

### title

Titulo legible del documento.

Ejemplos:

- Tema 1 - Constitucion Espanola
- Test oficial 2022
- Ley 39/2015
- Apuntes procedimiento administrativo

Debe ser obligatorio.

### description

Descripcion opcional del material.

### type

Tipo de material.

Valores permitidos:

- `syllabus`
- `old_test`
- `official_exam`
- `law`
- `notes`
- `other`

Debe ser obligatorio.

### status

Estado del material.

Valores permitidos:

- `active`
- `deprecated`
- `obsolete`
- `needs_review`

Estado inicial recomendado:

- `active`

### original_filename

Nombre original del archivo subido.

Puede estar vacio si el material se crea manualmente.

### mime_type

Tipo del archivo.

Puede estar vacio si el material se crea manualmente.

### size_bytes

Tamano del archivo.

Puede estar vacio si el material se crea manualmente.

### storage_path

Ruta interna donde se guarda el archivo.

Debe evitarse guardar archivos reales dentro del repositorio si contienen material privado.

Si se usa almacenamiento local durante el MVP, debe estar en una carpeta ignorada por Git, por ejemplo:

```text
/private-materials
/uploads
```

### content_text

Texto del material.

Para el MVP debe permitirse al menos introducir texto manualmente.

Si se sube un `.txt` o `.md`, puede extraerse su contenido automaticamente si es sencillo.

Para PDF o DOCX, puede guardarse el archivo y dejar `content_text` vacio o pendiente de extraccion.

### reference

Referencia interna opcional.

Ejemplos:

- Tema 1
- Articulo 14
- Pagina 23
- Examen oficial 2021

## 8. Reglas de negocio

### 8.1 Material obligatorio para fuentes futuras

Las preguntas validadas deberan poder vincularse a una fuente basada en un material registrado.

No es necesario rehacer por completo la SPEC 001, pero Claude debe preparar una relacion clara entre `Question.source` y el nuevo modelo de material.

### 8.2 Material obsoleto

Un material en estado `obsolete` no debe poder utilizarse para validar nuevas preguntas.

Si ya existen preguntas vinculadas a un material que pasa a `obsolete`, no hace falta invalidarlas automaticamente en esta spec, pero debe quedar preparado para futuras revisiones.

### 8.3 Material privado

El material real del usuario no debe guardarse en el repositorio.

La carpeta de subida debe estar en `.gitignore`.

### 8.4 Creacion manual

Debe poder crearse material manualmente sin subir archivo.

Esto permite pegar texto directamente y avanzar con el MVP aunque todavia no exista procesamiento avanzado de PDFs.

### 8.5 Archivos permitidos en MVP

Formatos recomendados para aceptar inicialmente:

- `.txt`
- `.md`
- `.pdf`
- `.docx`

Regla importante:

`.txt` y `.md` pueden guardar contenido en `content_text`.

`.pdf` y `.docx` pueden guardarse como archivo, pero no es obligatorio extraer texto todavia.

No implementar OCR.

### 8.6 Metadatos obligatorios

No se puede crear material sin:

- `title`
- `type`
- `status`

## 9. Operaciones minimas

Claude debe implementar estas operaciones segun el stack existente.

### 9.1 Crear material manual

Debe permitir crear material con:

- Titulo.
- Descripcion.
- Tipo.
- Estado.
- Texto manual.
- Referencia.

### 9.2 Subir archivo

Debe permitir registrar un archivo como material, si el stack lo permite sin anadir complejidad excesiva.

Debe guardar:

- Nombre original.
- Tipo MIME.
- Tamano.
- Ruta interna.
- Tipo de material.
- Estado.
- Titulo.

Si el archivo es `.txt` o `.md`, puede llenar `content_text`.

Si el archivo es `.pdf` o `.docx`, puede quedar pendiente de extraccion.

### 9.3 Listar materiales

Debe permitir obtener materiales registrados.

Filtros recomendados:

- Por tipo.
- Por estado.

### 9.4 Ver material

Debe permitir consultar un material por ID.

### 9.5 Editar material

Debe permitir editar:

- Titulo.
- Descripcion.
- Tipo.
- Estado.
- Texto.
- Referencia.

Debe actualizar `updated_at`.

### 9.6 Cambiar estado

Debe permitir cambiar el estado de un material.

Si el estado pasa a `obsolete`, debe quedar reflejado claramente.

### 9.7 Eliminar o archivar material

Para el MVP es preferible no borrar fisicamente material salvo que sea sencillo y seguro.

Recomendacion:

- Implementar cambio de estado a `obsolete`.
- Dejar borrado fisico fuera de alcance salvo que el stack ya lo tenga resuelto.

## 10. Relacion con Question Bank

La SPEC 001 ya define que una pregunta debe tener `source`.

Con esta spec, `source` debe poder vincularse a un material registrado.

Modelo recomendado de fuente de pregunta:

- `id`
- `material_id`
- `title`
- `type`
- `reference`
- `excerpt`
- `status`

Donde:

- `material_id` apunta al material.
- `reference` indica pagina, articulo, tema o apartado.
- `excerpt` puede guardar el fragmento concreto que respalda la pregunta.
- `status` debe reflejar si la fuente esta activa, obsoleta o necesita revision.

Si el modelo actual de SPEC 001 ya tiene `source`, Claude debe adaptarlo con el minimo cambio posible y sin romper tests existentes.

## 11. Validaciones minimas

No se puede crear material si:

- Falta titulo.
- Falta tipo.
- El tipo no esta permitido.
- Falta estado.
- El estado no esta permitido.
- Se intenta subir un archivo no permitido.
- El archivo supera el limite definido, si existe limite.

Errores recomendados:

- `MATERIAL_TITLE_REQUIRED`
- `MATERIAL_TYPE_REQUIRED`
- `MATERIAL_INVALID_TYPE`
- `MATERIAL_STATUS_REQUIRED`
- `MATERIAL_INVALID_STATUS`
- `MATERIAL_FILE_TYPE_NOT_ALLOWED`
- `MATERIAL_FILE_TOO_LARGE`

## 12. Tests automaticos obligatorios

Deben existir tests para comprobar:

- Se puede crear material manual en estado `active`.
- No se puede crear material sin titulo.
- No se puede crear material con tipo invalido.
- No se puede crear material con estado invalido.
- Se puede listar materiales.
- Se puede consultar un material por ID.
- Se puede editar un material.
- Al editar material se actualiza `updated_at`.
- Se puede marcar material como `obsolete`.
- Una fuente vinculada a material `obsolete` no debe permitir validar nuevas preguntas, si esta relacion ya se implementa.
- No se rompen los tests existentes de la SPEC 001.

## 13. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe un modelo de material.
- Existen tipos controlados de material.
- Existen estados controlados de material.
- Se puede crear material manual.
- Se puede registrar un archivo como material, si el stack lo permite.
- Se puede listar material.
- Se puede consultar material.
- Se puede editar material.
- Se puede marcar material como obsoleto.
- El material puede actuar como fuente para preguntas.
- No se guarda material privado dentro del repositorio.
- `.gitignore` protege carpetas de subida.
- Existen tests de reglas criticas.
- No se implementa IA.
- No se implementa generacion de preguntas.
- No se implementa procesamiento avanzado de PDFs.
- No se anaden funcionalidades fuera del MVP.

## 14. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del repositorio.

Prioridades:

- Simplicidad.
- Seguridad del material.
- Trazabilidad.
- Compatibilidad con SPEC 001.
- Validaciones claras.
- Tests automaticos.
- Sin dependencias innecesarias.

Si el stack todavia no tiene sistema de archivos o backend claro, implementar la parte de modelo, validacion y servicios de forma simple, dejando la subida fisica de archivos preparada pero no sobredisendada.

No crear una arquitectura compleja de almacenamiento todavia.

## 15. Prompt para Claude

Claude, implementa la SPEC 002 - Material Upload & Source Registry.

Estamos construyendo el MVP de TESTOPO.

Debes crear el modulo basico de carga y registro de material para que el sistema pueda guardar temarios, tests antiguos, examenes oficiales, leyes, apuntes y otros documentos.

Implementa:

- Modelo de material.
- Tipos permitidos de material.
- Estados permitidos.
- Creacion manual de material.
- Registro o subida basica de archivo si el stack lo permite.
- Listado de materiales.
- Consulta de material por ID.
- Edicion de material.
- Cambio de estado.
- Marcado como obsoleto.
- Relacion basica entre material y `source` de preguntas.
- Validaciones obligatorias.
- Tests automaticos.

No implementes todavia:

- IA.
- Generacion de preguntas.
- Procesamiento avanzado de PDFs.
- OCR.
- Mapa inteligente del temario.
- Generacion de tests.
- Usuarios.
- Autenticacion.
- Panel visual complejo.
- Estadisticas.

Regla central:

El material registrado debe servir como base trazable para futuras preguntas. Una pregunta validada debera poder justificarse con una fuente vinculada a material activo y revisable.

Manten la implementacion simple, modular y compatible con la SPEC 001. No rompas los tests existentes del banco de preguntas.
