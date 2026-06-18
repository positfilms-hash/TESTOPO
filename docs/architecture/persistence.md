# Persistencia: estado híbrido (SPEC 020)

TESTOPO migra su dominio a Supabase de forma **progresiva**, tabla por tabla,
detrás de las interfaces async preparadas en la SPEC 018.3. Tras la SPEC 020 la
app vive en un **estado híbrido** que es correcto y esperado: parte del dominio
ya se persiste en Supabase y el resto sigue en memoria por sesión.

## Qué está en Supabase y qué sigue en memoria

| Bloque | Persistencia tras SPEC 020 |
| --- | --- |
| Auth (identidad, contraseñas) | **Supabase Auth** |
| `profiles` | **Supabase** |
| `workspaces` | **Supabase** |
| `workspace_members` | **Supabase** |
| `oppositions`, `opposition_access` | InMemory |
| `materials`, `topics` | InMemory |
| `questions`, `question_options` | InMemory |
| `tests`, `test_questions` | InMemory |
| `test_attempts`, `test_answers` | InMemory |
| Propuestas de índice de temario IA (SPEC 019) | InMemory |

> El resto del dominio se migrará en specs posteriores (ver más abajo). No se
> intenta "terminar Supabase" en una sola spec.

## Cómo se elige la persistencia

El selector vive en el backend, en
`app/backend/src/repository/supabase/createCoreRepositories.ts`:

```ts
const core = createCoreRepositories({
  persistence: 'supabase' | 'memory',
  supabase: portOrNull, // puerto Supabase; obligatorio si el modo es supabase
});
```

Reglas del factory:

- `memory` (o sin valor) → repositorios InMemory.
- `supabase` **y** puerto configurado → repositorios Supabase para
  `profiles`/`workspaces`/`workspace_members`.
- `supabase` **sin** puerto → cae a `memory` (fallback seguro; CI/tests pasan sin
  Supabase real).
- Un valor desconocido → error `PERSISTENCE_MODE_INVALID`.

El backend de dominio **no** depende de `@supabase/supabase-js`: depende del
puerto `SupabaseClientPort` (`supabaseClientPort.ts`). Hay dos adaptadores:

- `InMemorySupabasePort` (backend, para tests/desarrollo sin red).
- `createSupabasePort(client)` (frontend, `app/frontend/src/store/supabaseGateway.ts`)
  que traduce el puerto a llamadas reales de `supabase-js` con la **clave
  anónima**. La `service_role` nunca llega al frontend.

## Activar Supabase / volver a InMemory

En `.env` (ver [`docs/setup/supabase-setup.md`](../setup/supabase-setup.md)):

```text
# Modo Supabase para el bloque cuenta/espacios:
APP_PERSISTENCE_MODE=supabase
VITE_APP_PERSISTENCE_MODE=supabase

# Volver al modo demo (todo en memoria):
APP_PERSISTENCE_MODE=memory
VITE_APP_PERSISTENCE_MODE=memory
```

Requisitos del modo `supabase`:

1. `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas.
2. Migraciones aplicadas (`0001_init.sql` y `020_profiles_workspaces.sql`).

Si falta la configuración, la app cae automáticamente a `memory` y siembra los
datos demo en memoria.

## RLS y guards de aplicación

La RLS básica de `profiles`, `workspaces` y `workspace_members` se crea en
`0001_init.sql`. La RLS **no sustituye todavía** a los guards de la capa de
servicios (`PlatformService`/`WorkspaceService`): la autorización real (usuario
autenticado, membresía activa, rol owner/admin/student) sigue comprobándose en
la aplicación. La RLS es defensa adicional. El endurecimiento completo de RLS
queda para la SPEC 025.

## Specs futuras de migración

El orden técnico recomendado (la numeración puede ajustarse):

- **SPEC 021** — Oppositions & Access.
- **SPEC 022** — Materials & Topics.
- **SPEC 023** — Questions & Options.
- **SPEC 024** — Tests, Attempts & Answers.
- **SPEC 025** — RLS Hardening.
- **SPEC 026** — Edge Functions para borrado de cuenta (`auth.users`).
