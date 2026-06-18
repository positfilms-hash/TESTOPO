# Claude Prompt - SPEC 020 Supabase Repositories: Profiles & Workspaces

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 020 - Supabase Repositories: Profiles & Workspaces
```

La app ya tiene:

- SPEC 018.2 - Supabase Auth & Database Foundation.
- SPEC 018.3 - repositorios/servicios async con `Promise` y `async/await`.
- SPEC 018.4 - AI Question Generation & Review Feedback Loop.
- SPEC 018.4-B - OpenAI como proveedor IA principal.
- SPEC 019 - AI Syllabus Index Builder.

Ahora empieza la migracion real del dominio a Supabase, pero solo con el primer bloque.

## Spec

Implementa estrictamente:

```text
/docs/specs/020-supabase-profiles-workspaces.md
```

Branch de trabajo:

```text
feature/supabase-profiles-workspaces
```

## Product Goal

Persistir en Supabase el bloque base de cuenta y espacios de trabajo:

- `profiles`.
- `workspaces`.
- `workspace_members`.

Mantener el resto del MVP estable y todavia en memoria.

Estado esperado tras esta spec:

```text
Supabase:
- Auth
- profiles
- workspaces
- workspace_members

InMemory:
- oppositions
- opposition_access
- materials
- topics
- questions
- question_options
- tests
- test_questions
- test_attempts
- test_answers
- AI syllabus proposals, salvo que ya exista otra decision explicita
```

## Non-Negotiable Rules

- No migres oposiciones.
- No migres opposition access.
- No migres materiales.
- No migres temas.
- No migres preguntas.
- No migres tests.
- No migres intentos/resultados.
- No cambies reglas de negocio.
- No elimines InMemory.
- Mantener fallback InMemory si Supabase no esta configurado.
- No hardcodees claves.
- No subas `.env`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- La service role key, si se necesita, solo puede vivir en backend/server tooling.
- CI/tests deben poder pasar sin Supabase real configurado.
- No implementes Edge Functions.
- No implementes borrado real de Auth user.
- No implementes pagos.
- No implementes OAuth.
- No implementes invitaciones avanzadas por email.
- No implementes beta readiness.

## Required Implementation

### 1. SQL migrations

Crear migracion en:

```text
/supabase/migrations/020_profiles_workspaces.sql
```

Debe crear, como minimo:

- `profiles`.
- `workspaces`.
- `workspace_members`.

Incluye:

- Primary keys.
- Foreign keys.
- Checks/enums via constraints.
- Unique `workspaces.slug`.
- Unique `workspace_members(workspace_id, user_id)`.
- Indices utiles.
- `created_at`.
- `updated_at`.
- Trigger/helper de `updated_at` si el proyecto usa ese patron.
- RLS basica si el stack ya trabaja con Supabase client directo.

RLS minima recomendada:

- `profiles`: cada usuario lee/actualiza su propio perfil, sin poder cambiar `role` global directamente.
- `workspaces`: miembros activos pueden leer; owner/admin pueden actualizar.
- `workspace_members`: miembros pueden leer membresias de sus workspaces; owner/admin gestionan.

Si RLS completa complica esta spec:

- Activa RLS.
- Implementa politicas basicas.
- Documenta politicas pendientes.
- Mantiene guards de aplicacion.

### 2. Supabase repositories

Crear repositorios Supabase que implementen las interfaces async existentes:

- `SupabaseProfileRepository`.
- `SupabaseWorkspaceRepository`.
- `SupabaseWorkspaceMemberRepository`.

Adapta nombres exactos al codigo real del repo.

Los repos deben mapear filas Supabase a modelos de dominio sin cambiar contratos de servicios.

### 3. Repository factory / persistence selector

Crear o adaptar factory para elegir persistencia:

```text
APP_PERSISTENCE_MODE=memory
APP_PERSISTENCE_MODE=supabase
```

Reglas:

- Si Supabase no esta configurado, usar InMemory.
- Si `APP_PERSISTENCE_MODE=memory`, usar InMemory.
- Si `APP_PERSISTENCE_MODE=supabase`, usar Supabase para `profiles/workspaces/workspace_members`.
- El resto del dominio debe seguir InMemory.
- Si la configuracion es invalida, devolver error claro.

### 4. Auth integration

Cuando un usuario se registra con Supabase Auth, debe existir `profile`.

Puedes elegir la opcion mas simple y estable:

- Crear profile desde aplicacion despues de signup.
- O usar trigger SQL sobre `auth.users`.

Regla central:

- No debe existir usuario autenticado usable sin profile.

Si corresponde, crear workspace personal inicial:

```text
type = personal
plan = free
status = active
owner_id = user.id
membership role = owner
membership status = active
```

### 5. Services affected

Puedes adaptar:

- Profile.
- Account.
- Workspace.
- WorkspaceMember.
- Access control basico.
- Auth bridge si hace falta para conectar `profile`.

No modifiques funcionalmente:

- Opposition.
- Material.
- Topic.
- Question.
- Test.
- Attempt.
- Syllabus Index.
- AI Generation.

Solo se permiten adaptaciones minimas para compilar con el nuevo factory.

## Required Tests

Anade tests para:

- Crear profile.
- Buscar profile por id.
- Buscar profile por email.
- Actualizar profile.
- Crear workspace.
- Buscar workspace por id.
- Buscar workspace por slug.
- Listar workspaces de un usuario.
- Crear workspace member.
- Buscar membership.
- Listar miembros de un workspace.
- Revocar membership.
- No duplicar membership `workspace_id + user_id`.
- Crear workspace personal inicial.
- Confirmar que el owner queda como miembro owner.
- Confirmar que student no puede gestionar workspace.
- Factory usa InMemory si Supabase no esta configurado.
- Factory usa Supabase si esta configurado.
- `SUPABASE_SERVICE_ROLE_KEY` no se expone al frontend.
- Tests existentes siguen pasando.

Los tests con Supabase real deben ser opcionales. Por defecto, CI debe pasar sin red ni Supabase real.

Preferencia:

- Unit tests con cliente Supabase mockeado.
- Integration tests reales solo si hay variables de entorno explicitas.

## Required Documentation

Actualizar o crear:

```text
/docs/setup/supabase-setup.md
/docs/architecture/persistence.md
```

Debe explicar:

- Que tablas estan en Supabase.
- Que tablas siguen en memoria.
- Como activar Supabase.
- Como volver a InMemory.
- Variables de entorno requeridas.
- Migraciones a ejecutar.
- Estado hibrido actual.
- Specs futuras pendientes.

Actualizar `.env.example` con placeholders seguros.

## Security Checklist

Antes de terminar, verifica:

- No hay claves reales en el repo.
- No hay `SUPABASE_SERVICE_ROLE_KEY` en codigo frontend.
- No hay `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- No se usa service role desde componentes React.
- No se loguean claves.
- `.env` sigue ignorado.
- RLS basica o documentacion explicita de pendientes.
- Guards de aplicacion siguen activos.

## Out Of Scope

No implementes:

- Repositorios Supabase para oposiciones.
- Repositorios Supabase para materiales.
- Repositorios Supabase para temas.
- Repositorios Supabase para preguntas.
- Repositorios Supabase para tests.
- Repositorios Supabase para resultados.
- RLS completa de todo el dominio.
- Edge Functions.
- Borrado real de Auth user.
- OAuth.
- Pagos.
- Invitaciones avanzadas.
- Estadisticas.
- Beta readiness.

## Acceptance Criteria

La PR estara lista para revision cuando:

- Existan migraciones para `profiles`, `workspaces`, `workspace_members`.
- Existan repositorios Supabase para esas tres areas.
- Las interfaces async se respeten.
- Exista fallback InMemory.
- El factory funcione con `memory` y `supabase`.
- Registro/login conecten correctamente con `profiles`.
- Se pueda crear workspace personal inicial.
- Se puedan listar workspaces del usuario.
- Se pueda gestionar membership basica.
- No se hayan migrado tablas fuera de alcance.
- No se exponga service role en frontend.
- `.env.example` este actualizado.
- La documentacion explique el estado hibrido.
- Tests existentes y nuevos pasen.

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de cambios.
- Migraciones creadas.
- Repositorios Supabase creados.
- Como activar modo Supabase.
- Que sigue en InMemory.
- Tests ejecutados.
- Confirmacion explicita de que no se migro nada fuera del bloque `profiles/workspaces/workspace_members`.
