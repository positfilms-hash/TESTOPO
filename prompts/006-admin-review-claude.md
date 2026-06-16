# Claude Prompt - SPEC 006 Admin Review

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.

La SPEC 004 genera preguntas candidatas. La SPEC 005 detecta errores y recomienda estados. Esta SPEC 006 debe permitir que una persona tome la decision final sobre una pregunta.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/006-admin-review.md
```

Branch de trabajo:

```text
feature/admin-review
```

## Critical Rule

Solo una accion explicita de revision puede pasar una pregunta a `validated`.

Antes de aprobar, debes ejecutar o consultar la validacion de SPEC 005. Si hay errores criticos, la aprobacion debe bloquearse.

Nunca deben convertir una pregunta directamente en `validated`:

- Generacion automatica.
- Validacion automatica.
- Edicion.
- Marcado como `pending_review`.
- Devolucion desde `needs_fix`.

## Scope

Implementa el flujo minimo de revision humana:

- Listado de preguntas para revision.
- Filtros basicos por estado.
- Filtros por dificultad.
- Filtros por tema, si existe integracion con `Topic`.
- Detalle completo de pregunta para revision.
- Consulta de fuente y material asociado.
- Consulta del ultimo informe de validacion.
- Edicion de pregunta desde revision.
- Accion de aprobar pregunta.
- Accion de rechazar pregunta.
- Accion de marcar como `needs_fix`.
- Accion de marcar como `obsolete`.
- Accion de devolver a `pending_review`.
- Modelo o registro basico de revision.
- Validaciones obligatorias antes de aprobar.
- Tests automaticos de reglas criticas.

## Existing Integration Requirements

Conecta con:

- SPEC 001: reutiliza `Question`, estados y `QuestionService`.
- SPEC 002: muestra o resuelve fuente/material asociado cuando exista `source.material_id`.
- SPEC 003: muestra o resuelve tema asociado cuando exista `topic_id`.
- SPEC 004: las preguntas generadas deben poder entrar al flujo de revision.
- SPEC 005: reutiliza el validador y sus informes para aprobar o bloquear aprobaciones.

No dupliques modelos de pregunta.

No dupliques logica de validacion.

No rompas tests existentes de SPEC 001, SPEC 002, SPEC 003, SPEC 004 y SPEC 005.

## Review Model

Crea un modelo llamado `QuestionReview`, `ReviewLog` o similar.

Campos minimos:

- `id`
- `question_id`
- `action`
- `previous_status`
- `new_status`
- `reviewer_name`
- `notes`
- `validation_result_id`
- `created_at`

Acciones permitidas:

- `approve`
- `reject`
- `mark_needs_fix`
- `mark_obsolete`
- `edit`
- `return_to_pending_review`

Para MVP, si no hay usuarios, `reviewer_name` puede ser texto opcional.

Notas son opcionales en general, pero recomendables en:

- `reject`
- `mark_needs_fix`
- `mark_obsolete`

## Required Operations

### List Questions For Review

Por defecto debe listar preguntas con estados:

- `draft`
- `pending_review`
- `needs_fix`

No incluir por defecto:

- `validated`
- `rejected`
- `obsolete`

salvo que se pidan explicitamente con filtro.

Filtros recomendados:

- Estado.
- Dificultad.
- Tema.
- Fuente o material, si es sencillo.
- Texto de busqueda, si es sencillo.

### Review Detail

Debe devolver:

- Enunciado.
- Opciones.
- Respuesta correcta.
- Explicacion.
- Fuente.
- Material asociado.
- Tema.
- Dificultad.
- Estado.
- Ultimo informe de validacion.
- Historial basico de revision, si existe.

### Edit From Review

Debe permitir editar:

- Enunciado.
- Opciones.
- Respuesta correcta.
- Explicacion.
- Fuente.
- Tema.
- Dificultad.

Reglas:

- Actualizar `updated_at`.
- Registrar accion `edit`.
- No convertir nunca a `validated`.
- Dejar en `pending_review` o `draft` segun estado previo y validez formal.

### Approve Question

Debe cambiar a:

- `validated`

solo si:

- La accion es explicita.
- La validacion de SPEC 005 se ejecuta o consulta.
- No hay errores criticos.
- No viene directamente de `rejected` u `obsolete`.

Debe registrar accion `approve`.

Si hay warnings sin errores, la aprobacion puede permitirse, pero debe devolver o conservar las advertencias.

### Reject Question

Debe cambiar a:

- `rejected`

Debe registrar accion `reject`.

### Mark Needs Fix

Debe cambiar a:

- `needs_fix`

Debe registrar accion `mark_needs_fix`.

### Mark Obsolete

Debe cambiar a:

- `obsolete`

Debe registrar accion `mark_obsolete`.

### Return To Pending Review

Debe permitir pasar desde:

- `needs_fix`
- `draft`
- `rejected`

a:

- `pending_review`

Solo si cumple validaciones formales minimas.

Debe registrar accion `return_to_pending_review`.

## Approval Rules

Una pregunta solo puede aprobarse si:

- Tiene enunciado.
- Tiene opciones.
- Tiene exactamente una respuesta correcta.
- Tiene explicacion.
- Tiene fuente.
- Tiene tema.
- Tiene dificultad valida.
- No esta asociada a fuente obsoleta.
- No esta asociada a material obsoleto.
- No esta asociada a tema obsoleto, si existe `topic_id`.
- No tiene errores criticos pendientes en el ultimo informe de validacion.

Bloquear:

- `draft -> validated`.
- `needs_fix -> validated`.
- `rejected -> validated`.
- `obsolete -> validated`.

Para MVP, estas transiciones deben pasar primero por `pending_review`.

## Recommended Errors

Usa errores claros. Codigos recomendados:

- `QUESTION_REVIEW_NOT_FOUND`
- `QUESTION_REVIEW_INVALID_ACTION`
- `QUESTION_REVIEW_VALIDATION_REQUIRED`
- `QUESTION_REVIEW_APPROVAL_BLOCKED`
- `QUESTION_REVIEW_NOTES_REQUIRED`
- `QUESTION_REVIEW_INVALID_STATUS_TRANSITION`
- `QUESTION_OBSOLETE_CANNOT_BE_VALIDATED`
- `QUESTION_REJECTED_REQUIRES_REVIEW_REOPEN`
- `QUESTION_NOT_FOUND`
- `QUESTION_SOURCE_OBSOLETE`
- `QUESTION_SOURCE_MATERIAL_OBSOLETE`
- `QUESTION_TOPIC_OBSOLETE`

Tambien reutiliza errores de SPEC 001 y SPEC 005 cuando correspondan.

## Out of Scope

No implementes:

- Frontend visual avanzado.
- Sistema completo de usuarios.
- Roles y permisos complejos.
- Auditoria avanzada.
- Comentarios colaborativos.
- Asignacion de revisores.
- Historial visual completo.
- Notificaciones.
- Estadisticas avanzadas.
- Generacion de tests.
- Simulacros.
- Gamificacion.
- Pagos.
- Marketplace.

## Required Tests

Incluye tests automaticos para comprobar:

- Se pueden listar preguntas pendientes de revision.
- Se puede consultar el detalle de una pregunta para revision.
- Se puede editar una pregunta desde revision.
- Editar una pregunta no la convierte en `validated`.
- Se registra una accion `edit`.
- Se puede aprobar una pregunta valida.
- Aprobar una pregunta registra una accion `approve`.
- No se puede aprobar una pregunta sin enunciado.
- No se puede aprobar una pregunta sin explicacion.
- No se puede aprobar una pregunta sin fuente.
- No se puede aprobar una pregunta sin tema.
- No se puede aprobar una pregunta sin dificultad.
- No se puede aprobar una pregunta con mas de una respuesta correcta.
- No se puede aprobar una pregunta con fuente obsoleta.
- No se puede aprobar una pregunta con material obsoleto, si existe relacion.
- No se puede aprobar una pregunta con tema obsoleto, si existe relacion.
- No se puede pasar directamente de `rejected` a `validated`.
- No se puede pasar directamente de `obsolete` a `validated`.
- Se puede rechazar una pregunta.
- Se puede marcar una pregunta como `needs_fix`.
- Se puede marcar una pregunta como `obsolete`.
- Se puede devolver una pregunta a `pending_review`.
- Cada accion relevante crea un registro de revision.
- No se rompen los tests existentes de SPEC 001, SPEC 002, SPEC 003, SPEC 004 y SPEC 005.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar tests.
- Confirmacion de que solo una accion explicita de revision puede pasar una pregunta a `validated`.
- Confirmacion de que se reutiliza la validacion de SPEC 005 antes de aprobar.
- Confirmacion de que editar, generar o validar automaticamente nunca convierte directamente en `validated`.
- Confirmacion de conexion con SPEC 001, SPEC 002, SPEC 003, SPEC 004 y SPEC 005.
- Confirmacion de que no se implemento frontend avanzado, sistema complejo de usuarios, roles, permisos, notificaciones, estadisticas avanzadas ni generacion de tests.
- Confirmacion de que no se rompen tests existentes.
