# SPEC 006 - Admin Review

## 1. Objetivo

Crear el modulo basico de revision administrativa de preguntas para TESTOPO.

Este modulo debe permitir que una persona revise preguntas generadas o creadas manualmente, consulte sus errores de validacion, las edite y decida si deben aprobarse, rechazarse, corregirse o marcarse como obsoletas.

El objetivo no es crear todavia un panel visual avanzado. El objetivo es implementar el flujo funcional minimo para que el banco de preguntas pueda ser controlado por revision humana.

## 2. Contexto MVP

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen o deben existir:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.

La SPEC 004 genera preguntas candidatas.

La SPEC 005 detecta errores y recomienda estados.

Esta SPEC 006 permite que una persona tome la decision final.

Principio central:

> La IA puede proponer preguntas y el sistema puede detectar errores, pero solo una revision explicita puede aprobar una pregunta como valida.

## 3. Branch recomendada

```text
feature/admin-review
```

## 4. Alcance

Claude debe implementar el flujo minimo de revision humana.

Debe incluir:

- Listado de preguntas para revisar.
- Filtros por estado.
- Filtros por dificultad.
- Filtros por tema, si existe integracion con `Topic`.
- Consulta detallada de una pregunta.
- Consulta de fuente y material asociado.
- Consulta del ultimo informe de validacion.
- Edicion de pregunta desde revision.
- Accion de aprobar pregunta.
- Accion de rechazar pregunta.
- Accion de marcar como `needs_fix`.
- Accion de marcar como `obsolete`.
- Registro basico de revision.
- Validaciones antes de aprobar.
- Tests automaticos de reglas criticas.

## 5. Fuera de alcance

No debe implementarse todavia:

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

Esta spec solo cubre el flujo minimo de revision para el MVP.

## 6. Estados de pregunta involucrados

Estados definidos en SPEC 001:

- `draft`
- `pending_review`
- `validated`
- `rejected`
- `needs_fix`
- `obsolete`

Uso recomendado:

### draft

Pregunta incompleta o en borrador.

### pending_review

Pregunta que ha pasado controles basicos y espera revision humana.

### validated

Pregunta aprobada por revision explicita y disponible para futuros tests normales.

### rejected

Pregunta descartada.

### needs_fix

Pregunta con errores que debe corregirse antes de poder aprobarse.

### obsolete

Pregunta desactualizada o no utilizable.

## 7. Regla principal

Solo una accion explicita de revision puede pasar una pregunta a:

- `validated`

No debe existir ningun flujo automatico que convierta una pregunta en `validated` sin revision.

Antes de aprobar una pregunta, el sistema debe ejecutar o consultar la validacion de SPEC 005.

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

## 8. Modelo de revision

Crear un modelo llamado `QuestionReview`, `ReviewLog` o similar.

Campos minimos recomendados:

- `id`
- `question_id`
- `action`
- `previous_status`
- `new_status`
- `reviewer_name`
- `notes`
- `validation_result_id`
- `created_at`

### question_id

Pregunta revisada.

### action

Accion realizada.

Valores permitidos:

- `approve`
- `reject`
- `mark_needs_fix`
- `mark_obsolete`
- `edit`
- `return_to_pending_review`

### previous_status

Estado anterior de la pregunta.

### new_status

Nuevo estado de la pregunta.

### reviewer_name

Nombre del revisor.

Para el MVP, si no hay usuarios, puede ser un texto opcional.

Ejemplos:

- `admin`
- `human_reviewer`
- `Miguel`

### notes

Notas opcionales de revision.

Ejemplos:

- Explicacion corregida.
- Pregunta rechazada por ambigua.
- Fuente obsoleta.
- Aprobada tras validar articulo citado.

### validation_result_id

Referencia opcional al informe de validacion usado para tomar la decision.

### created_at

Fecha de revision.

## 9. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 9.1 Listar preguntas para revision

Debe permitir listar preguntas con estados:

- `draft`
- `pending_review`
- `needs_fix`

Filtros recomendados:

- Estado.
- Dificultad.
- Tema.
- Fuente o material, si es sencillo.
- Texto de busqueda, si es sencillo.

No debe incluir por defecto preguntas `validated`, `rejected` u `obsolete`, salvo que se pidan con filtro.

### 9.2 Ver detalle de revision

Debe permitir consultar una pregunta con:

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

### 9.3 Editar pregunta en revision

Debe permitir editar:

- Enunciado.
- Opciones.
- Respuesta correcta.
- Explicacion.
- Fuente.
- Tema.
- Dificultad.

Al editar:

- Debe actualizarse `updated_at`.
- Debe registrarse una accion `edit`.
- La pregunta editada debe quedar en `pending_review` o `draft`, segun su estado previo y validez formal.
- No debe pasar automaticamente a `validated`.

### 9.4 Aprobar pregunta

Debe cambiar la pregunta a:

- `validated`

Solo si supera las reglas obligatorias.

Antes de aprobar, debe ejecutar o consultar la validacion de SPEC 005.

Si hay errores criticos, debe bloquear la aprobacion y devolver errores claros.

Debe registrar una accion:

- `approve`

### 9.5 Rechazar pregunta

Debe cambiar la pregunta a:

- `rejected`

Debe permitir notas de rechazo.

Debe registrar una accion:

- `reject`

### 9.6 Marcar como necesita correccion

Debe cambiar la pregunta a:

- `needs_fix`

Debe permitir notas.

Debe registrar una accion:

- `mark_needs_fix`

### 9.7 Marcar como obsoleta

Debe cambiar la pregunta a:

- `obsolete`

Debe permitir notas.

Debe registrar una accion:

- `mark_obsolete`

### 9.8 Devolver a pendiente de revision

Debe permitir pasar una pregunta desde `needs_fix`, `draft` o `rejected` a:

- `pending_review`

Solo si cumple validaciones formales minimas.

Debe registrar una accion:

- `return_to_pending_review`

## 10. Validaciones obligatorias

### 10.1 No aprobar sin validacion

No se puede aprobar una pregunta si no se ha ejecutado la validacion o si la validacion devuelve errores criticos.

Error recomendado:

- `QUESTION_REVIEW_VALIDATION_REQUIRED`

### 10.2 No aprobar pregunta incompleta

Errores recomendados:

- `QUESTION_REVIEW_APPROVAL_BLOCKED`
- `QUESTION_STATEMENT_REQUIRED`
- `QUESTION_OPTIONS_REQUIRED`
- `QUESTION_SINGLE_CORRECT_OPTION_REQUIRED`
- `QUESTION_EXPLANATION_REQUIRED`
- `QUESTION_SOURCE_REQUIRED`
- `QUESTION_TOPIC_REQUIRED`
- `QUESTION_DIFFICULTY_REQUIRED`

### 10.3 No aprobar fuente obsoleta

Errores recomendados:

- `QUESTION_SOURCE_OBSOLETE`
- `QUESTION_SOURCE_MATERIAL_OBSOLETE`

### 10.4 No aprobar tema obsoleto

Error recomendado:

- `QUESTION_TOPIC_OBSOLETE`

### 10.5 No aprobar pregunta obsoleta directamente

Una pregunta en estado `obsolete` no puede pasar directamente a `validated`.

Debe editarse o reabrirse primero, segun la logica del proyecto.

Error recomendado:

- `QUESTION_OBSOLETE_CANNOT_BE_VALIDATED`

### 10.6 No aprobar pregunta rechazada directamente

Una pregunta en estado `rejected` no deberia pasar directamente a `validated`.

Flujo recomendado:

```text
rejected -> pending_review -> validated
```

Error recomendado:

- `QUESTION_REJECTED_REQUIRES_REVIEW_REOPEN`

## 11. Errores recomendados

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

Para el MVP, las notas no tienen que ser obligatorias en todas las acciones, pero si recomendables en:

- `reject`
- `mark_needs_fix`
- `mark_obsolete`

## 12. Transiciones de estado permitidas

Transiciones recomendadas:

- `draft -> pending_review`
- `draft -> needs_fix`
- `draft -> rejected`
- `draft -> obsolete`
- `pending_review -> validated`
- `pending_review -> needs_fix`
- `pending_review -> rejected`
- `pending_review -> obsolete`
- `needs_fix -> pending_review`
- `needs_fix -> rejected`
- `needs_fix -> obsolete`
- `rejected -> pending_review`
- `rejected -> obsolete`
- `validated -> needs_fix`
- `validated -> obsolete`
- `obsolete -> needs_fix`

Transiciones no recomendadas:

- `draft -> validated`
- `needs_fix -> validated`
- `rejected -> validated`
- `obsolete -> validated`

Estas transiciones solo deberian permitirse si pasan por una accion explicita de revision y validacion.

Para el MVP, es mejor bloquearlas.

## 13. Relacion con SPEC 005

El modulo de revision debe reutilizar el validador de preguntas.

Flujo de aprobacion recomendado:

1. Admin solicita aprobar pregunta.
2. Sistema ejecuta validacion.
3. Si hay errores criticos, bloquea aprobacion.
4. Si no hay errores criticos, permite cambiar a `validated`.
5. Sistema registra log de revision.

Advertencias no bloqueantes:

Si hay warnings pero no errores, la aprobacion puede permitirse, pero el resultado debe mostrar las advertencias.

Ejemplo:

La pregunta tiene una explicacion corta, pero no tiene errores criticos.

## 14. Relacion con frontend futuro

Aunque esta spec no debe crear un frontend avanzado, la estructura debe quedar preparada para pantallas futuras:

- Lista de preguntas pendientes.
- Detalle de pregunta.
- Editor de pregunta.
- Vista de fuente.
- Vista de informe de validacion.
- Botones de aprobar, rechazar, corregir u obsoletar.

Si ya existe una API o capa de servicios, debe exponer operaciones claras para que el frontend pueda consumirlas despues.

## 15. Tests automaticos obligatorios

Deben existir tests para comprobar:

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

## 16. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe un flujo funcional de revision humana.
- Se pueden listar preguntas pendientes.
- Se puede ver el detalle completo de una pregunta.
- Se puede ver o consultar el ultimo informe de validacion.
- Se puede editar una pregunta.
- Se puede aprobar una pregunta valida.
- Se bloquea la aprobacion de preguntas invalidas.
- Se puede rechazar una pregunta.
- Se puede marcar una pregunta como `needs_fix`.
- Se puede marcar una pregunta como `obsolete`.
- Se registra un historial basico de revision.
- Solo una accion explicita puede pasar una pregunta a `validated`.
- No existe validacion automatica directa a `validated`.
- Existen tests de reglas criticas.
- No se implementa frontend avanzado.
- No se implementa sistema complejo de usuarios.
- No se implementa generacion de tests.
- No se anaden funcionalidades fuera del MVP.

## 17. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del repositorio.

Prioridades:

- Reutilizar el modelo de preguntas de SPEC 001.
- Reutilizar materiales/fuentes de SPEC 002.
- Reutilizar temas de SPEC 003.
- Reutilizar validacion de SPEC 005.
- No duplicar logica de validacion.
- No permitir aprobacion sin controles.
- Mantener servicios simples y testeables.
- Preparar operaciones consumibles por futuro frontend.
- No sobredisenar permisos o usuarios.

Para el MVP, si no hay autenticacion, `reviewer_name` puede ser un texto opcional.

## 18. Prompt para Claude

Claude, implementa la SPEC 006 - Admin Review.

Estamos construyendo el MVP de TESTOPO.

Debes crear el flujo minimo de revision humana de preguntas.

Implementa:

- Listado de preguntas para revision.
- Filtros basicos por estado, dificultad y tema si el stack lo permite.
- Detalle completo de pregunta para revision.
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

No implementes todavia:

- Frontend visual avanzado.
- Sistema complejo de usuarios.
- Roles y permisos.
- Comentarios colaborativos.
- Notificaciones.
- Estadisticas avanzadas.
- Generacion de tests.
- Simulacros.
- Pagos.
- Marketplace.

Regla central:

Solo una accion explicita de revision puede pasar una pregunta a `validated`.

Antes de aprobar, debes reutilizar la validacion de SPEC 005. Si hay errores criticos, la aprobacion debe bloquearse.

Editar, generar o validar automaticamente una pregunta nunca debe convertirla directamente en `validated`.

Manten la implementacion simple, modular y compatible con SPEC 001, SPEC 002, SPEC 003, SPEC 004 y SPEC 005. No rompas los tests existentes.
