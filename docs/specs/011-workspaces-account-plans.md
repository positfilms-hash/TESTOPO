# SPEC 011 - Workspaces & Account Plans

## 1. Objetivo

Crear la estructura de `Workspace` y `AccountPlan` para TESTOPO.

Esta spec permite que la plataforma soporte dos modelos principales:

1. Premium Individual: un opositor crea su propio espacio, sube su material, genera preguntas y estudia por su cuenta.
2. Organization: una academia, empresa o preparador crea oposiciones, valida preguntas y da acceso a estudiantes.

El objetivo no es implementar pagos todavia. El objetivo es preparar la arquitectura para que la app pueda diferenciar tipos de cuenta, permisos y limites.

## 2. Contexto

Hasta ahora TESTOPO ha avanzado como una app con:

```text
Material -> Temario -> Preguntas -> Validacion -> Revision -> Test -> Resultado
```

Despues se anadio la idea de:

```text
Admin -> Oposicion -> Pool validado -> Estudiantes autorizados
```

Ahora anadimos una entidad superior:

```text
User
  -> Workspace
      -> Opposition
          -> Material / Topics / Questions / Tests / Results
```

Esto permite que un mismo usuario pueda:

- Tener su espacio personal Premium.
- Pertenecer como alumno a una academia.
- Gestionar una organizacion si es preparador o empresa.

## 3. Branch recomendada

```text
feature/workspaces-account-plans
```

## 4. Alcance

Claude debe implementar:

- Modelo de `Workspace`.
- Tipos de workspace.
- Modelo de plan o tipo de cuenta.
- Relacion usuario-workspace.
- Roles dentro del workspace.
- Asociacion de oposiciones a workspace.
- Reglas basicas de acceso segun workspace.
- Limites simples por plan, si se implementan de forma sencilla.
- Adaptacion de la SPEC 010 si ya existe.
- Migracion de datos existentes a un workspace por defecto.
- Tests automaticos de reglas criticas.

## 5. Fuera de alcance

No implementar todavia:

- Pasarela de pago.
- Stripe.
- Facturacion.
- Cupones.
- Gestion fiscal.
- Invitaciones por email.
- Marketplace.
- Planes comerciales avanzados.
- Limites dinamicos complejos.
- Multiempresa avanzada.
- Analitica comercial.
- Gestion de suscripciones reales.

Esta spec solo prepara la arquitectura.

## 6. Conceptos principales

### 6.1 User

Persona que usa la plataforma.

Puede ser:

- Administrador de una organizacion.
- Estudiante dentro de una organizacion.
- Usuario Premium individual.
- Usuario con varios accesos a distintos espacios.

### 6.2 Workspace

Espacio donde vive el contenido.

Un workspace puede representar:

- El espacio personal de un opositor.
- La cuenta de una academia.
- La cuenta de un preparador autonomo.
- La cuenta de una empresa de formacion.

### 6.3 Opposition

Una oposicion concreta dentro de un workspace.

Ejemplos:

- Auxiliar Administrativo del Estado.
- Policia Nacional.
- Tramitacion Procesal.
- Administrativo Junta de Andalucia.

### 6.4 Plan

Define las capacidades comerciales o limites del workspace.

Ejemplos:

- `free`
- `premium`
- `organization`

### 6.5 Role

Define que puede hacer un usuario dentro de un workspace.

Ejemplos:

- `owner`
- `admin`
- `student`

Importante:

- El plan y el rol no son lo mismo.
- Un plan define el tipo de cuenta.
- Un rol define lo que puede hacer una persona dentro de un workspace.

## 7. Modelo de Workspace

Crear un modelo llamado `Workspace`.

Campos minimos:

- `id`
- `name`
- `slug`
- `type`
- `plan`
- `status`
- `owner_id`
- `created_at`
- `updated_at`

### name

Nombre visible del espacio.

Ejemplos:

- Mi preparacion personal
- Academia OpoNorte
- Preparador Juan Perez

Debe ser obligatorio.

### slug

Identificador legible para rutas o referencias internas.

Debe ser unico.

Ejemplos:

- `mi-preparacion-personal`
- `academia-oponorte`
- `preparador-juan-perez`

### type

Tipo de workspace.

Valores permitidos:

- `personal`
- `organization`

### plan

Plan asociado.

Valores iniciales:

- `free`
- `premium`
- `organization`

Reglas recomendadas:

- `personal` -> `free` o `premium`
- `organization` -> `organization`

### status

Estado del workspace.

Valores permitidos:

- `active`
- `inactive`
- `suspended`
- `archived`

Estado inicial recomendado:

- `active`

### owner_id

Usuario propietario del workspace.

## 8. Modelo de relacion usuario-workspace

Crear un modelo llamado `WorkspaceMember`, `UserWorkspace` o similar.

Campos minimos:

- `id`
- `workspace_id`
- `user_id`
- `role`
- `status`
- `created_at`
- `updated_at`

### role

Valores permitidos:

- `owner`
- `admin`
- `student`

### status

Valores permitidos:

- `active`
- `revoked`
- `pending`

Para el MVP puede usarse directamente `active`.

## 9. Relacion con Opposition

A partir de esta spec, cada `Opposition` debe pertenecer a un `Workspace`.

Anadir a `Opposition`:

- `workspace_id`

Reglas:

- Una oposicion no puede existir sin `workspace_id`.
- Un workspace puede tener varias oposiciones.
- Un workspace personal puede tener oposiciones creadas por su propietario.
- Un workspace de organizacion puede tener oposiciones gestionadas por owners/admins.
- Un estudiante solo puede acceder a oposiciones permitidas dentro de un workspace.

## 10. Relacion con entidades existentes

La estructura final debe ser:

```text
Workspace
  -> Opposition
      -> Material
      -> Topic
      -> Question
      -> Test
      -> TestAttempt
```

Si `Material`, `Topic`, `Question`, `Test` y `TestAttempt` ya tienen `opposition_id`, no hace falta anadir `workspace_id` directamente a todas ellas, siempre que se pueda inferir correctamente desde la oposicion.

Regla critica:

- No se pueden mezclar entidades de distintas oposiciones ni de distintos workspaces.

## 11. Tipos de cuenta

### 11.1 Free

Pensado para probar la app.

Capacidades sugeridas para el futuro:

- Crear 1 workspace personal.
- Crear 1 oposicion personal.
- Subir poco material.
- Generar pocas preguntas.
- Hacer tests limitados.

Para el MVP, no hace falta aplicar limites estrictos si complica el desarrollo.

### 11.2 Premium Individual

Pensado para opositores que estudian por libre.

Puede:

- Crear su workspace personal.
- Crear oposiciones personales.
- Subir su propio material.
- Generar preguntas desde su material.
- Revisar sus preguntas.
- Crear tests personalizados.
- Ver resultados y explicaciones.
- Acceder a sus fuentes.

No necesita alumnos.

### 11.3 Organization

Pensado para academias, preparadores, empresas o autonomos.

Puede:

- Crear workspace de organizacion.
- Crear una o varias oposiciones.
- Subir material.
- Generar preguntas.
- Revisar y validar pool de preguntas.
- Dar acceso a estudiantes.
- Retirar acceso a estudiantes.
- Permitir que los estudiantes hagan tests.

## 12. Permisos por workspace

### 12.1 Owner

Puede:

- Editar workspace.
- Crear oposiciones.
- Gestionar material.
- Gestionar temas.
- Generar preguntas.
- Revisar preguntas.
- Aprobar preguntas.
- Gestionar estudiantes.
- Ver tests y resultados propios o permitidos.

### 12.2 Admin

Puede:

- Gestionar oposiciones dentro del workspace.
- Subir material.
- Gestionar temas.
- Generar preguntas.
- Revisar preguntas.
- Aprobar preguntas.
- Gestionar estudiantes si el owner lo permite.

Para el MVP, admin puede tener casi los mismos permisos que owner, excepto borrar o archivar workspace.

### 12.3 Student

Puede:

- Ver oposiciones a las que tenga acceso.
- Ver material activo permitido.
- Crear tests desde preguntas validadas.
- Hacer tests.
- Ver resultados.
- Ver explicaciones y fuentes despues de responder.

No puede:

- Crear material.
- Generar preguntas.
- Revisar preguntas.
- Aprobar preguntas.
- Editar pool de preguntas.
- Ver preguntas no validadas.
- Ver material obsoleto o en revision.

## 13. Workspace personal Premium

Un usuario con workspace personal y plan premium debe poder actuar como dueno de su propio contenido.

Flujo:

```text
Usuario Premium
  -> Crea oposicion personal
  -> Sube material propio
  -> Genera preguntas
  -> Revisa o corrige preguntas
  -> Crea tests
  -> Estudia
```

Para el MVP, el usuario Premium puede usar el mismo flujo de revision que el administrador, pero dentro de su workspace personal.

## 14. Workspace de organizacion

Una organizacion debe permitir el flujo B2B/B2B2C:

```text
Owner/Admin
  -> Crea oposicion
  -> Sube material
  -> Genera preguntas
  -> Revisa y valida preguntas
  -> Da acceso a estudiantes
  -> Estudiantes hacen tests
```

El estudiante no debe poder alterar el pool de preguntas.

## 15. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 15.1 Crear workspace personal

Debe poder crearse un workspace personal para un usuario.

Entrada:

- `name`
- `slug`
- `plan`
- `owner_id`

Reglas:

- `type` debe ser `personal`.
- `plan` debe ser `free` o `premium`.
- El usuario debe quedar como `owner`.

### 15.2 Crear workspace de organizacion

Debe poder crearse un workspace de organizacion.

Entrada:

- `name`
- `slug`
- `owner_id`

Reglas:

- `type` debe ser `organization`.
- `plan` debe ser `organization`.
- El usuario creador debe quedar como `owner`.

### 15.3 Listar workspaces del usuario

Debe devolver los workspaces donde el usuario es miembro activo.

### 15.4 Ver workspace

Solo usuarios miembros activos pueden ver el workspace.

### 15.5 Editar workspace

Solo `owner` o `admin`.

Para el MVP:

- `owner` puede editar todo.
- `admin` puede editar nombre o descripcion si existe.
- `student` no puede editar.

### 15.6 Anadir miembro a workspace

Solo `owner` o `admin`.

Debe permitir anadir usuarios con rol:

- `admin`
- `student`

Para el MVP no hace falta invitacion por email; puede anadirse directamente por usuario existente.

### 15.7 Revocar miembro

Solo `owner` o `admin`.

Debe cambiar estado a:

- `revoked`

No borrar historico.

### 15.8 Crear oposicion dentro de workspace

Toda oposicion debe requerir `workspace_id`.

Solo pueden crear oposicion:

- `owner`
- `admin`

En workspace personal, el propietario Premium puede crear sus oposiciones personales.

### 15.9 Listar oposiciones de workspace

Debe devolver las oposiciones visibles para el usuario segun su rol y accesos.

### 15.10 Comprobar permiso

Crear funciones reutilizables de permisos, por ejemplo:

- `canManageWorkspace(user, workspace)`
- `canCreateOpposition(user, workspace)`
- `canManageOpposition(user, opposition)`
- `canStudyOpposition(user, opposition)`
- `canReviewQuestions(user, opposition)`

No es obligatorio usar estos nombres exactos, pero la logica debe quedar centralizada.

## 16. Limites basicos por plan

Para el MVP, los limites pueden quedar preparados sin aplicar pagos reales.

Limites recomendados:

```text
free:
  max_workspaces: 1
  max_oppositions: 1
  max_materials: 3
  max_generated_questions: 50

premium:
  max_workspaces: 1
  max_oppositions: 5
  max_materials: 100
  max_generated_questions: 5000

organization:
  max_workspaces: unlimited or high
  max_oppositions: high
  max_students: high
  max_materials: high
  max_generated_questions: high
```

Para el MVP, puede implementarse solo estructura y validacion basica de plan.

No hace falta bloquear limites si complica demasiado.

## 17. Migracion de datos existentes

Si ya existen usuarios, oposiciones o datos sin workspace:

1. Crear un workspace por defecto.
2. Nombre sugerido: `Workspace MVP`.
3. Tipo: `organization`.
4. Plan: `organization`.
5. Asociar las oposiciones existentes a ese workspace.
6. Si existen entidades sin oposicion, mantener la estrategia de SPEC 010: asignarlas a una oposicion por defecto dentro de ese workspace.
7. No borrar datos existentes.

## 18. Reglas de integridad

### 18.1 No oposicion sin workspace

No se puede crear una oposicion sin `workspace_id`.

Error recomendado:

- `WORKSPACE_REQUIRED`

### 18.2 No acceso sin membresia

Un usuario no puede acceder a un workspace si no es miembro activo.

Error recomendado:

- `WORKSPACE_ACCESS_DENIED`

### 18.3 No mezcla entre workspaces

No se puede:

- Vincular oposicion a workspace inexistente.
- Vincular material de una oposicion de otro workspace.
- Usar preguntas de una oposicion de otro workspace.
- Permitir que un estudiante vea oposiciones de workspace no autorizado.

Error recomendado:

- `WORKSPACE_ENTITY_MISMATCH`

### 18.4 Owner obligatorio

Todo workspace debe tener un owner.

Error recomendado:

- `WORKSPACE_OWNER_REQUIRED`

### 18.5 Slug unico

No se pueden crear dos workspaces con el mismo slug.

Error recomendado:

- `WORKSPACE_SLUG_ALREADY_EXISTS`

## 19. Validaciones minimas

Errores recomendados:

- `WORKSPACE_NAME_REQUIRED`
- `WORKSPACE_SLUG_REQUIRED`
- `WORKSPACE_SLUG_ALREADY_EXISTS`
- `WORKSPACE_INVALID_TYPE`
- `WORKSPACE_INVALID_PLAN`
- `WORKSPACE_INVALID_STATUS`
- `WORKSPACE_OWNER_REQUIRED`
- `WORKSPACE_NOT_FOUND`
- `WORKSPACE_ACCESS_DENIED`
- `WORKSPACE_MEMBER_NOT_FOUND`
- `WORKSPACE_MEMBER_ALREADY_EXISTS`
- `WORKSPACE_MEMBER_INVALID_ROLE`
- `WORKSPACE_MEMBER_INVALID_STATUS`
- `WORKSPACE_ENTITY_MISMATCH`
- `WORKSPACE_REQUIRED`
- `PLAN_LIMIT_EXCEEDED`
- `OPPOSITION_WORKSPACE_REQUIRED`

## 20. Cambios en frontend basico

Adaptar el frontend para que tenga sentido con workspaces.

### Entrada inicial

Despues de login o seleccion de usuario, mostrar:

- Mis espacios

Ejemplos:

- Mi preparacion personal
- Academia OpoNorte
- Preparador Juan Perez

### Dentro de un workspace

Mostrar oposiciones de ese workspace.

### Dentro de una oposicion

Mantener las secciones ya existentes:

- Material
- Temario
- Preguntas
- Tests
- Resultados

### Diferencia visual simple

Para el MVP basta con mostrar claramente:

```text
Workspace actual: Academia OpoNorte
Oposicion actual: Auxiliar Administrativo
Rol: Admin
```

o:

```text
Workspace actual: Mi preparacion personal
Plan: Premium
```

No implementar todavia UI comercial compleja.

## 21. Tests automaticos obligatorios

Deben existir tests para comprobar:

- Se puede crear workspace personal.
- Se puede crear workspace de organizacion.
- No se puede crear workspace sin nombre.
- No se puede crear workspace con slug duplicado.
- No se puede crear workspace con tipo invalido.
- No se puede crear workspace con plan invalido.
- Todo workspace tiene owner.
- El owner queda como miembro activo.
- Se pueden listar workspaces de un usuario.
- Un usuario no ve workspaces donde no es miembro.
- Se puede anadir un student a un workspace.
- Se puede anadir un admin a un workspace.
- No se puede anadir miembro con rol invalido.
- Se puede revocar un miembro.
- Un miembro revocado no puede acceder.
- Se puede crear oposicion dentro de workspace.
- No se puede crear oposicion sin workspace.
- Un student no puede crear oposicion.
- Un owner/admin puede crear oposicion.
- Una oposicion pertenece a un workspace.
- No se pueden mezclar entidades entre workspaces.
- Se crea workspace por defecto para datos existentes, si aplica.
- No se rompen tests existentes de SPEC 001 a SPEC 010.

## 22. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe modelo `Workspace`.
- Existen tipos `personal` y `organization`.
- Existen planes `free`, `premium` y `organization`.
- Existe relacion usuario-workspace.
- Existen roles `owner`, `admin` y `student`.
- Una oposicion pertenece a un workspace.
- Un usuario puede listar sus workspaces.
- Un workspace puede tener miembros.
- Un owner/admin puede gestionar workspace y oposiciones.
- Un student solo puede estudiar en espacios autorizados.
- Se impide mezclar entidades entre workspaces.
- Se migran o asignan datos previos a un workspace por defecto.
- El frontend basico refleja workspace actual y oposicion actual.
- Existen tests de reglas criticas.
- No se implementan pagos reales.
- No se anaden funcionalidades fuera de alcance.

## 23. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del proyecto.

Prioridades:

- No romper el MVP existente.
- Integrar con SPEC 010 si ya fue implementada.
- Mantener `Workspace` como entidad superior a `Opposition`.
- Separar claramente plan y role.
- Centralizar permisos.
- No implementar pagos.
- No sobredisenar limites.
- Anadir tests de acceso e integridad.

Si la SPEC 010 ya anadio usuarios, roles y oposiciones, esta spec debe extender ese modelo, no duplicarlo.

## 24. Prompt para Claude

Claude, implementa la SPEC 011 - Workspaces & Account Plans.

Estamos adaptando TESTOPO para soportar dos modelos de negocio:

1. Usuarios Premium individuales que crean su propio material, preguntas y tests.
2. Organizaciones, academias o preparadores que crean oposiciones y dan acceso a estudiantes.

Debes implementar:

- Modelo `Workspace`.
- Tipos `personal` y `organization`.
- Planes `free`, `premium` y `organization`.
- Relacion usuario-workspace.
- Roles `owner`, `admin` y `student`.
- Asociacion de `Opposition` a `Workspace`.
- Permisos basicos por workspace.
- Listado de workspaces del usuario.
- Creacion de workspace personal.
- Creacion de workspace de organizacion.
- Anadir y revocar miembros.
- Crear oposiciones dentro de workspace.
- Migracion o asignacion de datos existentes a un workspace por defecto.
- Adaptacion minima del frontend para mostrar workspace actual.
- Tests automaticos de reglas criticas.

No implementes todavia:

- Pagos reales.
- Stripe.
- Facturacion.
- Cupones.
- Invitaciones por email.
- Marketplace.
- Roles empresariales complejos.
- Analitica comercial.
- Limites dinamicos avanzados.

Reglas centrales:

1. `Workspace` esta por encima de `Opposition`.
2. Toda oposicion debe pertenecer a un workspace.
3. El plan define el tipo de cuenta.
4. El rol define que puede hacer un usuario dentro de un workspace.
5. Un usuario Premium puede tener un workspace personal.
6. Una organizacion puede tener alumnos con acceso controlado.
7. No se pueden mezclar entidades entre workspaces.

Manten la implementacion simple, compatible con SPEC 001 a SPEC 010 y sin romper tests existentes.
