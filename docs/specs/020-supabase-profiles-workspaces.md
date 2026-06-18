# SPEC 020 - Supabase Repositories: Profiles & Workspaces

## 1. Objetivo

Implementar los primeros repositorios reales de Supabase para TESTOPO.

Esta spec inicia la migracion real del dominio a Supabase de forma limitada y controlada.

Se migran unicamente:

- `profiles`.
- `workspaces`.
- `workspace_members`.

No se migran todavia:

- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `questions`.
- `question_options`.
- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

## 2. Contexto

Specs previas relevantes:

- SPEC 018.2 - Supabase Auth & Database Foundation.
- SPEC 018.3 - Async Repository Layer.
- SPEC 018.4 - AI Question Generation & Review Feedback Loop.
- SPEC 018.4-B - OpenAI as Primary AI Provider.
- SPEC 019 - AI Syllabus Index Builder.

La SPEC 018.3 preparo las interfaces para que los repositorios puedan ser asincronos.

Ahora se implementa el primer bloque real contra Supabase:

```text
Auth user
  -> Profile
  -> Workspace
  -> WorkspaceMember
```

Este bloque es la base para que despues puedan migrarse oposiciones, materiales, preguntas y tests.

## 3. Branch

```text
feature/supabase-profiles-workspaces
```

## 4. Principio Central

La migracion a Supabase debe ser progresiva.

Correcto:

- Migrar `profiles`, `workspaces` y `workspace_members`.
- Mantener el resto en InMemory.
- Probar bien.
- Migrar oposiciones despues.

Incorrecto:

- Migrar todo el dominio de golpe.
- Romper tests.
- Cambiar reglas de negocio.
- Eliminar InMemory antes de tiempo.

## 5. Alcance

Claude debe implementar:

- Migraciones SQL para `profiles`.
- Migraciones SQL para `workspaces`.
- Migraciones SQL para `workspace_members`.
- Repositorio Supabase para profiles.
- Repositorio Supabase para workspaces.
- Repositorio Supabase para workspace members.
- Factory o selector de repositorios.
- Fallback a InMemory si Supabase no esta configurado.
- Adaptacion de servicios que usen estos repositorios.
- Tests del nuevo comportamiento.
- Documentacion minima de configuracion.

## 6. Fuera De Alcance

No implementar todavia:

- Repositorios Supabase de oposiciones.
- Repositorios Supabase de materiales.
- Repositorios Supabase de temas.
- Repositorios Supabase de preguntas.
- Repositorios Supabase de tests.
- Repositorios Supabase de resultados.
- RLS avanzada de todo el dominio.
- Edge Functions.
- Borrado real de usuarios Auth.
- Service role en frontend.
- Pagos.
- OAuth.
- Invitaciones avanzadas por email.
- Estadisticas.
- Beta readiness.

## 7. Tablas Afectadas

### 7.1 `profiles`

Tabla complementaria de `auth.users`.

Campos recomendados:

```text
id uuid primary key
email text not null
name text
role text not null default 'student'
status text not null default 'active'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Reglas:

- `id` debe coincidir con `auth.users.id`.
- No guardar contrasena.
- No duplicar autenticacion.
- El email viene de Supabase Auth.
- `role` global puede ser simple.
- Los permisos reales de workspace se controlan en `workspace_members`.

Valores permitidos para `role`:

- `admin`.
- `student`.

Valores permitidos para `status`:

- `active`.
- `inactive`.
- `blocked`.
- `deleted`.

### 7.2 `workspaces`

Campos recomendados:

```text
id uuid primary key
name text not null
slug text not null unique
type text not null
plan text not null
status text not null default 'active'
owner_id uuid not null references profiles(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `type`:

- `personal`.
- `organization`.

Valores permitidos para `plan`:

- `free`.
- `premium`.
- `organization`.

Valores permitidos para `status`:

- `active`.
- `inactive`.
- `suspended`.
- `archived`.

Reglas:

- `personal` debe usar plan `free` o `premium`.
- `organization` debe usar plan `organization`.

### 7.3 `workspace_members`

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
user_id uuid not null references profiles(id)
role text not null
status text not null default 'active'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `role`:

- `owner`.
- `admin`.
- `student`.

Valores permitidos para `status`:

- `active`.
- `revoked`.
- `pending`.

Restriccion recomendada:

```text
unique(workspace_id, user_id)
```

## 8. Migraciones

Crear migraciones en:

```text
/supabase/migrations
```

Ejemplo:

```text
/supabase/migrations/020_profiles_workspaces.sql
```

La migracion debe:

1. Crear tablas si no existen.
2. Crear constraints basicos.
3. Crear indices necesarios.
4. Crear funcion o trigger para `updated_at` si el proyecto usa ese patron.
5. Activar RLS basica si se usa Supabase directamente desde cliente.

## 9. Row Level Security Basica

Esta spec puede incluir RLS basica para estas tres tablas.

No hace falta implementar todavia toda la RLS del dominio.

Politicas minimas recomendadas:

`profiles`:

- Un usuario autenticado puede leer su propio perfil.
- Un usuario autenticado puede actualizar campos permitidos de su propio perfil.
- Un usuario no puede cambiar directamente su `role` global.

`workspaces`:

- Un usuario puede leer workspaces donde sea miembro activo.
- Un owner/admin puede actualizar workspace.
- Solo owner puede archivar workspace, si ya existe esa accion.

`workspace_members`:

- Un usuario puede leer membresias de workspaces donde sea miembro.
- Owner/admin puede gestionar miembros.
- Student no puede gestionar miembros.

Si la RLS completa complica demasiado esta spec, Claude debe:

- Activar RLS.
- Implementar politicas basicas.
- Documentar politicas pendientes.
- Mantener guards de aplicacion en servicios.

## 10. Repositorios Supabase

Crear implementaciones similares a:

- `SupabaseProfileRepository`.
- `SupabaseWorkspaceRepository`.
- `SupabaseWorkspaceMemberRepository`.

Deben cumplir las interfaces async existentes.

Ejemplo conceptual:

```ts
class SupabaseProfileRepository implements ProfileRepository {
  async findById(id: string): Promise<Profile | null> {}
  async findByEmail(email: string): Promise<Profile | null> {}
  async create(input: CreateProfileInput): Promise<Profile> {}
  async update(id: string, input: UpdateProfileInput): Promise<Profile> {}
}

class SupabaseWorkspaceRepository implements WorkspaceRepository {
  async findById(id: string): Promise<Workspace | null> {}
  async findBySlug(slug: string): Promise<Workspace | null> {}
  async listByUser(userId: string): Promise<Workspace[]> {}
  async create(input: CreateWorkspaceInput): Promise<Workspace> {}
  async update(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {}
}

class SupabaseWorkspaceMemberRepository implements WorkspaceMemberRepository {
  async listByWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {}
  async listByUser(userId: string): Promise<WorkspaceMember[]> {}
  async findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {}
  async create(input: CreateWorkspaceMemberInput): Promise<WorkspaceMember> {}
  async update(id: string, input: UpdateWorkspaceMemberInput): Promise<WorkspaceMember> {}
  async revoke(workspaceId: string, userId: string): Promise<WorkspaceMember> {}
}
```

Los nombres exactos pueden adaptarse al codigo existente.

## 11. Factory De Repositorios

Crear o adaptar un factory.

Objetivo:

```text
Si Supabase esta configurado -> usar repositorios Supabase
Si Supabase no esta configurado -> usar repositorios InMemory
```

Ejemplo conceptual:

```ts
const repositories = createRepositories({
  persistence: isSupabaseConfigured() ? 'supabase' : 'memory',
});
```

Reglas:

- No romper tests existentes.
- Tests pueden seguir usando InMemory.
- Supabase debe poder activarse por variables de entorno.
- No mezclar parcialmente un repo Supabase y otro InMemory sin decision explicita.

Para esta spec si puede haber mezcla controlada:

```text
profiles/workspaces/workspace_members -> Supabase
resto del dominio -> InMemory
```

Pero debe estar claro y documentado.

## 12. Variables De Entorno

Usar las variables ya previstas en SPEC 018.2.

Ejemplo:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DATABASE_URL
APP_PERSISTENCE_MODE
```

Recomendacion:

```text
APP_PERSISTENCE_MODE=memory
APP_PERSISTENCE_MODE=supabase
```

Reglas:

- No hardcodear claves.
- No subir `.env`.
- Actualizar `.env.example`.
- `SUPABASE_SERVICE_ROLE_KEY` nunca debe ir al frontend.

## 13. Integracion Con Auth

Cuando un usuario se registra mediante Supabase Auth, debe existir un perfil asociado en `profiles`.

Posibles estrategias:

Opcion A - Desde la aplicacion:

```text
Supabase Auth crea usuario
  -> App crea profile
  -> App crea workspace personal inicial si corresponde
```

Opcion B - Trigger SQL:

```text
Al insertarse en auth.users
  -> Trigger crea profile automaticamente
```

Para MVP, usar la opcion mas sencilla y estable segun el stack.

Regla:

- No debe existir usuario autenticado usable sin `profile`.

## 14. Workspace Personal Inicial

Si el flujo de producto lo requiere, al registrarse un usuario puede crearse un workspace personal inicial.

Ejemplo:

```text
Workspace personal de Miguel
type = personal
plan = free
status = active
owner_id = user.id
```

Y una membresia:

```text
role = owner
status = active
```

Si esto ya se implemento en SPEC 018.2, esta spec debe conectarlo a Supabase.

Si no se implemento, hacerlo ahora de forma minima.

## 15. Servicios Afectados

Actualizar servicios de:

- Profile.
- Account.
- Workspace.
- WorkspaceMember.
- Access control basico.

No modificar todavia servicios de:

- Opposition.
- Material.
- Topic.
- Question.
- Test.
- Attempt.
- Syllabus Index.
- AI Generation.

Salvo adaptaciones minimas necesarias para que compilen.

## 16. Permisos De Aplicacion

Mantener guards de aplicacion.

Aunque exista RLS, los servicios deben seguir comprobando:

- Usuario autenticado.
- Membership activa.
- Rol dentro de workspace.
- Owner/admin para gestion.
- Student sin acceso administrativo.

RLS no sustituye todavia al facade.

RLS es defensa adicional.

## 17. Estado Hibrido Permitido

Despues de esta spec, la app puede quedar en estado hibrido:

Supabase:

- Auth.
- `profiles`.
- `workspaces`.
- `workspace_members`.

InMemory:

- `oppositions`.
- `materials`.
- `topics`.
- `questions`.
- `tests`.
- `attempts`.
- AI syllabus proposals, si todavia no se migran.

Esto es correcto y esperado.

No intentar solucionar toda la persistencia en esta spec.

## 18. Errores Recomendados

- `PROFILE_NOT_FOUND`.
- `PROFILE_ALREADY_EXISTS`.
- `PROFILE_CREATE_FAILED`.
- `PROFILE_UPDATE_FAILED`.
- `WORKSPACE_NOT_FOUND`.
- `WORKSPACE_SLUG_ALREADY_EXISTS`.
- `WORKSPACE_CREATE_FAILED`.
- `WORKSPACE_UPDATE_FAILED`.
- `WORKSPACE_ACCESS_DENIED`.
- `WORKSPACE_MEMBER_NOT_FOUND`.
- `WORKSPACE_MEMBER_ALREADY_EXISTS`.
- `WORKSPACE_MEMBER_CREATE_FAILED`.
- `WORKSPACE_MEMBER_UPDATE_FAILED`.
- `WORKSPACE_MEMBER_REVOKE_FAILED`.
- `SUPABASE_NOT_CONFIGURED`.
- `SUPABASE_QUERY_FAILED`.
- `PERSISTENCE_MODE_INVALID`.

## 19. Tests Obligatorios

Deben existir tests para:

- Crear profile en Supabase repository.
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
- Owner queda como miembro owner.
- Student no puede gestionar workspace.
- Factory usa InMemory si Supabase no esta configurado.
- Factory usa Supabase si esta configurado.
- No se expone service role en frontend.
- Tests existentes siguen pasando.

Los tests que dependan de Supabase real deben poder ejecutarse de forma controlada.

Recomendacion:

- Unit tests con mocks.
- Integration tests opcionales si hay entorno Supabase configurado.
- CI debe poder pasar sin llamadas reales a Supabase si no esta configurado.

## 20. Documentacion

Actualizar o crear:

```text
/docs/setup/supabase-setup.md
/docs/architecture/persistence.md
```

Debe explicar:

- Que tablas ya estan migradas a Supabase.
- Que tablas siguen en memoria.
- Como activar Supabase.
- Como volver a modo InMemory.
- Que variables de entorno se necesitan.
- Que migraciones ejecutar.
- Que queda pendiente para specs futuras.

## 21. Estado Esperado Tras Esta Spec

Al terminar esta spec:

- Supabase Auth funciona.
- `profiles` esta en Supabase.
- `workspaces` esta en Supabase.
- `workspace_members` esta en Supabase.
- El resto del dominio sigue en memoria.

Esto es correcto.

No intentar "terminar Supabase" en esta spec.

## 22. Futuras Specs Previstas

Despues de esta spec, el orden logico sera:

- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.
- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
- SPEC 025 - Supabase RLS Hardening.
- SPEC 026 - Supabase Edge Functions for Account Deletion.

La numeracion puede ajustarse, pero el orden tecnico recomendado es ese.

## 23. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existen migraciones para `profiles`, `workspaces` y `workspace_members`.
- Existen repositorios Supabase para esas tablas.
- Las interfaces async se respetan.
- Existe fallback InMemory.
- El factory de repositorios funciona.
- Registro/login se conecta correctamente con `profiles`.
- Se puede crear workspace personal inicial.
- Se puede listar workspaces del usuario.
- Se puede gestionar membership basica.
- No se migran todavia oposiciones, materiales, temas, preguntas ni tests.
- No se expone `service_role` en frontend.
- `.env.example` esta actualizado.
- La documentacion explica el estado hibrido.
- Tests existentes siguen pasando.

## 24. Prompt Para Claude

Claude debe implementar la SPEC 020 - Supabase Repositories: Profiles & Workspaces.

Esta spec inicia la migracion real del dominio a Supabase, pero solo para:

- `profiles`.
- `workspaces`.
- `workspace_members`.

No migrar todavia:

- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `questions`.
- `question_options`.
- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Objetivo: dejar TESTOPO funcionando con Auth real y el primer bloque de dominio persistido en Supabase, manteniendo el resto del MVP estable.
