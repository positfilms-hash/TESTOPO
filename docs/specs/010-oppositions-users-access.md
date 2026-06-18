# SPEC 010 - Oppositions, Users & Access

## 1. Objetivo

Crear la base de usuarios, roles, oposiciones y control de acceso para TESTOPO.

Hasta ahora la app funciona principalmente como herramienta de administrador: subir material,
organizar temas, generar preguntas, revisarlas y crear tests.

A partir de esta spec, la app debe evolucionar hacia una plataforma con:

- Administradores que crean y gestionan oposiciones.
- Estudiantes que acceden solo a las oposiciones autorizadas.
- Materiales, temas, preguntas y tests asociados a una oposicion concreta.

## 2. Contexto del producto

El flujo conceptual sera:

```text
Administrador
  -> Crea oposicion
  -> Sube material
  -> Organiza temario
  -> Genera preguntas
  -> Revisa y aprueba preguntas
  -> Pool de preguntas validadas
  -> Estudiante autorizado
  -> Accede a esa oposicion
  -> Consulta material
  -> Crea tests desde el pool aprobado
  -> Realiza tests y revisa explicaciones
```

Principio central:

```text
Cada oposicion debe tener su propio material, temario, pool de preguntas y estudiantes autorizados.
```

## 3. Branch recomendada

```text
feature/oppositions-users-access
```

## 4. Alcance

Claude debe implementar la base funcional de:

- Modelo de usuario.
- Roles basicos.
- Modelo de oposicion.
- Relacion usuario-oposicion.
- Permisos basicos por rol.
- Asociacion de materiales a oposicion.
- Asociacion de temas a oposicion.
- Asociacion de preguntas a oposicion.
- Asociacion de tests a oposicion.
- Asociacion de intentos de test a oposicion.
- Acceso de estudiantes solo a oposiciones autorizadas.
- Migracion o adaptacion de datos existentes a una oposicion por defecto.
- Tests automaticos de reglas criticas.

## 5. Fuera de alcance

No implementar todavia:

- Sistema complejo de pagos.
- Suscripciones.
- Invitaciones por email.
- Recuperacion avanzada de contrasena.
- Roles empresariales complejos.
- Multi-academia.
- Marketplace de oposiciones.
- Estadisticas avanzadas por estudiante.
- Panel avanzado de alumnos.
- Chat.
- Comunidad.
- Ranking.
- Gamificacion.
- App movil nativa.

Esta spec crea la base de acceso, no toda la experiencia completa del estudiante.

## 6. Roles

Para el MVP deben existir dos roles principales:

- `admin`
- `student`

### admin

Puede:

- Crear oposiciones.
- Editar oposiciones.
- Subir y gestionar material.
- Crear y editar temas.
- Generar preguntas.
- Revisar preguntas.
- Aprobar preguntas.
- Rechazar preguntas.
- Marcar preguntas como obsoletas.
- Ver el pool de preguntas.
- Dar acceso a estudiantes a una oposicion.
- Retirar acceso a estudiantes.

### student

Puede:

- Ver las oposiciones a las que tiene acceso.
- Entrar en una oposicion autorizada.
- Ver material permitido de esa oposicion.
- Crear tests desde preguntas validadas de esa oposicion.
- Realizar tests.
- Ver resultados.
- Ver explicaciones y fuentes despues de responder.

No puede:

- Subir material.
- Generar preguntas.
- Editar preguntas.
- Validar preguntas.
- Aprobar preguntas.
- Rechazar preguntas.
- Ver oposiciones no autorizadas.
- Ver preguntas no validadas.
- Ver respuestas correctas antes de enviar un test.

## 7. Modelo de usuario

Crear un modelo llamado `User`.

Campos minimos:

- `id`
- `name`
- `email`
- `password_hash`
- `role`
- `status`
- `created_at`
- `updated_at`

### role

Valores permitidos:

- `admin`
- `student`

### status

Valores permitidos:

- `active`
- `inactive`
- `blocked`

Estado inicial recomendado:

- `active`

## 8. Autenticacion MVP

Si el proyecto ya tiene autenticacion, Claude debe adaptarse a ella.

Si todavia no existe autenticacion, implementar una solucion simple para MVP:

- Crear cuenta.
- Iniciar sesion.
- Cerrar sesion.
- Obtener usuario actual.
- Proteger acciones segun rol.

No sobredisenar autenticacion.

No implementar todavia:

- OAuth.
- Login con Google.
- Verificacion por email.
- Recuperacion avanzada de contrasena.
- 2FA.
- Gestion compleja de sesiones.

La contrasena nunca debe guardarse en texto plano.

## 9. Modelo de oposicion

Crear un modelo llamado `Opposition`.

Campos minimos:

- `id`
- `title`
- `description`
- `slug`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### title

Nombre visible de la oposicion.

Ejemplos:

- Auxiliar Administrativo del Estado
- Policia Nacional
- Tramitacion Procesal
- Administrativo Junta de Andalucia

Debe ser obligatorio.

### description

Descripcion opcional.

### slug

Identificador legible para URLs o rutas internas.

Ejemplos:

- `auxiliar-administrativo-estado`
- `policia-nacional`
- `tramitacion-procesal`

Debe ser unico.

### status

Valores permitidos:

- `active`
- `draft`
- `archived`

Estado inicial recomendado:

- `active`

### created_by

Usuario administrador que creo la oposicion.

### Adaptacion por SPEC 011

Si la SPEC 011 - Workspaces & Account Plans esta activa o ya fue implementada, `Opposition` no debe ser la entidad raiz del contenido. Debe pertenecer a un `Workspace`.

Campo adicional requerido en ese caso:

- `workspace_id`

Reglas:

- Una oposicion no puede existir sin workspace.
- El acceso a una oposicion debe respetar primero la membresia activa del workspace.
- El modelo de acceso de oposicion no debe contradecir el modelo de miembros del workspace.
- Materiales, temas, preguntas, tests e intentos pueden inferir el workspace desde `opposition_id`.

## 10. Relacion usuario-oposicion

Crear un modelo llamado `OppositionAccess`, `UserOpposition`, `Enrollment` o similar.

Campos minimos:

- `id`
- `user_id`
- `opposition_id`
- `role_in_opposition`
- `status`
- `granted_by`
- `created_at`
- `updated_at`

### role_in_opposition

Valores permitidos:

- `owner`
- `manager`
- `student`

Para el MVP:

- Un admin puede ser `owner` o `manager`.
- Un student sera `student`.

### status

Valores permitidos:

- `active`
- `revoked`
- `pending`

Para el MVP, puede usarse directamente `active`.

### granted_by

Administrador que concedio el acceso.

## 11. Asociacion de entidades existentes a oposicion

A partir de esta spec, estas entidades deben estar vinculadas a una oposicion:

- `Material`
- `Topic`
- `Question`
- `Test`
- `TestAttempt`

Campo recomendado:

- `opposition_id`

Debe anadirse a:

- Materiales.
- Temas.
- Preguntas.
- Tests.
- Intentos de test.

Si alguna entidad ya puede inferir la oposicion desde otra, aun asi debe garantizarse que no haya
mezcla entre oposiciones.

Ejemplo:

- Una pregunta debe pertenecer a una oposicion.
- Su tema debe pertenecer a la misma oposicion.
- Su material/fuente debe pertenecer a la misma oposicion.
- Un test de una oposicion solo puede usar preguntas de esa misma oposicion.

## 12. Migracion de datos existentes

Como ya existe un MVP previo, puede haber datos sin `opposition_id`.

Claude debe crear una estrategia simple:

- Crear una oposicion por defecto si no existe.
- Nombre sugerido: `Oposicion MVP`.
- Asociar materiales, temas, preguntas, tests e intentos existentes a esa oposicion por defecto.
- Documentar esta decision.
- No borrar datos existentes.

## 13. Reglas de acceso

### 13.1 Admin

Un usuario `admin` puede gestionar oposiciones donde tenga acceso como:

- `owner`
- `manager`

Para el MVP, si solo hay un admin global, puede gestionar todas las oposiciones, pero debe quedar
preparado para control por oposicion.

### 13.2 Student

Un usuario `student` solo puede ver oposiciones donde tenga acceso activo.

No puede acceder a material, preguntas, tests ni resultados de oposiciones no autorizadas.

### 13.3 Material

El estudiante puede ver material de una oposicion solo si:

- Tiene acceso activo a esa oposicion.
- El material esta en estado permitido para consulta.

Estados visibles recomendados para estudiante:

- `active`

No mostrar material:

- `obsolete`
- `deprecated`
- `needs_review`

salvo que una spec futura indique lo contrario.

### 13.4 Preguntas

El estudiante solo puede usar preguntas:

- De una oposicion autorizada.
- En estado `validated`.
- No obsoletas.
- Con fuente/material no obsoleto.
- Con tema no obsoleto.

No puede ver preguntas en:

- `draft`
- `pending_review`
- `needs_fix`
- `rejected`
- `obsolete`

### 13.5 Tests

Un estudiante solo puede crear tests dentro de una oposicion autorizada.

El test solo puede usar preguntas validadas de esa oposicion.

### 13.6 Resultados

Un estudiante solo puede ver sus propios intentos y resultados.

Si todavia no existe un modelo completo de usuario en intentos, anadir la relacion:

- `user_id`

a `TestAttempt`.

## 14. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 14.1 Crear usuario

Permitir crear usuario con:

- `name`
- `email`
- `password`
- `role`

Para el MVP, puede existir una funcion o endpoint administrativo para crear estudiantes.

### 14.2 Login

Permitir iniciar sesion con:

- `email`
- `password`

### 14.3 Obtener usuario actual

Permitir consultar el usuario autenticado.

### 14.4 Crear oposicion

Solo admin.

Entrada:

- `title`
- `description`
- `slug`
- `status`

### 14.5 Listar oposiciones del usuario

- Admin: oposiciones que gestiona.
- Student: oposiciones a las que tiene acceso.

### 14.6 Ver oposicion

Solo si el usuario tiene acceso.

### 14.7 Editar oposicion

Solo admin con acceso de gestion.

### 14.8 Dar acceso a estudiante

Solo admin.

Entrada:

- `user_id`
- `opposition_id`

Debe crear o activar relacion de acceso.

### 14.9 Revocar acceso

Solo admin.

Debe marcar la relacion como:

- `revoked`

No borrar historico.

### 14.10 Listar estudiantes de una oposicion

Solo admin con acceso a esa oposicion.

### 14.11 Crear material dentro de oposicion

La creacion de material debe requerir `opposition_id`.

### 14.12 Crear tema dentro de oposicion

La creacion de tema debe requerir `opposition_id`.

### 14.13 Crear o generar preguntas dentro de oposicion

La pregunta debe quedar vinculada a `opposition_id`.

### 14.14 Crear test dentro de oposicion

El generador de tests debe recibir o inferir `opposition_id`.

Debe seleccionar solo preguntas de esa oposicion.

## 15. Cambios en frontend basico

Adaptar el frontend minimo para reflejar dos zonas:

- Admin
- Estudiante

No hace falta diseno avanzado todavia.

### Admin

Debe poder:

- Ver oposiciones.
- Crear oposicion.
- Entrar en una oposicion.
- Gestionar material, temario, preguntas y tests de esa oposicion.
- Dar acceso a estudiantes.

### Estudiante

Debe poder:

- Ver "Mis oposiciones".
- Entrar en una oposicion.
- Ver material disponible.
- Crear test.
- Hacer test.
- Ver resultados.

Si esto complica demasiado la spec, priorizar backend/servicios y dejar UI minima.

## 16. Validaciones minimas

Errores recomendados:

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

## 17. Reglas criticas de integridad

### 17.1 No mezclar oposiciones

No se puede:

- Vincular una pregunta a un tema de otra oposicion.
- Vincular una pregunta a material de otra oposicion.
- Crear un test con preguntas de otra oposicion.
- Permitir que un estudiante acceda a material de otra oposicion.
- Permitir que un estudiante vea resultados de otro usuario.

Error recomendado:

- `OPPOSITION_ENTITY_MISMATCH`

### 17.2 No crear entidades sin oposicion

A partir de esta spec, no se deben crear nuevas entidades principales sin `opposition_id`.

Aplica a:

- `Material`
- `Topic`
- `Question`
- `Test`
- `TestAttempt`

### 17.3 Pool de preguntas por oposicion

El pool de preguntas validadas debe ser independiente por oposicion.

Cuando un estudiante crea un test dentro de una oposicion, el generador solo puede usar preguntas
validadas de esa oposicion.

## 18. Tests automaticos obligatorios

Deben existir tests para comprobar:

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

## 19. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe modelo de usuario.
- Existen roles `admin` y `student`.
- Existe modelo de oposicion.
- Existe relacion usuario-oposicion.
- El admin puede crear oposiciones.
- El admin puede dar acceso a estudiantes.
- El estudiante solo ve oposiciones autorizadas.
- Materiales, temas, preguntas, tests e intentos pertenecen a una oposicion.
- El pool de preguntas queda separado por oposicion.
- El generador de tests filtra por oposicion.
- No se pueden mezclar entidades de oposiciones distintas.
- Se migran o asignan datos existentes a una oposicion por defecto.
- Existen tests de reglas criticas.
- No se anaden funcionalidades fuera de alcance.

## 20. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del proyecto.

Prioridades:

- No romper el MVP existente.
- Anadir `opposition_id` de forma ordenada.
- Si la SPEC 011 esta activa, anadir tambien `workspace_id` a `Opposition` y mantener `Workspace` como entidad superior.
- Crear una oposicion por defecto para datos previos.
- Mantener reglas de acceso simples.
- Evitar sobredisenar autenticacion.
- Separar permisos en funciones reutilizables.
- No duplicar logica de negocio en frontend.
- Anadir tests de seguridad e integridad.

El objetivo de esta spec no es hacer una plataforma comercial completa, sino separar claramente:

- Admin gestiona oposicion.
- Estudiante estudia dentro de oposicion autorizada.

## 21. Prompt para Claude

Claude, implementa la SPEC 010 - Oppositions, Users & Access.

Estamos convirtiendo TESTOPO en una plataforma con dos zonas:

- Administrador.
- Estudiante.

Debes implementar:

- Modelo de usuario.
- Roles `admin` y `student`.
- Autenticacion basica si no existe.
- Modelo de oposicion.
- Relacion usuario-oposicion.
- Permisos basicos.
- Creacion y listado de oposiciones.
- Acceso de estudiantes a oposiciones autorizadas.
- Asociacion de materiales a oposicion.
- Asociacion de temas a oposicion.
- Asociacion de preguntas a oposicion.
- Asociacion de tests e intentos a oposicion.
- Filtro de tests por oposicion.
- Proteccion para no mezclar datos entre oposiciones.
- Migracion o asignacion de datos existentes a una oposicion por defecto.
- Tests automaticos de reglas criticas.

No implementes todavia:

- Pagos.
- Suscripciones.
- Invitaciones por email.
- OAuth.
- Recuperacion avanzada de contrasena.
- Roles complejos.
- Marketplace.
- Estadisticas avanzadas.
- Comunidad.
- Ranking.
- Gamificacion.

Reglas centrales:

1. Todo material, tema, pregunta, test e intento debe pertenecer a una oposicion.
2. Un estudiante solo puede acceder a oposiciones autorizadas por un administrador.
3. Un test de una oposicion solo puede usar preguntas validadas de esa oposicion.
4. El estudiante no puede ver ni usar preguntas no validadas.
5. El estudiante no puede ver respuestas correctas antes de enviar un test.

Mantén la implementacion simple, segura y compatible con las SPEC 001 a SPEC 009. No rompas los
tests existentes.
