# SPEC 025 - Supabase RLS Hardening

## 1. Objetivo

Endurecer la seguridad de TESTOPO en Supabase mediante Row Level Security.

Despues de la SPEC 024, el MVP principal ya esta persistido en Supabase. Ahora necesitamos que la base de datos tambien proteja los datos, no solo la capa de aplicacion.

Regla central:

```text
La seguridad debe existir en dos capas:
1. Guards de aplicacion.
2. Row Level Security en Supabase.
```

RLS no sustituye a los servicios de aplicacion.

Los servicios de aplicacion tampoco sustituyen a RLS.

Ambas capas deben coexistir.

## 2. Contexto

Specs previas relevantes:

- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.
- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.

Tablas ya migradas a Supabase:

- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.
- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.
- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Esta SPEC 025 debe usar el tooling/runbook existente:

```text
docs/setup/migrations-runbook.md
```

No crear un proceso paralelo de migracion o seguridad.

## 3. Branch

```text
feature/supabase-rls-hardening
```

## 4. Principio Central

La base de datos debe impedir accesos indebidos aunque haya un bug en frontend o en servicios.

Correcto:

```text
Student intenta leer preguntas pending_review
  -> Servicio lo bloquea
  -> RLS tambien lo bloquea
```

Incorrecto:

```text
Student no ve preguntas pendientes porque la UI no las muestra,
pero podria leerlas directamente desde Supabase.
```

## 5. Alcance

Claude debe implementar:

- Revision de todas las politicas RLS existentes.
- Activacion de RLS en todas las tablas sensibles.
- Politicas RLS completas por rol y entidad.
- Funciones SQL helper si facilitan las politicas.
- Tests de permisos.
- Documentacion de seguridad.
- Runbook de verificacion de RLS.
- Comprobacion de que service role no aparece en frontend.
- Validacion de que el fallback InMemory sigue funcionando en desarrollo/tests.

## 6. Fuera De Alcance

No implementar todavia:

- Edge Functions.
- Borrado real de cuenta Auth.
- Pagos.
- Auditoria avanzada.
- Logs de seguridad avanzados.
- Panel de administracion de seguridad.
- Exportacion de datos.
- Cifrado adicional propio.
- Multi-factor authentication.
- OAuth.
- Beta readiness.

La eliminacion real de cuenta mediante service role sera la SPEC 026.

## 7. Tablas Afectadas

RLS debe estar activado en:

- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.
- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.
- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Si alguna tabla no puede tener RLS completa todavia, debe documentarse explicitamente en:

```text
docs/security/rls-known-gaps.md
```

No ocultar gaps.

## 8. Principios De RLS

### 8.1 Deny By Default

Si no hay politica explicita, no debe haber acceso.

### 8.2 Auth Required

Las tablas sensibles no deben ser accesibles por usuarios anonimos.

### 8.3 Workspace Boundary

Un usuario solo puede acceder a datos de workspaces donde tenga membership activa.

### 8.4 Opposition Boundary

Un usuario solo puede acceder a oposiciones donde tenga permiso.

### 8.5 Student Limited Access

Student solo puede ver datos necesarios para estudiar.

No debe ver:

- Preguntas no validadas.
- Informes internos de validacion.
- Historial interno de revision.
- Feedback interno de IA.
- Generation runs internos.
- Respuestas correctas antes de enviar.
- Resultados de otros usuarios.
- Materiales obsoletos.
- Topics obsoletos.

### 8.6 Admin/Owner Scoped Access

Owner/admin puede gestionar datos, pero solo dentro de sus workspaces autorizados.

### 8.7 Service Role Only Server

La service role key solo puede usarse en servidor o tooling seguro.

Nunca en frontend.

## 9. Roles De Producto

RLS debe respetar los roles existentes:

Global profile role:

- `admin`.
- `student`.

Workspace role:

- `owner`.
- `admin`.
- `student`.

Opposition role:

- `owner`.
- `manager`.
- `student`.

Regla practica:

```text
Los permisos de gestion se basan sobre todo en workspace_members y opposition_access.
```

## 10. Funciones SQL Helper Recomendadas

Para simplificar politicas, Claude puede crear funciones SQL helper.

Ejemplos conceptuales:

```sql
is_workspace_member(workspace_id uuid)
is_workspace_admin(workspace_id uuid)
is_workspace_owner(workspace_id uuid)
has_active_opposition_access(opposition_id uuid)
is_opposition_manager(opposition_id uuid)
is_test_attempt_owner(attempt_id uuid)
```

Reglas:

- Las funciones deben ser seguras.
- No deben conceder permisos por error.
- Deben usar `auth.uid()`.
- Deben evitar logica circular si se usan dentro de politicas.
- Deben documentarse.

## 11. Politicas Por Tabla

### 11.1 `profiles`

Lectura:

- Un usuario puede leer su propio perfil.
- Owner/admin puede leer perfiles de miembros de workspaces que gestiona, si es necesario para gestionar alumnos.
- Student no debe poder listar perfiles arbitrarios.

Actualizacion:

- Un usuario puede actualizar campos permitidos de su propio perfil, como `name`.
- No debe poder modificar directamente `role`.
- No debe poder modificar directamente `status`.
- No debe poder modificar `email` si depende de Supabase Auth.
- Owner/admin no debe cambiar roles globales salvo flujo explicito futuro.

### 11.2 `workspaces`

Lectura:

- Un usuario puede leer workspaces donde sea miembro activo.

Creacion:

- Un usuario autenticado puede crear su workspace personal si el flujo lo permite.
- La creacion de organization workspace puede limitarse a perfiles autorizados o mantenerse controlada por servicio.

Actualizacion:

- Owner/admin puede actualizar workspace.
- Solo owner puede archivar workspace si esa accion existe.
- Student no puede editar workspace.

### 11.3 `workspace_members`

Lectura:

- Un usuario puede leer membresias de workspaces donde sea miembro activo.

Gestion:

- Owner/admin puede anadir, actualizar o revocar miembros.
- Student no puede gestionar miembros.
- Student no puede elevar su propio rol.

### 11.4 `oppositions`

Lectura:

- Owner/admin/manager puede leer oposiciones de sus workspaces.
- Student puede leer solo oposiciones con `opposition_access.status = active`.
- Student no debe leer oposiciones archivadas como activas.

Creacion:

- Owner/admin puede crear oposiciones en sus workspaces.
- Student no puede crear oposiciones.

Actualizacion:

- Owner/admin/manager puede actualizar oposiciones segun reglas existentes.
- Student no puede actualizar oposiciones.

### 11.5 `opposition_access`

Lectura:

- Un usuario puede leer su propio acceso.
- Owner/admin/manager puede leer accesos de oposiciones que gestiona.

Gestion:

- Owner/admin/manager puede conceder o revocar acceso segun reglas existentes.
- Student no puede conceder acceso.
- Student no puede darse acceso a una oposicion.

### 11.6 `materials`

Lectura admin:

- Owner/admin/manager puede leer materiales de sus oposiciones.

Lectura student:

- Student puede leer solo materiales con `opposition_access = active` y `material.status = active`.
- Student no debe leer materiales `obsolete`, `deprecated`, `needs_review`, de otras oposiciones o de otros workspaces.

Escritura:

- Owner/admin/manager puede crear y actualizar materiales.
- Student no puede crear, editar ni marcar obsolete.

### 11.7 `topics`

Lectura admin:

- Owner/admin/manager puede leer topics de sus oposiciones.

Lectura student:

- Student puede leer solo topics con `opposition_access = active` y `topic.status = active`.
- Student no debe leer topics `obsolete`, `deprecated` o `needs_review`.

Escritura:

- Owner/admin/manager puede crear y editar topics.
- Student no puede crear ni editar topics.

### 11.8 `material_topic_links`

Lectura:

- Owner/admin/manager puede leer links de sus oposiciones.
- Student puede leer links solo si material active, topic active y opposition_access active.

Escritura:

- Owner/admin/manager puede crear/eliminar links.
- Student no puede modificar links.

### 11.9 `material_import_batches` Y `material_import_items`

Lectura:

- Owner/admin/manager puede ver importaciones de sus oposiciones.
- Student no debe ver import batches/items.

Escritura:

- Owner/admin/manager puede crear batches/items.
- Student no puede crear importaciones.

### 11.10 `questions`

Lectura admin:

- Owner/admin/manager puede leer preguntas de sus oposiciones.

Lectura student:

- Student no debe acceder al banco administrativo de preguntas.
- Si se permite alguna lectura desde Supabase, debe limitarse a `question.status = validated` y `opposition_access = active`.
- Recomendacion MVP: Student consume preguntas solo a traves del flujo de test controlado.

Escritura:

- Owner/admin/manager puede crear y editar preguntas.
- Student no puede crear ni editar preguntas.

Regla critica:

- Student nunca puede leer `draft`, `pending_review`, `needs_fix`, `rejected` ni `obsolete`.

### 11.11 `question_options`

Lectura admin:

- Owner/admin/manager puede leer opciones completas, incluyendo `is_correct`.

Lectura student:

- Student no debe leer `is_correct` antes de enviar.
- RLS no oculta columnas por si sola.
- No exponer tabla `question_options` directamente al frontend student.
- Servir opciones mediante servicio controlado o crear vista/RPC segura sin `is_correct`.
- Para esta spec, Claude debe asegurar que el flujo student no accede directamente a `is_correct`.

Escritura:

- Owner/admin/manager puede gestionar opciones.
- Student no puede crear/editar opciones.

### 11.12 Validation, Reviews, Feedback Y Generation Runs

Tablas internas:

- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.

Lectura:

- Owner/admin/manager puede leerlas dentro de sus oposiciones.
- Student no puede leerlas.

Escritura:

- Owner/admin/manager puede crear registros segun flujo.
- Student no puede escribir en estas tablas.

Regla:

```text
El feedback y la revision son datos internos de calidad, no datos visibles para estudiantes.
```

### 11.13 `tests`

Lectura admin:

- Owner/admin/manager puede leer tests de sus oposiciones.

Lectura student:

- Student puede leer tests de oposiciones donde tiene acceso activo.

Creacion:

- Si Student puede generar tests propios, puede crear tests solo en oposiciones autorizadas.
- Si los tests son creados solo por admin, Student no puede crear tests administrativos.
- Claude debe respetar el comportamiento actual del producto.

Actualizacion:

- Owner/admin/manager puede cancelar/editar tests segun reglas existentes.
- Student no debe editar tests administrativos.

### 11.14 `test_questions`

Lectura admin:

- Owner/admin/manager puede leer test_questions de sus oposiciones.

Lectura student:

- Student puede leer test_questions de tests accesibles, pero no debe recibir `is_correct`.
- Como `is_correct` esta en `question_options`, el servicio debe controlar que datos se devuelven.

Escritura:

- Solo el servicio autorizado mediante usuario permitido debe crear test_questions.
- Student no debe poder anadir preguntas arbitrarias a un test existente.

### 11.15 `test_attempts`

Lectura student:

- Student puede leer solo sus propios attempts: `test_attempts.user_id = auth.uid()`.

Creacion student:

- Student puede crear attempts propios para tests accesibles.

Actualizacion student:

- Student puede actualizar/cancelar sus attempts mientras este permitido.
- No puede modificar attempts `submitted`.

Admin:

- Owner/admin/manager puede leer attempts de sus oposiciones solo si el producto lo permite.
- Si no existe seguimiento de alumnos todavia, limitarlo o documentarlo.

### 11.16 `test_answers`

Lectura student:

- Student puede leer solo answers de sus propios attempts.

Escritura student:

- Student puede crear/actualizar answers de sus attempts `in_progress`.
- No puede modificar answers tras submit.

Admin:

- Owner/admin/manager puede leer answers si el producto permite seguimiento.
- Si no esta decidido, mantener acceso restringido.

Regla critica:

- Un student no puede leer answers de otro `user_id`.

## 12. Vistas O RPC Seguras Recomendadas

Para evitar fugas de `is_correct`, puede ser recomendable crear una vista o RPC para el modo student.

Ejemplo conceptual:

```text
student_test_questions_view
```

Debe devolver:

- `test_question_id`.
- `question_id`.
- `statement`.
- Options sin `is_correct`.
- Order.
- Difficulty.

No debe devolver:

- `is_correct`.
- `correct_option`.
- `explanation` antes de submit.
- `source_excerpt` como solucion antes de submit.

Despues de submit, otra vista/RPC puede devolver revision completa.

Si no se implementan vistas/RPC en esta spec, documentar el plan y asegurar que los servicios actuales ya filtran esos campos.

## 13. Migraciones

Crear migracion en:

```text
supabase/migrations
```

Nombre obligatorio segun runbook:

```text
025_rls_hardening.sql
```

La migracion debe:

1. Activar RLS en todas las tablas sensibles.
2. Crear o actualizar helper functions.
3. Crear politicas de lectura.
4. Crear politicas de insercion.
5. Crear politicas de actualizacion.
6. Crear politicas de borrado si aplica.
7. Revocar accesos inseguros si existen.
8. No eliminar datos.
9. No cambiar modelos de datos salvo necesidad minima.
10. Documentar cualquier gap.

Debe seguir:

```text
docs/setup/migrations-runbook.md
```

## 14. Tests Obligatorios

Workspace boundaries:

- Usuario no puede leer workspace donde no es miembro.
- Student no puede gestionar miembros.
- Student no puede elevar su rol.
- Owner/admin puede gestionar miembros.

Opposition boundaries:

- Student ve solo oposiciones con access active.
- Student no ve oposiciones revoked.
- Student no ve oposiciones de otro workspace.
- Owner/admin ve oposiciones de su workspace.

Materials/topics:

- Student ve solo materials active.
- Student no ve materials obsolete.
- Student ve solo topics active.
- Student no ve topics obsolete.
- Student no puede crear material.
- Student no puede crear topic.

Questions:

- Student no ve preguntas `pending_review`.
- Student no ve preguntas `draft`.
- Student no ve preguntas `needs_fix`.
- Student no ve preguntas `rejected`.
- Student no ve preguntas `obsolete`.
- Owner/admin puede ver preguntas internas.
- Student no puede crear preguntas.
- Student no puede aprobar preguntas.

Options/security:

- Student no recibe `is_correct` antes de submit.
- Student no recibe explicacion antes de submit.
- Student no puede leer validation results.
- Student no puede leer reviews.
- Student no puede leer feedback.
- Student no puede leer generation runs.

Tests/attempts:

- Student crea attempt solo para test autorizado.
- Student no ve attempts de otro usuario.
- Student no ve answers de otro usuario.
- Student no modifica attempt `submitted`.
- Student no responde tras submit.
- Resultado solo visible al owner del attempt.

Admin/manager:

- Owner/admin puede gestionar su workspace.
- Owner/admin no puede gestionar otro workspace.
- Manager puede gestionar solo oposicion autorizada si ese rol existe.
- Admin no cruza oposiciones.

Service role:

- `SUPABASE_SERVICE_ROLE_KEY` no aparece en bundle frontend.
- `.env` no esta en repo.
- `.env.example` no contiene claves reales.

## 15. Documentacion

Crear o actualizar:

```text
docs/security/rls-policies.md
docs/security/rls-test-plan.md
docs/security/rls-known-gaps.md
docs/architecture/persistence.md
docs/setup/migrations-runbook.md
```

### 15.1 `docs/security/rls-policies.md`

Debe explicar:

- Que tablas tienen RLS.
- Que roles existen.
- Que puede hacer student.
- Que puede hacer owner/admin.
- Que puede hacer manager.
- Que datos son internos.
- Que datos son visibles al estudiante.
- Que politicas protegen cada tabla.

### 15.2 `docs/security/rls-test-plan.md`

Debe incluir pruebas manuales:

- Login como student A.
- Intentar leer attempt de student B.
- Intentar leer pregunta `pending_review`.
- Intentar leer `is_correct` antes de submit.
- Intentar crear material.
- Intentar crear topic.
- Intentar acceder a opposition revoked.

Tambien pruebas admin:

- Admin crea material en su workspace.
- Admin no puede editar workspace ajeno.
- Admin revisa pregunta propia.
- Admin no cruza oposicion.

### 15.3 `docs/security/rls-known-gaps.md`

Si hay algo pendiente, documentarlo claramente.

Ejemplos:

```text
La ocultacion de columnas is_correct se realiza actualmente en servicio, no en vista SQL.
```

```text
La lectura agregada de resultados por admin queda pendiente de definicion de producto.
```

No ocultar gaps.

## 16. Relacion Con Guards De Aplicacion

Despues de esta spec, los servicios de aplicacion deben seguir comprobando permisos.

No eliminar:

- `requireAuth`.
- `requireWorkspaceRole`.
- `requireOppositionAccess`.
- `requireAdmin`.
- `requireStudentAccess`.

RLS es defensa adicional, no reemplazo.

## 17. Relacion Con Fallback InMemory

El modo InMemory debe seguir funcionando para:

- Tests.
- Desarrollo local.
- Modo demo.
- CI sin Supabase real.

Los tests de RLS pueden ejecutarse solo cuando exista entorno Supabase configurado.

Los tests unitarios deben poder seguir pasando sin Supabase real.

## 18. Errores Recomendados

- `RLS_ACCESS_DENIED`.
- `RLS_POLICY_MISSING`.
- `RLS_UNSAFE_STUDENT_ACCESS`.
- `RLS_UNSAFE_ADMIN_ACCESS`.
- `RLS_SERVICE_ROLE_EXPOSED`.
- `RLS_STUDENT_CAN_READ_INTERNAL_DATA`.
- `RLS_STUDENT_CAN_READ_OTHER_ATTEMPT`.
- `RLS_STUDENT_CAN_READ_CORRECT_OPTION`.
- `RLS_WORKSPACE_BOUNDARY_BROKEN`.
- `RLS_OPPOSITION_BOUNDARY_BROKEN`.

## 19. Criterios De Aceptacion

La tarea se considera completada cuando:

- RLS esta activado en todas las tablas sensibles.
- Existen helper functions documentadas si se usan.
- Student no puede leer datos internos.
- Student no puede ver preguntas no validadas.
- Student no puede ver respuestas correctas antes de submit.
- Student no puede ver resultados de otros usuarios.
- Student no puede crear/editar material, topics o preguntas.
- Owner/admin puede gestionar solo sus workspaces/oposiciones.
- No se mezclan workspaces.
- No se mezclan oposiciones.
- Tests de permisos pasan.
- `.env` no esta en repo.
- `.env.example` no tiene claves reales.
- `SUPABASE_SERVICE_ROLE_KEY` no aparece en frontend.
- Existe documentacion de politicas RLS.
- Existe documentacion de gaps, aunque este vacia.
- Fallback InMemory sigue funcionando.
- No se cambian reglas de negocio.

## 20. Prompt Para Claude

Claude, implementa la SPEC 025 - Supabase RLS Hardening.

El MVP principal ya esta migrado a Supabase. Ahora debes endurecer la seguridad con Row Level Security.

Debes:

1. Usar el tooling/runbook existente.
2. Activar RLS en todas las tablas sensibles.
3. Crear o revisar helper functions.
4. Crear politicas para `profiles`, `workspaces`, `workspace_members`.
5. Crear politicas para `oppositions` y `opposition_access`.
6. Crear politicas para `materials`, `topics` y `material_topic_links`.
7. Crear politicas para `questions`, options, validation, reviews, feedback y generation runs.
8. Crear politicas para `tests`, `test_questions`, `test_attempts` y `test_answers`.
9. Anadir tests de permisos.
10. Documentar politicas.
11. Documentar gaps.
12. Verificar que service role no esta expuesta en frontend.

Reglas obligatorias:

- Student no puede acceder a datos internos.
- Student no puede ver preguntas no validadas.
- Student no puede ver `is_correct` antes de enviar test.
- Student no puede ver explicaciones antes de enviar test.
- Student no puede ver attempts o answers de otros usuarios.
- Owner/admin solo gestiona sus workspaces/oposiciones.
- No se mezclan workspaces.
- No se mezclan oposiciones.
- Mantener guards de aplicacion.
- No sustituir servicios por RLS.
- No usar service role en frontend.
- No cambiar reglas de negocio.
- Mantener fallback InMemory.
- Documentar cualquier limitacion pendiente.

No implementar todavia:

- Edge Functions.
- Borrado real de cuenta Auth.
- Pagos.
- OAuth.
- Auditoria avanzada.
- Beta readiness.

Objetivo:

Que TESTOPO tenga defensa en profundidad antes de la beta: permisos en la app y permisos en la base de datos.
