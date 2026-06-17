# Claude Prompt - SPEC 014 Admin/Student UI Separation & Navigation

## Context

TESTOPO ya tiene un frontend basico y flujos diferenciados de administracion y estudiante en evolucion.

Esta spec debe ordenar la experiencia para que el usuario no confunda:

- Gestionar una oposicion.
- Estudiar una oposicion.

Debe conectarse con:

- SPEC 009 - Basic MVP Frontend.
- SPEC 010 - Oppositions, Users & Access.
- SPEC 011 - Workspaces & Account Plans.
- SPEC 013 - Student Portal.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/014-admin-student-ui-separation.md
```

Branch de trabajo:

```text
feature/admin-student-ui-separation
```

## Product Goal

Separar claramente la experiencia visual y funcional entre administrador y estudiante, manteniendo navegacion simple, elegante e intuitiva.

Principio central:

```text
El administrador gestiona.
El estudiante estudia.
```

## Scope

Implementa o ajusta:

- Rutas o estructura equivalente para admin.
- Rutas o estructura equivalente para student.
- Layout visual diferenciado para admin.
- Layout visual diferenciado para student.
- Navegacion principal por rol.
- Selector o contexto de workspace.
- Selector o contexto de oposicion.
- Redireccion inicial segun rol/acceso.
- Proteccion visual y funcional contra accesos incorrectos.
- Estados vacios claros.
- Mensajes de permiso denegado.
- Ocultacion de acciones no permitidas.
- Tests automaticos de navegacion y permisos.

## Out of Scope

No implementes:

- Pagos.
- Suscripciones.
- Marketplace.
- Ranking.
- Comunidad.
- Chat.
- Gamificacion.
- Estadisticas avanzadas.
- Onboarding comercial complejo.
- Invitaciones por email.
- Configuracion avanzada de organizacion.
- Roles granulares complejos.
- App movil nativa.

Esta spec ordena experiencia, rutas y navegacion. No debe crear funcionalidades de negocio nuevas.

## Route Structure

Si el stack soporta rutas, usa o adapta esta estructura.

Admin:

- `/admin`
- `/admin/workspaces`
- `/admin/workspaces/:workspaceId`
- `/admin/workspaces/:workspaceId/oppositions`
- `/admin/oppositions/:oppositionId`
- `/admin/oppositions/:oppositionId/material`
- `/admin/oppositions/:oppositionId/topics`
- `/admin/oppositions/:oppositionId/questions`
- `/admin/oppositions/:oppositionId/questions/review`
- `/admin/oppositions/:oppositionId/tests`
- `/admin/oppositions/:oppositionId/students`

Student:

- `/student`
- `/student/oppositions`
- `/student/oppositions/:oppositionId`
- `/student/oppositions/:oppositionId/material`
- `/student/oppositions/:oppositionId/tests/new`
- `/student/attempts/:attemptId`
- `/student/attempts/:attemptId/result`
- `/student/attempts/:attemptId/review`

Si el frontend actual no usa routing formal, implementa una estructura equivalente con vistas separadas y estado de navegacion claro.

## Admin UX Rules

La zona admin debe parecer panel de gestion.

Debe permitir navegar hacia:

- Workspaces.
- Oposiciones.
- Material.
- Temario.
- Preguntas.
- Revision.
- Tests.
- Alumnos.

Debe mostrar informacion util de gestion:

- Estados de preguntas.
- Contadores de revision.
- Acciones administrativas.

No mostrar opciones de estudiante como `Hacer test` salvo que exista un modo de prueba muy claro. Para el MVP, evita modo preview si complica la logica.

## Student UX Rules

La zona student debe parecer app de estudio.

Menu recomendado:

- Mis oposiciones.
- Material.
- Crear test.
- Resultados.

No mostrar:

- Generar preguntas.
- Revision.
- Validacion.
- Alumnos.
- Subir material.
- Editar temario.
- Aprobar preguntas.

La zona estudiante debe ser mas limpia que la zona admin.

## Context Header

Todas las pantallas internas deben mostrar contexto suficiente.

Admin:

```text
Workspace: Academia OpoNorte
Oposicion: Auxiliar Administrativo
Rol: Admin
Zona: Administracion
```

Student:

```text
Oposicion: Auxiliar Administrativo
Academia: Academia OpoNorte
Zona: Estudio
```

No hace falta mostrar todo si ocupa demasiado, pero el usuario debe saber donde esta y que puede hacer.

## Initial Redirect

Tras login o entrada a la app:

- Usuario solo student -> `/student/oppositions`.
- Usuario admin/owner -> `/admin/workspaces`.
- Usuario con varios roles -> mostrar eleccion simple:

```text
Que quieres hacer?
- Gestionar oposiciones
- Estudiar mis oposiciones
```

No mostrar eleccion si solo hay una opcion posible.

## Permission Rules

- Una ruta `/admin` solo debe estar disponible para usuarios `owner` o `admin` dentro del workspace correspondiente.
- Un `student` no debe acceder a `/admin`.
- Una ruta `/student` solo debe mostrar oposiciones y datos permitidos al estudiante.
- Un student solo ve oposiciones autorizadas.
- Un student no ve funciones de revision, generacion, validacion ni aprobacion.
- El frontend puede ocultar acciones no permitidas, pero los permisos reales deben seguir protegidos en backend o servicios.

Mensaje recomendado para acceso admin denegado:

```text
No tienes permiso para acceder a la zona de administracion.
```

## Empty States

Usa estados vacios claros:

- Admin sin workspace: `Todavia no tienes ningun espacio de trabajo. Crea tu primer workspace para empezar.`
- Admin sin oposicion: `Todavia no has creado ninguna oposicion. Crea una oposicion para subir material y generar preguntas.`
- Admin sin preguntas pendientes: `No hay preguntas pendientes de revision.`
- Student sin oposiciones: `Todavia no tienes acceso a ninguna oposicion. Cuando un administrador te de acceso, aparecera aqui.`
- Student sin tests: `Todavia no has realizado ningun test. Crea tu primer test para empezar a practicar.`

## UI Rules

- Una accion principal clara por pantalla.
- Pocas acciones visibles.
- Lenguaje claro, sin jerga tecnica.
- Admin puede ver lenguaje de gestion.
- Student debe ver lenguaje de estudio.
- No mostrar nombres internos como `pending_review`, `needs_fix`, `attempt`, `source object` o `validation payload`.
- Mantener estilo limpio, elegante e intuitivo.
- No crear un sistema visual complejo.

## Required Manual Flows

Debe poder probarse:

Admin:

- Entrar como admin.
- Ver workspace.
- Crear o elegir oposicion.
- Subir material.
- Ver temario.
- Ver preguntas.
- Entrar en revision.
- Aprobar una pregunta.
- Ver alumnos.

Student:

- Entrar como estudiante.
- Ver mis oposiciones.
- Entrar en oposicion.
- Ver material.
- Crear test.
- Responder test.
- Enviar test.
- Ver resultado.
- Ver explicacion y fuente.

## Required Tests

Anade o actualiza tests para comprobar:

- Un student no puede ver rutas admin.
- Un student no ve botones de administracion.
- Un student solo ve sus oposiciones autorizadas.
- Un student no ve preguntas no validadas.
- Un student no ve respuestas correctas antes de enviar test.
- Un admin puede ver rutas admin.
- Un admin puede acceder a gestion de oposicion autorizada.
- Un usuario sin workspace ve estado vacio adecuado.
- Un usuario sin oposicion ve estado vacio adecuado.
- La navegacion admin muestra secciones administrativas.
- La navegacion student muestra solo secciones de estudio.
- La redireccion inicial funciona segun rol.
- Un usuario con varios roles puede elegir modo si aplica.
- No se rompen tests existentes de SPEC 001 a SPEC 013.

## Acceptance Criteria

La implementacion esta lista cuando:

- Existe separacion clara entre `/admin` y `/student` o equivalente.
- El layout admin esta orientado a gestion.
- El layout student esta orientado a estudio.
- La navegacion del estudiante no muestra funciones admin.
- La navegacion admin no confunde con flujo de estudio.
- El usuario ve workspace/oposicion actual cuando corresponde.
- Se protegen rutas segun rol y acceso.
- Los estados vacios son claros.
- Hay pocas acciones principales por pantalla.
- La interfaz mantiene estilo limpio, elegante e intuitivo.
- Existen tests de navegacion y permisos.
- No se anaden funcionalidades fuera de alcance.

## Expected Output

Claude debe entregar:

- Codigo implementado en `feature/admin-student-ui-separation`.
- Tests nuevos y existentes pasando.
- Smoke visual de los flujos admin y student, o instrucciones claras para probarlos.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Resumen de cambios.
- Tests ejecutados.
- Como probar flujo admin y flujo student.
- Confirmacion explicita de que no se implementaron pagos, marketplace, ranking, comunidad, gamificacion, estadisticas avanzadas, invitaciones ni funcionalidades fuera de alcance.
