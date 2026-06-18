# SPEC 021 - Supabase Repositories: Oppositions & Access

## 1. Objetivo

Migrar a Supabase el segundo bloque del dominio de TESTOPO:

- `oppositions`.
- `opposition_access`.

Esta spec continua la migracion progresiva iniciada en la SPEC 020.

Al terminar esta spec:

Supabase:

- Auth.
- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.

InMemory:

- `materials`.
- `topics`.
- `questions`.
- `question_options`.
- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.
- AI generation runs.
- Syllabus index proposals.

Este estado hibrido es correcto y esperado.

## 2. Contexto

Specs previas relevantes:

- SPEC 018.2 - Supabase Auth & Database Foundation.
- SPEC 018.3 - Async Repository Layer.
- SPEC 019 - AI Syllabus Index Builder.
- SPEC 020 - Supabase Repositories: Profiles & Workspaces.

La SPEC 020 creo o consolido:

- Migraciones Supabase.
- Repositorios Supabase para `profiles`, `workspaces` y `workspace_members`.
- Factory de repositorios.
- Fallback InMemory.
- Documentacion de persistencia hibrida.
- Tooling/runbook para proximas migraciones Supabase.

Esta SPEC 021 debe reutilizar ese tooling/runbook.

No crear un sistema paralelo de migracion.

Runbook obligatorio:

```text
docs/setup/migrations-runbook.md
```

### 2.1 Precondiciones De SPEC 020

Antes de aplicar migraciones reales en Supabase o validar end-to-end, Claude debe revisar y, si siguen presentes, corregir los bloqueantes detectados al cierre de SPEC 020:

- RLS/bootstrap del primer workspace: un usuario autenticado debe poder crear su workspace inicial y quedar como miembro `owner` sin depender de una membership previa imposible.
- `profiles.role` no debe poder modificarse directamente desde el frontend/cliente autenticado.

Estas correcciones pertenecen al bloque `profiles/workspaces/workspace_members` y son precondicion para que `oppositions` y `opposition_access` funcionen correctamente sobre workspaces reales.

## 3. Branch

```text
feature/supabase-oppositions-access
```

## 4. Principio Central

La migracion a Supabase sigue siendo progresiva.

Correcto:

- Migrar solo `oppositions` y `opposition_access`.
- Mantener `materials`, `topics`, `questions` y `tests` en memoria.
- Mantener tests existentes.
- Documentar estado hibrido.
- Usar el runbook de migraciones existente.

Incorrecto:

- Migrar todo el dominio de golpe.
- Romper el fallback InMemory.
- Cambiar reglas de negocio.
- Rehacer la arquitectura de repositorios.
- Ignorar el runbook ya creado.

## 5. Alcance

Claude debe implementar:

- Migracion SQL para `oppositions`.
- Migracion SQL para `opposition_access`.
- Repositorio Supabase para oposiciones.
- Repositorio Supabase para accesos a oposiciones.
- Adaptacion del factory/repositorio existente.
- Integracion con workspaces reales de Supabase.
- Tests unitarios y/o de integracion controlada.
- Actualizacion de documentacion de persistencia.
- Uso del tooling/runbook de migracion ya creado.

## 6. Fuera De Alcance

No implementar todavia:

- Supabase repositories para `materials`.
- Supabase repositories para `topics`.
- Supabase repositories para `questions`.
- Supabase repositories para `question_options`.
- Supabase repositories para `tests`.
- Supabase repositories para attempts/results.
- Migracion de archivos/PDFs a Supabase Storage.
- RLS completa de todo el dominio.
- Edge Functions.
- Borrado real de cuenta Auth.
- Pagos.
- OAuth.
- Invitaciones avanzadas por email.
- Beta readiness.

## 7. Tablas Afectadas

### 7.1 `oppositions`

Tabla que representa una oposicion dentro de un workspace.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
title text not null
description text
slug text not null
status text not null default 'draft'
created_by uuid not null references profiles(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `status`:

- `draft`.
- `active`.
- `archived`.

Restriccion recomendada:

```text
unique(workspace_id, slug)
```

Reglas:

- Una oposicion siempre pertenece a un workspace.
- No debe existir oposicion sin `workspace_id`.
- `created_by` debe ser un profile existente.
- El slug debe ser unico dentro del workspace.
- Un workspace puede tener varias oposiciones segun plan/limites futuros.
- Una oposicion archivada no debe mostrarse como activa al estudiante.

### 7.2 `opposition_access`

Tabla que representa el acceso de usuarios a una oposicion concreta.

Campos recomendados:

```text
id uuid primary key
opposition_id uuid not null references oppositions(id)
user_id uuid not null references profiles(id)
role_in_opposition text not null
status text not null default 'active'
granted_by uuid references profiles(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `role_in_opposition`:

- `owner`.
- `manager`.
- `student`.

Valores permitidos para `status`:

- `active`.
- `revoked`.
- `pending`.

Restriccion recomendada:

```text
unique(opposition_id, user_id)
```

Reglas:

- Un usuario no debe tener dos accesos duplicados a la misma oposicion.
- Student puede acceder solo a oposiciones con acceso activo.
- Owner y manager pueden gestionar contenido segun permisos de workspace.
- Revoked no debe permitir acceso.
- Pending no debe comportarse como active.

## 8. Relacion Con `workspace_members`

`workspace_members` controla pertenencia y rol dentro del workspace.

`opposition_access` controla acceso concreto a una oposicion.

Regla recomendada:

```text
Un usuario con acceso a una opposition debe pertenecer tambien al workspace correspondiente,
o el servicio debe crear/asegurar esa membresia de forma controlada si el flujo de producto lo requiere.
```

Para MVP:

- Owner/admin del workspace puede crear oposiciones.
- Owner/admin del workspace puede conceder acceso a estudiantes.
- Student necesita acceso activo a la oposicion para verla.
- Student no debe ver oposiciones de otros workspaces.
- Student no debe ver oposiciones archivadas salvo decision expresa.

## 9. Migraciones

Crear migracion en:

```text
supabase/migrations
```

Nombre obligatorio segun runbook:

```text
021_oppositions_access.sql
```

La migracion debe:

1. Crear `oppositions` si no existe.
2. Crear `opposition_access` si no existe.
3. Crear constraints.
4. Crear indices.
5. Crear trigger o funcion de `updated_at` si el proyecto ya usa ese patron.
6. Activar RLS basica si el patron de la SPEC 020 lo hizo.
7. No tocar tablas fuera de esta spec salvo referencias necesarias.

Debe seguir las reglas de idempotencia de:

```text
docs/setup/migrations-runbook.md
```

## 10. Indices Recomendados

Crear indices para:

- `oppositions.workspace_id`.
- `oppositions.created_by`.
- `oppositions.status`.
- `oppositions.workspace_id + slug`.
- `opposition_access.opposition_id`.
- `opposition_access.user_id`.
- `opposition_access.status`.
- `opposition_access.opposition_id + user_id`.

## 11. Row Level Security Basica

Esta spec puede incluir RLS basica para `oppositions` y `opposition_access`, siguiendo el patron de la SPEC 020.

No hace falta implementar todavia toda la defensa en profundidad del dominio. Eso sera una spec posterior.

Politicas minimas recomendadas:

`oppositions`:

- Usuario autenticado puede leer oposiciones de workspaces donde sea miembro activo.
- Student solo deberia ver oposiciones donde tenga `opposition_access.active`, si se aplica directamente desde RLS.
- Owner/admin de workspace puede crear oposicion.
- Owner/admin de workspace puede actualizar oposicion.
- Student no puede crear, actualizar ni archivar oposicion.

`opposition_access`:

- Owner/admin de workspace puede gestionar accesos.
- Usuario puede leer su propio acceso.
- Student no puede conceder accesos.
- Acceso revoked no debe conceder permisos.

Si la RLS completa complica esta spec:

- Activar RLS.
- Implementar politicas basicas.
- Mantener guards de aplicacion.
- Documentar politicas pendientes.

## 12. Repositorios Supabase

Crear implementaciones similares a:

- `SupabaseOppositionRepository`.
- `SupabaseOppositionAccessRepository`.

Deben cumplir las interfaces async existentes.

Ejemplo conceptual:

```ts
class SupabaseOppositionRepository implements OppositionRepository {
  async findById(id: string): Promise<Opposition | null> {}
  async findBySlug(workspaceId: string, slug: string): Promise<Opposition | null> {}
  async listByWorkspace(workspaceId: string): Promise<Opposition[]> {}
  async listByUser(userId: string): Promise<Opposition[]> {}
  async create(input: CreateOppositionInput): Promise<Opposition> {}
  async update(id: string, input: UpdateOppositionInput): Promise<Opposition> {}
  async archive(id: string): Promise<Opposition> {}
}

class SupabaseOppositionAccessRepository implements OppositionAccessRepository {
  async findAccess(oppositionId: string, userId: string): Promise<OppositionAccess | null> {}
  async listByOpposition(oppositionId: string): Promise<OppositionAccess[]> {}
  async listByUser(userId: string): Promise<OppositionAccess[]> {}
  async grant(input: GrantOppositionAccessInput): Promise<OppositionAccess> {}
  async update(id: string, input: UpdateOppositionAccessInput): Promise<OppositionAccess> {}
  async revoke(oppositionId: string, userId: string): Promise<OppositionAccess> {}
}
```

Los nombres exactos pueden adaptarse al codigo existente.

## 13. Factory De Repositorios

Actualizar el factory creado o consolidado en la SPEC 020.

Comportamiento esperado:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos usan InMemory

APP_PERSISTENCE_MODE=supabase
-> profiles/workspaces/workspace_members/oppositions/opposition_access usan Supabase
-> resto del dominio sigue en InMemory
```

El estado hibrido debe quedar explicito.

No mezclar de forma accidental repositorios Supabase e InMemory sin documentarlo.

## 14. Integracion Con Servicios

Actualizar servicios de:

- `OppositionService`.
- Opposition access guard.
- Student opposition listing.
- Admin opposition management.

No modificar todavia servicios de:

- `MaterialService`.
- `TopicService`.
- `QuestionService`.
- `TestGeneratorService`.
- `TestAttemptService`.
- AI generation.
- Syllabus index.

Salvo cambios minimos necesarios para compilar.

## 15. Reglas De Negocio Que Deben Mantenerse

Deben seguir cumpliendose:

1. No existe oposicion sin workspace.
2. Solo owner/admin puede crear oposicion en workspace.
3. Student no puede crear oposicion.
4. Student solo ve oposiciones autorizadas.
5. Student no ve oposiciones de otros workspaces.
6. Acceso revoked no permite entrada.
7. Slug de oposicion es unico dentro del workspace.
8. No se duplican accesos para el mismo usuario/oposicion.
9. Oposicion archivada no se trata como activa.
10. No se rompen permisos de workspace.

## 16. Estado Hibrido Permitido

Despues de esta spec, la app puede quedar asi:

Supabase:

- Auth.
- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.

InMemory:

- `materials`.
- `topics`.
- `questions`.
- `question_options`.
- `question_generation_runs`.
- `question_review_feedback`.
- `syllabus_index_runs`.
- `syllabus_index_proposals`.
- `tests`.
- `attempts`.
- `answers`.

Esto es correcto.

No migrar mas tablas en esta spec.

## 17. Variables De Entorno

Usar las variables existentes.

Ejemplo:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DATABASE_URL
APP_PERSISTENCE_MODE
```

Reglas:

- No hardcodear claves.
- No subir `.env`.
- Actualizar `.env.example` solo si hace falta.
- `SUPABASE_SERVICE_ROLE_KEY` nunca debe estar en frontend.
- Tests deben poder correr sin Supabase real si usan modo memory/mocks.

## 18. Errores Recomendados

- `OPPOSITION_NOT_FOUND`.
- `OPPOSITION_REQUIRED`.
- `OPPOSITION_WORKSPACE_REQUIRED`.
- `OPPOSITION_WORKSPACE_NOT_FOUND`.
- `OPPOSITION_SLUG_REQUIRED`.
- `OPPOSITION_SLUG_ALREADY_EXISTS`.
- `OPPOSITION_CREATE_FAILED`.
- `OPPOSITION_UPDATE_FAILED`.
- `OPPOSITION_ARCHIVE_FAILED`.
- `OPPOSITION_ACCESS_DENIED`.
- `OPPOSITION_ACCESS_NOT_FOUND`.
- `OPPOSITION_ACCESS_ALREADY_EXISTS`.
- `OPPOSITION_ACCESS_REVOKED`.
- `OPPOSITION_ACCESS_CREATE_FAILED`.
- `OPPOSITION_ACCESS_UPDATE_FAILED`.
- `OPPOSITION_ACCESS_REVOKE_FAILED`.
- `WORKSPACE_ACCESS_DENIED`.
- `SUPABASE_QUERY_FAILED`.
- `PERSISTENCE_MODE_INVALID`.

## 19. Tests Obligatorios

Deben existir tests para:

- Crear oposicion con workspace valido.
- No crear oposicion sin workspace.
- No crear oposicion con slug duplicado en el mismo workspace.
- Permitir mismo slug en workspaces distintos si la regla lo permite.
- Buscar oposicion por id.
- Buscar oposicion por slug dentro del workspace.
- Listar oposiciones por workspace.
- Archivar oposicion.
- Student no puede crear oposicion.
- Owner/admin puede crear oposicion.
- Conceder acceso a oposicion.
- No duplicar acceso usuario/oposicion.
- Revocar acceso.
- Acceso revoked no permite entrar.
- Student lista solo oposiciones autorizadas.
- Student no ve oposiciones de otros workspaces.
- Factory usa InMemory si Supabase no esta configurado.
- Factory usa Supabase para oppositions/access si esta configurado.
- Tests existentes siguen pasando.
- No se expone service role en frontend.

Tests de Supabase real deben ser controlados/opcionales si no hay entorno configurado.

## 20. Documentacion

Actualizar:

```text
docs/architecture/persistence.md
docs/setup/supabase-setup.md
```

Debe explicar:

- Que `oppositions` ya esta en Supabase.
- Que `opposition_access` ya esta en Supabase.
- Que sigue en memoria.
- Como ejecutar la migracion.
- Como usar el tooling/runbook creado por Claude.
- Como volver al modo memory.
- Que queda pendiente para specs futuras.
- Si Claude creo un runbook especifico, enlazarlo o referenciarlo.

## 21. Tooling/Runbook De Migracion

Claude debe usar el tooling/runbook existente para:

- Crear migracion.
- Verificar migracion.
- Anadir repositorio Supabase.
- Anadir tests.
- Actualizar factory.
- Actualizar documentacion.
- Validar que no se migran tablas fuera de alcance.

Si el runbook incluye comandos, scripts o checklist, seguirlos.

No duplicar tooling innecesariamente.

## 22. Estado Esperado Tras Esta Spec

Al terminar:

- Auth real funciona.
- Profiles funcionan en Supabase.
- Workspaces funcionan en Supabase.
- Workspace members funcionan en Supabase.
- Oppositions funcionan en Supabase.
- Opposition access funciona en Supabase.
- Materials siguen en memoria.
- Topics siguen en memoria.
- Questions siguen en memoria.
- Tests siguen en memoria.

Este estado es correcto.

## 23. Futuras Specs Previstas

Despues de esta spec, el orden recomendado sera:

- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.
- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
- SPEC 025 - Supabase RLS Hardening.
- SPEC 026 - Supabase Edge Functions for Account Deletion.
- SPEC 027 - Beta Readiness.

## 24. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existe migracion para `oppositions`.
- Existe migracion para `opposition_access`.
- Existen repositorios Supabase para ambas entidades.
- El factory de repositorios los usa en modo Supabase.
- El fallback InMemory sigue funcionando.
- Los servicios de oposicion funcionan igual que antes.
- Student solo ve oposiciones autorizadas.
- Owner/admin puede crear y gestionar oposiciones.
- No se duplican accesos.
- No se migran `materials`, `topics`, `questions` ni `tests`.
- La documentacion explica el nuevo estado hibrido.
- Se ha usado el tooling/runbook existente.
- No se expone `SUPABASE_SERVICE_ROLE_KEY`.
- Tests existentes siguen pasando.

## 25. Prompt Para Claude

Claude, implementa la SPEC 021 - Supabase Repositories: Oppositions & Access.

Debes continuar la migracion progresiva a Supabase usando el tooling/runbook que acabas de crear para futuras specs:

```text
docs/setup/migrations-runbook.md
```

Migra unicamente:

- `oppositions`.
- `opposition_access`.

No migres todavia:

- `materials`.
- `topics`.
- `questions`.
- `question_options`.
- `tests`.
- `attempts`.
- `answers`.
- AI generation runs.
- Syllabus index proposals.

Debes implementar:

1. Migraciones SQL para `oppositions` y `opposition_access`.
2. Repositorios Supabase para ambas entidades.
3. Adaptacion del factory de repositorios.
4. Integracion con `profiles`, `workspaces` y `workspace_members` de SPEC 020.
5. Fallback InMemory.
6. Tests criticos.
7. Documentacion del nuevo estado hibrido.
8. Uso del runbook/tooling existente.

Reglas obligatorias:

- Usa el tooling/runbook existente.
- No crees un proceso paralelo de migracion.
- No hardcodees claves.
- No subas `.env`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- No migres tablas fuera de alcance.
- Mantén el fallback InMemory.
- Mantén los tests existentes en verde.
- No cambies reglas de negocio.
- Documenta que queda en Supabase y que sigue en memoria.

Objetivo:

Dejar TESTOPO con workspaces y oposiciones reales persistidos en Supabase, manteniendo el resto del dominio estable para migrarlo en specs posteriores.
