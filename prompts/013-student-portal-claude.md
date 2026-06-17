# Claude Prompt - SPEC 013 Student Portal

## Context

TESTOPO ya tiene flujo admin/owner para crear workspace, oposicion, material, preguntas, revision y pool validado.

Esta SPEC 013 crea la experiencia separada del estudiante/opositor.

Debe conectarse con:

- SPEC 008 - Test Taking & Results.
- SPEC 010 - Oppositions, Users & Access.
- SPEC 011 - Workspaces & Account Plans.
- SPEC 012 - PDF Material Upload.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/013-student-portal.md
```

Branch de trabajo:

```text
feature/student-portal
```

## Product Goal

Crear una zona sencilla y clara para el opositor que estudia.

El estudiante entra para:

- Ver sus oposiciones autorizadas.
- Consultar material activo.
- Crear tests desde preguntas validadas.
- Responder tests.
- Ver resultados, explicaciones y fuentes despues de enviar.

No entra para administrar.

## Scope

Implementa:

- Portal o rutas de estudiante separadas de admin.
- Pantalla `Mis oposiciones`.
- Inicio de oposicion para estudiante.
- Vista de material activo.
- Vista de detalle de material.
- Consulta de texto extraido de PDF si existe.
- Creacion de tests dentro de oposicion autorizada.
- Realizacion de test.
- Guardado de respuestas.
- Envio de test.
- Pantalla de resultado.
- Revision de respuestas con explicacion y fuente.
- Proteccion de acceso por usuario/workspace/oposicion.
- Bloqueo de acceso a funciones admin.
- Tests automaticos de reglas criticas.

## Out of Scope

No implementes:

- Pagos.
- Suscripciones.
- Ranking.
- Comunidad.
- Chat.
- Gamificacion avanzada.
- Estadisticas avanzadas.
- Plan de estudio inteligente.
- Repeticion espaciada.
- Recomendaciones automaticas.
- Certificados.
- Foros.
- Comentarios sobre preguntas.
- Reportes avanzados.
- App movil nativa.
- Panel avanzado de progreso.

## Business Rules

- El estudiante solo puede ver workspaces donde sea miembro activo.
- El estudiante solo puede ver oposiciones autorizadas.
- El estudiante no puede entrar en oposiciones no autorizadas.
- El estudiante solo puede ver material `active`.
- El estudiante no puede ver material `obsolete`, `deprecated` ni `needs_review`.
- El estudiante puede ver texto extraido de material/PDF si tiene acceso y el material esta activo.
- El estudiante no debe ver rutas internas de archivos como `/uploads/private/uuid.pdf`.
- El estudiante puede crear tests solo dentro de oposiciones autorizadas.
- El test debe usar solo preguntas `validated`.
- El test debe usar solo preguntas de la oposicion actual.
- El test debe excluir preguntas, fuentes/materiales o temas obsoletos.
- No mostrar respuestas correctas antes de enviar.
- No mostrar explicaciones antes de enviar.
- No indicar si una opcion es correcta o incorrecta antes de enviar.
- El estudiante puede cambiar respuestas antes de enviar.
- El estudiante puede dejar preguntas sin responder.
- Despues de enviar, puede ver resultado, explicacion y fuente.
- El estudiante solo puede ver sus propios resultados e intentos.
- El estudiante no puede subir material.
- El estudiante no puede generar preguntas.
- El estudiante no puede editar preguntas.
- El estudiante no puede revisar preguntas.
- El estudiante no puede aprobar ni rechazar preguntas.
- El estudiante no puede ver preguntas no validadas ni informes internos de validacion.

## Suggested Student Navigation

Mantener navegacion simple.

Secciones recomendadas:

- Mis oposiciones.
- Inicio.
- Material.
- Crear test.
- Mis resultados.

No mostrar:

- Preguntas pendientes.
- Validacion.
- Revision.
- Generacion de preguntas.
- Subida de material.
- Temario editable.
- Usuarios.
- Configuracion avanzada.

## UX Rules

- Una accion principal por pantalla.
- Lenguaje de estudiante, no tecnico.
- Nada de estados internos como `pending_review` o `needs_fix`.
- Nada de validaciones tecnicas visibles.
- Fuentes visibles solo tras responder.
- Crear test debe ser rapido.
- El portal debe ser mas simple que admin.

Frase guia:

```text
El estudiante entra para estudiar, no para administrar.
```

## Required Operations

Implementa o adapta segun el stack:

- Listar oposiciones del estudiante.
- Ver oposicion del estudiante.
- Listar material visible.
- Ver material activo.
- Crear test de estudiante.
- Iniciar intento.
- Guardar respuesta.
- Enviar test.
- Ver resultado.
- Ver revision solo despues de enviar.

Reutiliza:

- SPEC 007 para generacion de tests.
- SPEC 008 para intentos, resultados y revision.
- SPEC 010/011 para permisos por usuario, workspace y oposicion.
- SPEC 012 para consulta de material PDF y texto extraido.

## Validation Errors

Usa o adapta estos codigos:

- `STUDENT_ACCESS_REQUIRED`
- `STUDENT_OPPOSITION_NOT_FOUND`
- `STUDENT_OPPOSITION_ACCESS_DENIED`
- `STUDENT_MATERIAL_NOT_FOUND`
- `STUDENT_MATERIAL_ACCESS_DENIED`
- `STUDENT_MATERIAL_NOT_AVAILABLE`
- `STUDENT_TEST_CREATION_DENIED`
- `STUDENT_NOT_ENOUGH_VALIDATED_QUESTIONS`
- `STUDENT_ATTEMPT_NOT_FOUND`
- `STUDENT_ATTEMPT_ACCESS_DENIED`
- `STUDENT_REVIEW_NOT_AVAILABLE`
- `STUDENT_CANNOT_ACCESS_ADMIN_AREA`

## Frontend Notes

Crear o adaptar vistas para estudiante.

Rutas sugeridas si el stack usa routing:

- `/student`
- `/student/oppositions`
- `/student/oppositions/:oppositionId`
- `/student/oppositions/:oppositionId/material`
- `/student/oppositions/:oppositionId/tests/new`
- `/student/attempts/:attemptId`
- `/student/attempts/:attemptId/result`
- `/student/attempts/:attemptId/review`

Si el stack actual no usa rutas, mantener la separacion de vistas de forma equivalente.

La pantalla de oposicion debe tener accion principal:

- `Crear test`

## Required Tests

Anade o actualiza tests para comprobar:

- Un estudiante ve solo sus oposiciones autorizadas.
- Un estudiante no ve oposiciones no autorizadas.
- Un estudiante puede entrar en una oposicion autorizada.
- Un estudiante no puede entrar en una oposicion no autorizada.
- Un estudiante ve solo material activo.
- Un estudiante no ve material obsoleto.
- Un estudiante no ve material `needs_review`.
- Un estudiante no puede subir material.
- Un estudiante no puede generar preguntas.
- Un estudiante no puede revisar preguntas.
- Un estudiante no puede aprobar preguntas.
- Un estudiante puede crear test en oposicion autorizada.
- Un estudiante no puede crear test en oposicion no autorizada.
- El test usa solo preguntas `validated`.
- El test usa solo preguntas de la oposicion actual.
- No se muestran respuestas correctas antes de enviar.
- No se muestran explicaciones antes de enviar.
- El estudiante puede guardar respuestas.
- El estudiante puede enviar test.
- El estudiante ve resultado despues de enviar.
- El estudiante ve explicacion y fuente despues de enviar.
- El estudiante no puede ver resultados de otro estudiante.
- El estudiante no puede consultar revision antes de enviar.
- No se rompen tests existentes de SPEC 001 a SPEC 012.

## Acceptance Criteria

La implementacion esta lista cuando:

- Existe una zona de estudiante separada.
- El estudiante puede ver `Mis oposiciones`.
- El estudiante solo ve oposiciones autorizadas.
- El estudiante puede entrar en una oposicion autorizada.
- El estudiante puede ver material activo.
- El estudiante puede consultar material permitido.
- El estudiante puede crear un test.
- El test solo usa preguntas validadas de esa oposicion.
- El estudiante puede realizar el test.
- No se muestran respuestas correctas antes de enviar.
- El estudiante puede enviar el test.
- El estudiante ve resultado.
- El estudiante ve revision con explicacion.
- El estudiante ve fuentes de las preguntas.
- El estudiante no puede acceder a funciones de administracion.
- Existen tests de permisos y reglas criticas.
- No se anaden funcionalidades fuera de alcance.

## Expected Output

Claude debe entregar:

- Codigo implementado en `feature/student-portal`.
- Tests nuevos y existentes pasando.
- Frontend smoke visual o instrucciones claras para probar el portal estudiante.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Resumen de cambios.
- Tests ejecutados.
- Como probar el flujo de estudiante.
- Confirmacion explicita de que no se implementaron pagos, ranking, comunidad, chat, gamificacion avanzada, estadisticas avanzadas ni funciones fuera de alcance.
