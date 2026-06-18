# Claude Prompt - SPEC 021 Supabase Repositories: Oppositions & Access

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 021 - Supabase Repositories: Oppositions & Access
```

La app ya tiene:

- SPEC 018.2 - Supabase Auth & Database Foundation.
- SPEC 018.3 - repositorios/servicios async con `Promise` y `async/await`.
- SPEC 019 - AI Syllabus Index Builder.
- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- Tooling/runbook de migraciones Supabase.

## Spec

Implementa estrictamente:

```text
docs/specs/021-supabase-oppositions-access.md
```

Branch de trabajo:

```text
feature/supabase-oppositions-access
```

Runbook obligatorio:

```text
docs/setup/migrations-runbook.md
```

No crees un proceso paralelo de migracion.

## Pre-flight SPEC 020

Antes de aplicar/validar migraciones reales en Supabase, revisa los bloqueantes detectados por Codex al cierre de SPEC 020 y corrige si siguen presentes:

- RLS/bootstrap del primer workspace: un usuario autenticado debe poder crear su workspace inicial y quedar como miembro `owner` sin depender de una membership previa imposible.
- `profiles.role` no debe poder modificarse directamente desde frontend/cliente autenticado.

Estas correcciones son precondicion para que `oppositions` y `opposition_access` funcionen sobre workspaces reales.

## Product Goal

Persistir en Supabase el segundo bloque del dominio:

- `oppositions`.
- `opposition_access`.

Estado esperado tras esta spec:

```text
Supabase:
- Auth
- profiles
- workspaces
- workspace_members
- oppositions
- opposition_access

InMemory:
- materials
- topics
- questions
- question_options
- tests
- test_questions
- test_attempts
- test_answers
- AI generation runs
- syllabus index proposals
```

## Non-Negotiable Rules

- Usa `docs/setup/migrations-runbook.md`.
- No migres materiales.
- No migres temas.
- No migres preguntas.
- No migres tests.
- No migres intentos/resultados.
- No migres archivos/PDFs a Supabase Storage.
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

### 1. SQL migration

Crear:

```text
supabase/migrations/021_oppositions_access.sql
```

Debe seguir el runbook:

- Nombre alineado con la SPEC.
- Idempotente.
- Sin datos reales ni claves.
- `updated_at` + trigger.
- RLS basica.
- Documentacion actualizada.

Debe crear o consolidar:

- `oppositions`.
- `opposition_access`.

Incluye:

- Primary keys.
- Foreign keys.
- Checks.
- Unique `oppositions(workspace_id, slug)`.
- Unique `opposition_access(opposition_id, user_id)`.
- Indices utiles.
- RLS basica.

No tocar tablas fuera de alcance salvo referencias necesarias.

### 2. Supabase repositories

Crear repositorios Supabase que implementen las interfaces async existentes:

- `SupabaseOppositionRepository`.
- `SupabaseOppositionAccessRepository`.

Adapta nombres exactos al codigo real del repo.

Los repos deben mapear filas Supabase a modelos de dominio sin cambiar contratos de servicios.

### 3. Repository factory / persistence selector

Actualizar el factory de la SPEC 020 para que:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos siguen InMemory

APP_PERSISTENCE_MODE=supabase
-> profiles/workspaces/workspace_members/oppositions/opposition_access usan Supabase
-> resto del dominio sigue InMemory
```

El estado hibrido debe quedar claro y documentado.

### 4. Services affected

Puedes adaptar:

- `OppositionService`.
- Guards de acceso workspace/opposition.
- Listados de oposiciones de estudiante.
- Gestion admin de oposiciones.

No modifiques funcionalmente:

- `MaterialService`.
- `TopicService`.
- `QuestionService`.
- `TestGeneratorService`.
- `TestAttemptService`.
- AI generation.
- Syllabus index.

Solo se permiten adaptaciones minimas para compilar con el nuevo factory.

## Required Tests

Anade tests para:

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
- `SUPABASE_SERVICE_ROLE_KEY` no se expone al frontend.
- Tests existentes siguen pasando.

Los tests con Supabase real deben ser opcionales. Por defecto, CI debe pasar sin red ni Supabase real.

## Required Documentation

Actualizar:

```text
docs/architecture/persistence.md
docs/setup/supabase-setup.md
docs/setup/migrations-runbook.md
```

Debe explicar:

- Que `oppositions` esta en Supabase.
- Que `opposition_access` esta en Supabase.
- Que tablas siguen en memoria.
- Como activar Supabase.
- Como volver a InMemory.
- Variables de entorno requeridas.
- Migracion `021_oppositions_access.sql`.
- Estado hibrido actual.
- Specs futuras pendientes.

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

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de cambios.
- Migracion creada.
- Repositorios Supabase creados.
- Como activar modo Supabase.
- Que sigue en InMemory.
- Tests ejecutados.
- Confirmacion explicita de que no se migro nada fuera del bloque `oppositions/opposition_access`.
