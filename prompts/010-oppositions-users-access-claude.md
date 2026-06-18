# Claude Prompt - SPEC 010 Oppositions, Users & Access

## Context

TESTOPO ya tiene un MVP para gestionar material, temario, preguntas, revision humana, generacion de tests, realizacion de tests, resultados y un frontend basico.

Ahora la app debe evolucionar hacia una plataforma con dos roles principales:

- `admin`: gestiona oposiciones, material, temario, preguntas, revision y accesos.
- `student`: accede solo a oposiciones autorizadas y estudia dentro de ellas.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/010-oppositions-users-access.md
```

Branch de trabajo:

```text
feature/oppositions-users-access
```

## Product Goal

Crear la base de plataforma para que cada oposicion tenga su propio material, temario, pool de preguntas, tests, intentos y estudiantes autorizados.

El objetivo no es crear una plataforma comercial completa, sino separar claramente:

- Admin gestiona una oposicion.
- Student estudia dentro de una oposicion autorizada.

## Compatibility With SPEC 011

Si la SPEC 011 - Workspaces & Account Plans esta activa o ya fue implementada, no trates `Opposition` como raiz superior del contenido.

La jerarquia correcta pasa a ser:

```text
Workspace -> Opposition -> Material/Topic/Question/Test/TestAttempt
```

En ese caso:

- `Opposition` debe tener `workspace_id`.
- Una oposicion no puede existir sin workspace.
- El acceso a oposicion debe respetar la membresia activa del workspace.
- No dupliques modelos de acceso si `WorkspaceMember` ya cubre parte del permiso.
- Mantén `opposition_id` en entidades principales para separar pools por oposicion.

## Current MVP Compatibility

Antes de modificar, revisa el stack actual y las specs previas:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.
- SPEC 007 - Test Generator.
- SPEC 008 - Test Taking & Results.
- SPEC 009 - Basic MVP Frontend.

No rompas el flujo existente:

```text
Material -> Temario -> Preguntas -> Revision -> Test -> Resultado
```

Ese flujo debe quedar ahora dentro de una oposicion.

## Scope

Implementa:

- Modelo `User`.
- Roles `admin` y `student`.
- Autenticacion basica si no existe.
- Modelo `Opposition`.
- Modelo de relacion usuario-oposicion (`OppositionAccess`, `UserOpposition`, `Enrollment` o nombre equivalente).
- Permisos basicos por rol.
- Creacion y listado de oposiciones.
- Vista/consulta de oposicion solo con acceso permitido.
- Edicion de oposicion por admin con permisos.
- Dar acceso a estudiantes.
- Revocar acceso sin borrar historico.
- Listar estudiantes de una oposicion para admin.
- Asociar `Material` a `opposition_id`.
- Asociar `Topic` a `opposition_id`.
- Asociar `Question` a `opposition_id`.
- Asociar `Test` a `opposition_id`.
- Asociar `TestAttempt` a `opposition_id`.
- Asociar `TestAttempt` a `user_id` si no existe.
- Filtro de generacion de tests por oposicion.
- Proteccion contra mezclar entidades de oposiciones distintas.
- Oposicion por defecto para datos existentes.
- Tests automaticos de reglas criticas.
- Adaptacion minima del frontend para zonas Admin y Estudiante.

## Out of Scope

No implementes:

- Pagos.
- Suscripciones.
- Invitaciones por email.
- OAuth.
- Login con Google.
- Verificacion por email.
- Recuperacion avanzada de contrasena.
- 2FA.
- Roles empresariales complejos.
- Multi-academia.
- Marketplace.
- Estadisticas avanzadas por estudiante.
- Panel avanzado de alumnos.
- Chat.
- Comunidad.
- Ranking.
- Gamificacion.
- App movil nativa.

No conviertas esta spec en una reescritura del producto.

## Business Rules

- Todo material, tema, pregunta, test e intento debe pertenecer a una oposicion.
- No deben crearse nuevas entidades principales sin `opposition_id`.
- Un student solo puede ver oposiciones con acceso activo.
- Un student no puede acceder a material, preguntas, tests ni resultados de oposiciones no autorizadas.
- Un student solo puede crear tests dentro de una oposicion autorizada.
- Un test solo puede usar preguntas `validated` de la misma oposicion.
- Un student no puede ver preguntas no validadas.
- Un student no puede ver respuestas correctas antes de enviar un test.
- Un student solo puede ver sus propios intentos y resultados.
- Un admin puede gestionar oposiciones donde tenga rol `owner` o `manager`.
- Para el MVP, si solo existe un admin global, puede gestionar todas las oposiciones, pero deja el codigo preparado para permisos por oposicion.
- No se puede vincular una pregunta a un tema de otra oposicion.
- No se puede vincular una pregunta a material de otra oposicion.
- No se puede crear un test mezclando preguntas de varias oposiciones.
- El material visible para student debe estar en estado permitido, recomendado `active`.
- No borres datos existentes.
- Crea/asigna datos previos a una oposicion por defecto llamada `Oposicion MVP`.

## Validation Errors

Usa o adapta estos codigos de error cuando encajen con el stack actual:

- `USER_EMAIL_REQUIRED`
- `USER_EMAIL_ALREADY_EXISTS`
- `USER_PASSWORD_REQUIRED`
- `USER_INVALID_ROLE`
- `USER_INVALID_STATUS`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_REQUIRED`
- `ACCESS_DENIED`
- `OPPOSITION_TITLE_REQUIRED`
- `OPPOSITION_SLUG_REQUIRED`
- `OPPOSITION_SLUG_ALREADY_EXISTS`
- `OPPOSITION_INVALID_STATUS`
- `OPPOSITION_NOT_FOUND`
- `OPPOSITION_ACCESS_NOT_FOUND`
- `OPPOSITION_ACCESS_ALREADY_EXISTS`
- `OPPOSITION_ACCESS_REVOKED`
- `OPPOSITION_REQUIRED`
- `OPPOSITION_ENTITY_MISMATCH`
- `STUDENT_ACCESS_REQUIRED`
- `ADMIN_ACCESS_REQUIRED`

## Implementation Notes

- Adaptate al stack actual del repo.
- Mantén autenticacion simple para MVP.
- Guarda contrasenas solo como hash, nunca texto plano.
- Centraliza permisos en funciones reutilizables.
- No dupliques logica de negocio en frontend.
- Mantén las reglas de estado de SPEC 001 a SPEC 009.
- La UI puede ser minima si el backend/servicios requieren mas trabajo, pero debe permitir distinguir Admin y Estudiante.
- Asegura que el frontend no vuelva a mostrar respuestas correctas antes de enviar un test.
- Evita migraciones destructivas.
- Documenta la decision de la oposicion por defecto.

## Required Tests

Anade o actualiza tests para comprobar:

- Se puede crear un usuario admin.
- Se puede crear un usuario student.
- No se puede crear usuario con email duplicado.
- No se puede crear usuario con rol invalido.
- Se puede iniciar sesion con credenciales validas.
- No se puede iniciar sesion con credenciales invalidas.
- Un admin puede crear una oposicion.
- Un student no puede crear una oposicion.
- Se puede dar acceso a un estudiante a una oposicion.
- Un estudiante solo ve oposiciones autorizadas.
- Un estudiante no ve oposiciones no autorizadas.
- Un estudiante puede ver material activo de una oposicion autorizada.
- Un estudiante no puede ver material de una oposicion no autorizada.
- Un admin puede gestionar material de una oposicion que administra.
- No se puede crear material sin oposicion.
- No se puede crear tema sin oposicion.
- No se puede crear pregunta sin oposicion.
- No se puede vincular pregunta a tema de otra oposicion.
- No se puede vincular pregunta a material de otra oposicion.
- No se puede crear test mezclando preguntas de varias oposiciones.
- El generador de tests solo usa preguntas validadas de la oposicion indicada.
- Un estudiante no puede crear test en una oposicion sin acceso.
- Un estudiante solo puede ver sus propios resultados.
- Los datos existentes se asignan a una oposicion por defecto.
- No se rompen los tests existentes de SPEC 001 a SPEC 009.

## Acceptance Criteria

La implementacion se considera lista cuando:

- Existe modelo de usuario.
- Existen roles `admin` y `student`.
- Existe modelo de oposicion.
- Existe relacion usuario-oposicion.
- El admin puede crear oposiciones.
- El admin puede dar y revocar acceso a estudiantes.
- El student solo ve oposiciones autorizadas.
- Materiales, temas, preguntas, tests e intentos pertenecen a una oposicion.
- El pool de preguntas queda separado por oposicion.
- El generador de tests filtra por oposicion.
- No se pueden mezclar entidades de oposiciones distintas.
- Los intentos quedan asociados a usuario y oposicion.
- Los datos existentes quedan asignados a `Oposicion MVP`.
- Existen tests de seguridad e integridad.
- Tests existentes siguen pasando.
- No se anaden funcionalidades fuera de alcance.

## Expected Output

Claude debe entregar:

- Codigo implementado en `feature/oppositions-users-access`.
- Tests nuevos y existentes pasando.
- Documentacion breve de la oposicion por defecto y cualquier decision tecnica relevante.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Resumen de cambios.
- Tests ejecutados.
- Riesgos o decisiones tecnicas.
- Confirmacion explicita de que no se implementaron pagos, suscripciones, OAuth, comunidad, ranking ni funcionalidades fuera de alcance.
