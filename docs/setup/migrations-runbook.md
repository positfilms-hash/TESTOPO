# Runbook de migraciones Supabase

Guía operativa para aplicar y crear migraciones de base de datos de TESTOPO de
forma reproducible y trazable. Complementa
[`supabase-setup.md`](./supabase-setup.md) (alta del proyecto) y
[`../architecture/persistence.md`](../architecture/persistence.md) (estado
híbrido y selector de persistencia).

> **Estado actual**: tablas migradas a Supabase = Auth + `profiles`,
> `workspaces`, `workspace_members` (SPEC 020). El resto del dominio sigue en
> memoria. Este runbook es la base para las migraciones de las specs 021–024.

## 1. Dos vías para aplicar migraciones

Hay dos formas de llevar el SQL de `supabase/migrations/` a un proyecto. Elige
**una** y sé consistente.

### Vía A — SQL Editor del panel (más simple, sin instalar nada)

Para un proyecto **hosted** sin tooling local:

1. Abre el panel de Supabase → **SQL Editor**.
2. Pega y ejecuta el contenido de cada archivo de `supabase/migrations/`
   **en orden de nombre** (ver §3): `0001_init.sql`, luego `020_profiles_workspaces.sql`, etc.
3. Las migraciones de este repo son **idempotentes** (ver §4): re-ejecutarlas no
   rompe nada.

### Vía B — Supabase CLI (reproducible, recomendado a medida que crece)

Requiere la CLI. Instálala por una de estas vías (no se añade como dependencia
del repo):

```bash
# Scoop (Windows)
scoop install supabase
# o npm global
npm i -g supabase
# o sin instalar (transitorio)
npx supabase <comando>
```

Flujo:

```bash
# 1. Vincular el repo a tu proyecto hosted (una vez). Pide la db password.
supabase link --project-ref <project-ref>

# 2. Aplicar las migraciones pendientes al proyecto vinculado.
supabase db push

# 3. (Opcional) Levantar un Supabase local para probar antes de tocar prod:
supabase start          # arranca Postgres+Studio locales (Docker)
supabase db reset       # recrea la BD local aplicando TODAS las migraciones
supabase stop
```

El `supabase/config.toml` (generado con `supabase init`) define la config local
y debe **commitearse**. No contiene secretos: usa referencias `env(...)`.

## 2. Aplicar las migraciones actuales

Orden y efecto:

1. `0001_init.sql` (SPEC 018.2) — `profiles`, tablas núcleo (`workspaces`,
   `workspace_members`, `oppositions`, `opposition_access`), trigger de perfil al
   registrarse y RLS básica.
2. `020_profiles_workspaces.sql` (SPEC 020) — patrón `updated_at` (función +
   triggers) e índices para los repos de `profiles`/`workspaces`/`workspace_members`.

Tras aplicarlas, configura `.env` con `APP_PERSISTENCE_MODE=supabase` y
`VITE_APP_PERSISTENCE_MODE=supabase` para que la app use los repos Supabase
(ver `supabase-setup.md`).

## 3. Convención de nombres (trazabilidad spec ↔ migración)

- Prefijo numérico **alineado con la SPEC** que la introduce:
  `0NN_<descripcion-en-kebab>.sql` → p. ej. `021_oppositions_access.sql` para la
  SPEC 021.
- Ordenan lexicográficamente; mantener el ancho de dígitos para que el orden sea
  estable. `0001_init.sql` es la excepción histórica (primera migración) y ordena
  antes que `020…`.
- **No** usar `supabase migration new` con timestamps: rompería la trazabilidad
  spec↔migración. Si lo usas por comodidad, renombra el archivo a la convención.
- Una migración por spec siempre que sea posible; si una spec necesita varias,
  sufijar: `022_materials_topics.sql`, `022_1_materials_indexes.sql`.

## 4. Reglas de idempotencia y seguridad

Toda migración nueva debe:

- Usar `create table if not exists`, `create index if not exists`,
  `create or replace function`, y `drop ... if exists` antes de recrear triggers
  o políticas. Re-ejecutarla no debe fallar.
- No incluir datos reales ni claves. Los seeds de prueba usan datos ficticios.
- Mantener `created_at`/`updated_at` y el trigger `set_updated_at` en tablas
  nuevas.
- Activar RLS en tablas nuevas y añadir políticas básicas; el endurecimiento
  completo de RLS se centraliza en la SPEC 025. Hasta entonces, los **guards de
  aplicación** (servicios/`PlatformService`) siguen siendo la defensa principal.
- Nunca exponer `service_role` al frontend; las operaciones que la requieran
  (p. ej. borrado real de `auth.users`) van a Edge Functions (SPEC 026).

## 5. Verificación tras migrar

```sql
-- Tablas presentes
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- RLS activa
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

-- Triggers updated_at
select event_object_table, trigger_name from information_schema.triggers
where trigger_schema = 'public' order by 1;
```

Comprobación funcional end-to-end: registrar un usuario (Auth) → debe existir su
fila en `profiles` → crear workspace personal → aparece en `workspaces` y
`workspace_members` con rol `owner`.

## 6. Secuencia de migración prevista

| SPEC | Migración (prevista) | Tablas |
| --- | --- | --- |
| 018.2 | `0001_init.sql` ✅ | profiles, núcleo + RLS básica |
| 020 | `020_profiles_workspaces.sql` ✅ | updated_at + índices del bloque cuenta/espacios |
| 021 | `021_oppositions_access.sql` ✅ | oppositions, opposition_access (+ pre-flight RLS de la 020) |
| 022 | `022_materials_topics.sql` ✅ | materials, topics, material_topic_links, import batches/items |
| 023 | `023_questions_options.sql` | questions, question_options |
| 024 | `024_tests_attempts_answers.sql` | tests, test_questions, test_attempts, test_answers |
| 025 | `025_rls_hardening.sql` | endurecimiento RLS de todo el dominio |
| 026 | `026_account_deletion_fn.sql` | Edge Function + borrado real de Auth |

> Las migraciones 021+ las **define Codex en su spec**; este runbook solo fija la
> convención y el proceso. La numeración puede ajustarse si cambia el orden.

## 7. Checklist antes de mergear una migración

- [ ] Nombre sigue la convención `0NN_<desc>.sql` alineada con la SPEC.
- [ ] Es idempotente (re-ejecutable sin error).
- [ ] RLS activada + políticas básicas en tablas nuevas.
- [ ] Sin datos reales ni claves.
- [ ] `updated_at` + trigger en tablas nuevas.
- [ ] Verificada con `supabase db reset` local o en un proyecto de staging.
- [ ] Documentada en la tabla de §6 y en `persistence.md` si cambia el estado híbrido.
