# Claude Prompt - SPEC 011 Workspaces & Account Plans

## Context

TESTOPO ya tiene el flujo MVP:

```text
Material -> Temario -> Preguntas -> Validacion -> Revision -> Test -> Resultado
```

La SPEC 010 introduce usuarios, roles, oposiciones y control de acceso.

La SPEC 011 anade una entidad superior:

```text
User
  -> Workspace
      -> Opposition
          -> Material / Topic / Question / Test / TestAttempt
```

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/011-workspaces-account-plans.md
```

Branch de trabajo:

```text
feature/workspaces-account-plans
```

## Product Goal

Preparar TESTOPO para dos modelos:

- Premium Individual: un opositor tiene su workspace personal y crea su propio material, preguntas y tests.
- Organization: una academia, empresa o preparador gestiona oposiciones y da acceso a estudiantes.

No implementes pagos reales. Esta spec solo prepara la arquitectura.

## Required SPEC 010 Adaptation

Si la SPEC 010 ya esta implementada o en curso, adaptala asi:

- `Opposition` debe pertenecer a `Workspace`.
- `workspace_id` debe ser obligatorio en `Opposition`.
- El control de acceso por oposicion debe respetar primero la membresia del workspace.
- `OppositionAccess` o equivalente no debe contradecir `WorkspaceMember`.
- Si existen entidades con `opposition_id`, pueden inferir workspace desde `Opposition`.
- No dupliques usuarios, roles ni permisos si la SPEC 010 ya los creo.

La jerarquia esperada es:

```text
Workspace -> Opposition -> Material/Topic/Question/Test/TestAttempt
```

## Scope

Implementa:

- Modelo `Workspace`.
- Tipos `personal` y `organization`.
- Planes `free`, `premium` y `organization`.
- Modelo `WorkspaceMember`, `UserWorkspace` o equivalente.
- Roles de workspace: `owner`, `admin`, `student`.
- Asociacion obligatoria de `Opposition` a `Workspace`.
- Creacion de workspace personal.
- Creacion de workspace de organizacion.
- Listado de workspaces de un usuario.
- Ver workspace solo si el usuario es miembro activo.
- Edicion de workspace por owner/admin.
- Anadir miembro a workspace.
- Revocar miembro sin borrar historico.
- Crear oposiciones dentro de workspace.
- Listar oposiciones visibles dentro de workspace.
- Permisos reutilizables por workspace/oposicion.
- Migracion o asignacion de datos existentes a `Workspace MVP`.
- Adaptacion minima del frontend para mostrar workspace actual, oposicion actual, rol o plan.
- Tests automaticos de reglas criticas.

## Out of Scope

No implementes:

- Pagos reales.
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
- UI comercial compleja.

## Business Rules

- `Workspace` esta por encima de `Opposition`.
- Una oposicion no puede existir sin `workspace_id`.
- Un workspace puede tener varias oposiciones.
- Un workspace personal puede tener oposiciones creadas por su propietario.
- Un workspace de organizacion puede tener oposiciones gestionadas por owners/admins.
- El plan define el tipo de cuenta.
- El rol define permisos dentro del workspace.
- El plan y el rol no son lo mismo.
- Un usuario solo puede ver workspaces donde sea miembro activo.
- Un miembro revocado no puede acceder al workspace.
- Un student no puede crear oposiciones.
- Un owner/admin puede crear oposiciones.
- Un student solo puede estudiar en oposiciones permitidas dentro del workspace.
- No se pueden mezclar entidades entre workspaces.
- No se pueden mezclar entidades entre oposiciones.
- Si las entidades principales ya tienen `opposition_id`, no anadas `workspace_id` directo salvo que el stack lo necesite.
- No borres datos existentes.
- Los datos previos deben quedar bajo `Workspace MVP`.
- Si hay entidades sin oposicion, usa la estrategia de SPEC 010: oposicion por defecto dentro de `Workspace MVP`.

## Suggested Permission Functions

Centraliza la logica en funciones reutilizables. Nombres sugeridos:

- `canManageWorkspace(user, workspace)`
- `canCreateOpposition(user, workspace)`
- `canManageOpposition(user, opposition)`
- `canStudyOpposition(user, opposition)`
- `canReviewQuestions(user, opposition)`

No son nombres obligatorios, pero la logica no debe quedar duplicada en handlers ni frontend.

## Plan Limits

Puedes preparar limites por plan, pero no implementes pagos ni bloqueo complejo si no aporta al MVP.

Limites sugeridos:

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

Para esta spec basta estructura y validacion basica de plan.

## Validation Errors

Usa o adapta estos codigos de error si encajan con el stack actual:

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

## Frontend Notes

Adapta el frontend basico sin hacerlo comercial ni complejo.

Debe mostrar:

- Mis espacios.
- Workspace actual.
- Oposicion actual.
- Rol o plan cuando ayude.

Dentro de una oposicion, conserva el flujo existente:

- Material.
- Temario.
- Preguntas.
- Tests.
- Resultados.

No implementes pantallas de pagos, pricing, checkout, cupones ni facturacion.

## Required Tests

Anade o actualiza tests para comprobar:

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

## Acceptance Criteria

La implementacion esta lista cuando:

- Existe modelo `Workspace`.
- Existen tipos `personal` y `organization`.
- Existen planes `free`, `premium` y `organization`.
- Existe relacion usuario-workspace.
- Existen roles `owner`, `admin` y `student`.
- `Opposition` pertenece a `Workspace`.
- Un usuario puede listar sus workspaces.
- Un workspace puede tener miembros.
- Owner/admin pueden gestionar workspace y oposiciones.
- Student solo puede estudiar en espacios autorizados.
- Se impide mezclar entidades entre workspaces.
- Datos previos quedan asignados a un workspace por defecto.
- El frontend basico refleja workspace actual y oposicion actual.
- Existen tests de reglas criticas.
- No se implementan pagos reales.
- No se anaden funcionalidades fuera de alcance.

## Expected Output

Claude debe entregar:

- Codigo implementado en `feature/workspaces-account-plans`.
- Tests nuevos y existentes pasando.
- Documentacion breve de `Workspace MVP` y cualquier decision tecnica relevante.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Resumen de cambios.
- Tests ejecutados.
- Riesgos o decisiones tecnicas.
- Confirmacion explicita de que no se implementaron pagos, Stripe, facturacion, suscripciones reales, marketplace ni funcionalidades fuera de alcance.
