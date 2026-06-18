# Persistencia (SPEC 020 → 024: migración principal completa)

TESTOPO migró su dominio a Supabase de forma **progresiva**, tabla por tabla,
detrás de las interfaces async preparadas en la SPEC 018.3. Tras la SPEC 024 el
**núcleo del MVP está persistido en Supabase**; el modo memoria (`memory`) sigue
disponible para tests y demo.

## Qué está en Supabase y qué sigue en memoria

| Bloque | Persistencia tras SPEC 020 |
| --- | --- |
| Auth (identidad, contraseñas) | **Supabase Auth** |
| `profiles` | **Supabase** |
| `workspaces` | **Supabase** |
| `workspace_members` | **Supabase** |
| `oppositions`, `opposition_access` | **Supabase** (SPEC 021) |
| `materials`, `topics`, `material_topic_links` | **Supabase** (SPEC 022) |
| `material_import_batches`, `material_import_items` | **Supabase** (SPEC 022) |
| `questions`, `question_options` | **Supabase** (SPEC 023) |
| validación, reviews, feedback, generation runs | **Supabase** (SPEC 023) |
| `tests`, `test_questions` | **Supabase** (SPEC 024) |
| `test_attempts`, `test_answers` | **Supabase** (SPEC 024) |
| Propuestas de índice de temario IA (SPEC 019) | InMemory |

> Tras la SPEC 024 la **migración principal del MVP está completa**: el núcleo
> funcional (cuenta, oposiciones, materiales/temario, banco de preguntas y
> tests/resultados) corre con Supabase como persistencia real. Solo quedan en
> memoria las propuestas de índice de temario IA (SPEC 019) y el modo demo
> (`APP_PERSISTENCE_MODE=memory`). El InMemory se mantiene para tests y demo.

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
- `supabase` **y** puerto configurado → repositorios Supabase para todo el núcleo
  del MVP: cuenta/espacios, oposiciones/acceso, materiales/temario/importaciones,
  banco de preguntas (questions/options/validación/reviews/feedback/generation) y
  tests/preguntas de test/intentos/respuestas.
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
2. Migraciones aplicadas en orden: `0001_init.sql`, `020_profiles_workspaces.sql`,
   `021_oppositions_access.sql`, `022_materials_topics.sql`,
   `023_questions_options.sql`, `024_tests_attempts_answers.sql` y
   `025_rls_hardening.sql`.

Si falta la configuración, la app cae automáticamente a `memory` y siembra los
datos demo en memoria.

## RLS y guards de aplicación

La RLS básica de `profiles`, `workspaces`, `workspace_members`, `oppositions` y
`opposition_access` se crea en `0001_init.sql`; la de `materials`, `topics`,
`material_topic_links` y las tablas de importación en `022_materials_topics.sql`;
la del banco de preguntas en `023_questions_options.sql`; la de tests/intentos/
respuestas en `024_tests_attempts_answers.sql` (helper `test_opposition`; el
alumno solo ve **sus** intentos y respuestas: `user_id = auth.uid()`). Scope vía
la oposición → workspace con los helpers `opposition_workspace`/`question_opposition`.
En el
banco de preguntas: los **gestores** ven/gestionan todo; un **alumno** miembro
solo puede leer preguntas `validated` y no accede a las tablas internas
(validación/reviews/feedback/generation). **Gap conocido (pendiente SPEC 025)**:
las opciones de preguntas `validated` son legibles por el alumno y por tanto
`is_correct` podría leerse vía API directa; hoy la UI/servicio nunca lo muestra
antes de enviar el test — el blindaje definitivo (servir opciones saneadas por
RPC/vista) es del hardening. La RLS **no sustituye todavía** a los guards de la
capa de servicios
(`PlatformService`/`WorkspaceService`/`OppositionService`/`MaterialService`/
`TopicService`): la autorización real (usuario autenticado, membresía activa, rol
owner/admin/student, material/tema activo) sigue comprobándose en la aplicación.
La RLS es defensa adicional. La **SPEC 025** endurece estas políticas (el alumno
solo ve oposiciones/materiales/temas con acceso **activo** y `status='active'`, y
no puede cambiar `role`/`status`/`email`); el detalle está en
[`docs/security/rls-policies.md`](../security/rls-policies.md), con plan de
pruebas y gaps en `rls-test-plan.md` y `rls-known-gaps.md`.

La migración `021_oppositions_access.sql` añade además dos correcciones de
pre-flight sobre el bloque de la SPEC 020, necesarias para operar contra
workspaces reales:

- **Bootstrap del primer workspace**: políticas de INSERT que permiten a un
  usuario autenticado crear su workspace inicial (`owner_id = auth.uid()`) y su
  propia membresía `owner`, sin el deadlock de exigir una membresía previa
  imposible.
- **`profiles.role` inmutable desde cliente**: un trigger revierte cualquier
  cambio de `role` hecho por el rol `authenticated` (frontend); solo el backend
  con `service_role` puede cambiar el rol global.

## Specs futuras

Migración de dominio **completada** (021–024). Lo que queda:

- ~~**SPEC 021** — Oppositions & Access.~~ ✅ hecho.
- ~~**SPEC 022** — Materials & Topics.~~ ✅ hecho.
- ~~**SPEC 023** — Questions & Options.~~ ✅ hecho.
- ~~**SPEC 024** — Tests, Attempts & Answers.~~ ✅ hecho.
- ~~**SPEC 025** — RLS Hardening.~~ ✅ hecho (filtrado fino student + inmutabilidad
  de `profiles`; gap de `is_correct` documentado para beta — ver
  [`rls-known-gaps.md`](../security/rls-known-gaps.md)).
- **SPEC 026** — Edge Functions para borrado de cuenta (`auth.users`).
- **SPEC 027** — Beta Readiness (cierre del gap `is_correct` vía RPC/vista).

El proceso operativo de cada migración (aplicar, convenciones, idempotencia,
verificación) está en el [runbook de migraciones](../setup/migrations-runbook.md).
