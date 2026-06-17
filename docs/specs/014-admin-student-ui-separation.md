# SPEC 014 - Admin/Student UI Separation & Navigation

## 1. Objetivo

Separar claramente la interfaz de administracion y la interfaz de estudiante dentro de TESTOPO.

La app ya tiene dos experiencias principales:

```text
Admin / Owner / Preparador
  -> Gestiona workspace
  -> Gestiona oposiciones
  -> Sube material
  -> Genera preguntas
  -> Revisa preguntas
  -> Aprueba pool validado
  -> Da acceso a estudiantes
```

```text
Student / Opositor
  -> Entra en sus oposiciones
  -> Consulta material
  -> Crea tests
  -> Responde tests
  -> Ve resultados, explicaciones y fuentes
```

Esta spec debe evitar que ambas experiencias se mezclen.

## 2. Principio central

El administrador gestiona.

El estudiante estudia.

La interfaz debe dejar claro en todo momento:

- En que workspace esta el usuario.
- En que oposicion esta.
- Que rol tiene.
- Si esta en zona admin o zona estudiante.
- Que acciones puede realizar.

## 3. Branch recomendada

```text
feature/admin-student-ui-separation
```

## 4. Alcance

Claude debe implementar o ajustar:

- Separacion de rutas entre admin y student.
- Layout visual diferenciado para admin.
- Layout visual diferenciado para student.
- Navegacion principal por rol.
- Selector de workspace, si aplica.
- Selector de oposicion dentro del workspace.
- Proteccion visual y funcional contra accesos incorrectos.
- Redireccion segun rol/acceso.
- Estados vacios claros.
- Mensajes de permiso denegado.
- Adaptacion del frontend basico existente.
- Tests de navegacion y permisos.

## 5. Fuera de alcance

No implementar todavia:

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

Esta spec solo ordena experiencia, rutas y navegacion.

## 6. Rutas recomendadas

### 6.1 Zona admin

Rutas sugeridas:

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

### 6.2 Zona estudiante

Rutas sugeridas:

- `/student`
- `/student/oppositions`
- `/student/oppositions/:oppositionId`
- `/student/oppositions/:oppositionId/material`
- `/student/oppositions/:oppositionId/tests/new`
- `/student/attempts/:attemptId`
- `/student/attempts/:attemptId/result`
- `/student/attempts/:attemptId/review`

Claude puede adaptar rutas al framework actual, pero debe mantener separacion conceptual clara.

## 7. Layout admin

La zona admin debe tener navegacion orientada a gestion.

Menu recomendado:

- Inicio
- Workspaces
- Oposiciones
- Material
- Temario
- Preguntas
- Revision
- Tests
- Alumnos

Dentro de una oposicion, el menu debe reducirse a:

- Resumen
- Material
- Temario
- Preguntas
- Revision
- Tests
- Alumnos

No mostrar opciones de estudiante como "Hacer test" salvo que el admin tenga un modo especifico de prueba.

## 8. Layout estudiante

La zona estudiante debe tener navegacion orientada al estudio.

Menu recomendado:

- Mis oposiciones
- Material
- Crear test
- Resultados

No mostrar:

- Generar preguntas
- Revision
- Validacion
- Alumnos
- Subir material
- Editar temario
- Aprobar preguntas

La zona estudiante debe ser mas limpia que la zona admin.

## 9. Diferenciacion visual

Ambas zonas deben compartir identidad visual, pero estar claramente diferenciadas.

### Admin

- Aspecto de panel de gestion.
- Mas informacion visible.
- Estados de preguntas.
- Contadores de revision.
- Acciones administrativas.

### Student

- Aspecto de app de estudio.
- Menos opciones.
- Boton principal: Crear test.
- Material accesible.
- Resultados claros.
- Sin jerga tecnica.

## 10. Cabecera contextual

Todas las pantallas internas deben mostrar contexto.

Ejemplo admin:

```text
Workspace: Academia OpoNorte
Oposicion: Auxiliar Administrativo
Rol: Admin
Zona: Administracion
```

Ejemplo estudiante:

```text
Oposicion: Auxiliar Administrativo
Academia: Academia OpoNorte
Zona: Estudio
```

No hace falta mostrar todo si ocupa demasiado, pero el usuario debe saber donde esta.

## 11. Selector de workspace

Si el usuario pertenece a varios workspaces, debe poder elegir uno.

Reglas:

- Mostrar solo workspaces donde el usuario sea miembro activo.
- No mostrar workspaces revocados.
- Recordar o mantener workspace actual durante la sesion si el stack lo permite.
- Si solo tiene un workspace, no hacer la experiencia mas compleja.

## 12. Selector de oposicion

Dentro de un workspace, el usuario debe ver solo oposiciones permitidas.

### Admin

Puede ver oposiciones que puede gestionar.

### Student

Puede ver oposiciones donde tiene acceso activo.

No debe ver oposiciones no autorizadas.

## 13. Redireccion inicial

Tras login o entrada a la app:

### Usuario solo student

Enviar a:

```text
/student/oppositions
```

### Usuario admin/owner

Enviar a:

```text
/admin/workspaces
```

### Usuario con varios roles

Mostrar una pantalla simple de eleccion:

```text
Que quieres hacer?
- Gestionar oposiciones
- Estudiar mis oposiciones
```

No mostrar esta pantalla si solo tiene una opcion posible.

## 14. Proteccion de rutas

### Reglas admin

Una ruta `/admin` solo debe estar disponible para usuarios con rol:

- `owner`
- `admin`

dentro del workspace correspondiente.

Un `student` no debe acceder a `/admin`.

Error o redireccion recomendada:

```text
No tienes permiso para acceder a la zona de administracion.
```

### Reglas student

Una ruta `/student` solo debe mostrar oposiciones y datos permitidos al estudiante.

Un admin puede acceder a zona student solo si tiene acceso de estudio o si el sistema permite modo vista previa.

Para el MVP, no implementar modo vista previa si complica la logica.

## 15. Estados vacios

La interfaz debe tener mensajes claros.

### Admin sin workspace

```text
Todavia no tienes ningun espacio de trabajo.
Crea tu primer workspace para empezar.
```

### Admin sin oposicion

```text
Todavia no has creado ninguna oposicion.
Crea una oposicion para subir material y generar preguntas.
```

### Admin sin preguntas pendientes

```text
No hay preguntas pendientes de revision.
```

### Student sin oposiciones

```text
Todavia no tienes acceso a ninguna oposicion.
Cuando un administrador te de acceso, aparecera aqui.
```

### Student sin tests

```text
Todavia no has realizado ningun test.
Crea tu primer test para empezar a practicar.
```

## 16. Acciones principales por pantalla

Cada pantalla debe tener una accion principal clara.

Ejemplos:

- Admin workspace: Crear oposicion
- Admin material: Subir material
- Admin preguntas: Generar preguntas
- Admin revision: Revisar pregunta
- Student oposicion: Crear test
- Student resultado: Revisar respuestas

Evitar muchas acciones principales simultaneas.

## 17. Lenguaje de interfaz

Usar lenguaje claro.

### Admin

Correcto:

- Preguntas pendientes
- Material activo
- Aprobar pregunta
- Marcar como necesita correccion

Evitar:

- `pending_review`
- `needs_fix`
- `validated entity`
- `validation result payload`

### Student

Correcto:

- Crear test
- Ver material
- Resultado
- Explicacion
- Fuente

Evitar:

- Pool validado
- Question bank
- Attempt
- Source object

## 18. Pantallas admin minimas

La zona admin debe permitir navegar hacia:

- Workspaces.
- Oposiciones.
- Material.
- Temario.
- Preguntas.
- Revision.
- Tests.
- Alumnos.

No hace falta redisenar toda la funcionalidad si ya existe, pero debe estar ordenada bajo layout admin.

## 19. Pantallas student minimas

La zona student debe permitir navegar hacia:

- Mis oposiciones.
- Inicio de oposicion.
- Material.
- Crear test.
- Hacer test.
- Resultado.
- Revision de respuestas.

No debe mostrar funcionalidad administrativa.

## 20. Control de permisos en frontend

El frontend puede ocultar opciones que el usuario no puede usar.

Pero las reglas reales deben seguir protegidas en backend o servicios.

Regla:

```text
Ocultar botones mejora UX, pero no sustituye permisos reales.
```

## 21. Pruebas manuales esperadas

Tras implementar esta spec, debe poder probarse:

### Flujo admin

- Entrar como admin.
- Ver workspace.
- Crear o elegir oposicion.
- Subir material.
- Ver temario.
- Ver preguntas.
- Entrar en revision.
- Aprobar una pregunta.
- Ver alumnos.

### Flujo student

- Entrar como estudiante.
- Ver mis oposiciones.
- Entrar en oposicion.
- Ver material.
- Crear test.
- Responder test.
- Enviar test.
- Ver resultado.
- Ver explicacion y fuente.

## 22. Tests automaticos obligatorios

Deben existir tests para comprobar:

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

## 23. Criterios de aceptacion

La tarea se considera completada cuando:

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
- No se anaden funcionalidades fuera del MVP.

## 24. Notas tecnicas para Claude

Claude debe adaptarse al stack actual.

Prioridades:

- No duplicar logica de negocio.
- Reutilizar permisos de SPEC 010 y SPEC 011.
- Reutilizar Student Portal de SPEC 013.
- Reutilizar frontend basico de SPEC 009.
- Mantener layouts simples.
- No crear un sistema visual complejo.
- No romper rutas existentes sin redireccion o adaptacion.
- Mantener compatibilidad con tests existentes.

## 25. Prompt para Claude

Claude, implementa la SPEC 014 - Admin/Student UI Separation & Navigation.

Queremos separar claramente la zona de administracion y la zona de estudiante.

Debes implementar:

- Rutas o estructura equivalente para admin.
- Rutas o estructura equivalente para student.
- Layout admin.
- Layout student.
- Navegacion diferenciada por rol.
- Selector o contexto de workspace.
- Selector o contexto de oposicion.
- Redireccion inicial segun rol.
- Proteccion de rutas.
- Estados vacios claros.
- Ocultacion de acciones no permitidas.
- Tests automaticos de navegacion y permisos.

No implementes todavia:

- Pagos.
- Marketplace.
- Ranking.
- Comunidad.
- Gamificacion.
- Estadisticas avanzadas.
- Invitaciones por email.
- Roles empresariales complejos.
- App movil nativa.

Reglas centrales:

1. El administrador gestiona.
2. El estudiante estudia.
3. Un student no puede acceder a zona admin.
4. Un student no puede ver funciones de revision, generacion o aprobacion.
5. Un student solo puede ver oposiciones autorizadas.
6. La interfaz debe ser clara, elegante y con pocas acciones visibles.
7. Los permisos reales deben seguir protegidos en backend o servicios.

Manten la implementacion simple y compatible con SPEC 001 a SPEC 013. No rompas tests existentes.
