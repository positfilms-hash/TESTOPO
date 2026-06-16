# Claude Prompt - SPEC 002 Material Upload & Source Registry

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existe la SPEC 001 - Question Bank. Esa spec define que una pregunta validada debe tener una fuente. Esta SPEC 002 debe crear el registro basico de material para que esas fuentes sean trazables, revisables y no obsoletas.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/002-material-upload.md
```

Branch de trabajo:

```text
feature/material-upload
```

## Scope

Crea el modulo basico de carga y registro de material.

Debes implementar:

- Modelo de material/documento, llamado `Material`, `MaterialDocument` o similar segun el estilo actual.
- Tipos permitidos de material:
  - `syllabus`
  - `old_test`
  - `official_exam`
  - `law`
  - `notes`
  - `other`
- Estados permitidos de material:
  - `active`
  - `deprecated`
  - `obsolete`
  - `needs_review`
- Creacion manual de material.
- Registro o subida basica de archivo si el stack lo permite sin complejidad excesiva.
- Listado de materiales.
- Consulta de material por ID.
- Edicion de metadatos y texto.
- Cambio de estado.
- Marcado de material como `obsolete`.
- Relacion basica entre material y `Question.source`.
- Validaciones obligatorias.
- Tests automaticos de reglas criticas.

## Material Model

El modelo debe tener, como minimo:

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

## Question Source Relationship

La SPEC 001 ya tiene el concepto de `source`.

Con esta spec, la fuente de una pregunta debe poder vincularse a material registrado sin romper los tests ni el modelo existente.

Modelo recomendado de fuente de pregunta:

- `id`
- `material_id`
- `title`
- `type`
- `reference`
- `excerpt`
- `status`

Reglas:

- `material_id` debe apuntar al material registrado cuando exista esa relacion.
- `reference` puede indicar pagina, articulo, tema o apartado.
- `excerpt` puede guardar el fragmento concreto que respalda la pregunta.
- `status` debe reflejar si la fuente esta activa, obsoleta o necesita revision.
- Una fuente vinculada a material `obsolete` no debe permitir validar nuevas preguntas, si esta relacion ya se implementa.
- Adapta el `source` existente de SPEC 001 con el minimo cambio posible.
- No rompas los tests existentes del banco de preguntas.

## Out of Scope

No implementes:

- IA.
- Generacion de preguntas.
- Analisis semantico del material.
- Troceado inteligente del temario.
- Mapa completo o inteligente de temas.
- Procesamiento avanzado de PDFs.
- OCR.
- Extraccion avanzada de DOCX.
- Comparacion automatica entre temarios.
- Deteccion automatica de normativa obsoleta.
- Generacion de tests.
- Usuarios.
- Autenticacion.
- Permisos avanzados.
- Panel visual complejo.
- Estadisticas.
- Reportes avanzados.
- Arquitectura compleja de almacenamiento.
- Dependencias innecesarias.

## Business Rules

- Ninguna pregunta debe considerarse valida si no puede vincularse a una fuente concreta, revisable y no obsoleta.
- Las preguntas validadas deberan poder vincularse a una fuente basada en material registrado.
- Un material en estado `obsolete` no debe poder utilizarse para validar nuevas preguntas.
- Si ya existen preguntas vinculadas a un material que pasa a `obsolete`, no hace falta invalidarlas automaticamente en esta spec.
- El material real del usuario no debe guardarse dentro del repositorio.
- La carpeta de subida debe estar protegida por `.gitignore`.
- Debe poder crearse material manualmente sin subir archivo.
- Para el MVP, `.txt` y `.md` pueden guardar contenido en `content_text`.
- Para el MVP, `.pdf` y `.docx` pueden guardarse como archivo pero no es obligatorio extraer texto.
- No implementar OCR.
- No se puede crear material sin `title`, `type` y `status`.

## File Handling

Formatos recomendados inicialmente:

- `.txt`
- `.md`
- `.pdf`
- `.docx`

Si se usa almacenamiento local durante el MVP, debe estar fuera del repositorio o en una carpeta ignorada por Git, por ejemplo:

```text
/private-materials
/uploads
```

No guardes material privado real en el repositorio.

## Validation Errors

La validacion debe devolver errores claros. Usa estos codigos como referencia:

- `MATERIAL_TITLE_REQUIRED`
- `MATERIAL_TYPE_REQUIRED`
- `MATERIAL_INVALID_TYPE`
- `MATERIAL_STATUS_REQUIRED`
- `MATERIAL_INVALID_STATUS`
- `MATERIAL_FILE_TYPE_NOT_ALLOWED`
- `MATERIAL_FILE_TOO_LARGE`

## Required Tests

Incluye tests automaticos para comprobar, como minimo:

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
- No se rompen los tests existentes de SPEC 001.

## Implementation Notes

Adapta la implementacion al stack actual del repositorio.

Prioridades:

- Simplicidad.
- Seguridad del material.
- Trazabilidad.
- Compatibilidad con SPEC 001.
- Validaciones claras.
- Tests automaticos.
- Sin dependencias innecesarias.

Si el stack todavia no tiene sistema de archivos o backend claro, implementa la parte de modelo, validacion y servicios de forma simple, dejando la subida fisica de archivos preparada pero no sobredisendada.

No crees una arquitectura compleja de almacenamiento todavia.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar los tests.
- Confirmacion explicita de que no has implementado IA, generacion de preguntas, procesamiento avanzado de PDFs, OCR, usuarios, autenticacion, panel complejo, generacion de tests ni estadisticas.
- Confirmacion de que el material puede actuar como fuente trazable para preguntas.
- Confirmacion de que no se rompen los tests de SPEC 001.
- Cualquier decision tecnica minima tomada para mantener compatibilidad con el stack actual.
