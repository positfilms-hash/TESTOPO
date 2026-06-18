# Configuración de Supabase (SPEC 018.2)

Guía para conectar TESTOPO con tu proyecto de Supabase (auth real + base de
datos). **No incluyas claves reales en el repositorio.** Todo va en `.env`.

> Estado actual (SPEC 024): la **migración principal del MVP está completa**.
> Supabase persiste autenticación, cuenta/espacios, oposiciones/acceso,
> temario/materiales, el banco de preguntas y los **tests/intentos/respuestas**
> (`tests`, `test_questions`, `test_attempts`, `test_answers`). El modo memoria
> (`APP_PERSISTENCE_MODE=memory`) sigue disponible para tests y demo — ver
> [`docs/architecture/persistence.md`](../architecture/persistence.md).
> Si no defines las variables, la app sigue funcionando en **modo demo** (todo en
> memoria) y la auth muestra `SUPABASE_NOT_CONFIGURED`.

## 1. Crear el proyecto

1. Entra en https://supabase.com y crea un proyecto (la cuenta del usuario está
   asociada a `positfilms@gmail.com`).
2. Elige región y contraseña de base de datos (guárdala en tu gestor, no aquí).

## 2. Copiar las claves

En **Project Settings → API**:

- **Project URL** → `VITE_SUPABASE_URL`.
- **anon public** → `VITE_SUPABASE_ANON_KEY` (clave pública, puede ir al bundle).
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY`. **SOLO servidor.** Nunca la
  pongas con prefijo `VITE_`, ni en el frontend, ni en el repo.

## 3. Variables de entorno

Copia `.env.example` a `.env` (o `.env.local`) en la raíz y rellena:

```bash
cp .env.example .env
```

```text
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-public-key
# Solo servidor (no usado por el frontend en esta fase):
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
SUPABASE_DATABASE_URL=postgresql://...
```

Vite expone al frontend únicamente las variables con prefijo `VITE_`.

### Modo de persistencia (SPEC 020)

Para que `profiles`, `workspaces` y `workspace_members` se guarden en Supabase
(no en memoria), añade además:

```text
APP_PERSISTENCE_MODE=supabase
VITE_APP_PERSISTENCE_MODE=supabase
```

- Con `memory` (valor por defecto) todo corre en memoria por sesión (modo demo).
- Con `supabase`, el bloque cuenta/espacios usa los repositorios Supabase; si
  Supabase no está configurado (faltan URL/anon key), cae a `memory`
  automáticamente. El resto del dominio sigue en memoria en cualquier caso.

## 4. Ejecutar las migraciones

Aplica **en orden** los archivos de `supabase/migrations/` con una de estas vías:

- **SQL Editor** del panel de Supabase: pega y ejecuta el contenido de cada
  archivo.
- **Supabase CLI** (si la usas): `supabase db push`.

1. `0001_init.sql` — crea `profiles`, el trigger que rellena el perfil al
   registrarse, las tablas núcleo (`workspaces`, `workspace_members`,
   `oppositions`, `opposition_access`) y las políticas RLS básicas.
2. `020_profiles_workspaces.sql` (SPEC 020) — idempotente; añade el patrón
   `updated_at` (función + triggers) e índices útiles para los repositorios de
   `profiles`/`workspaces`/`workspace_members`. No migra el resto del dominio.
3. `021_oppositions_access.sql` (SPEC 021) — idempotente; `updated_at` + índices
   para `oppositions`/`opposition_access` y dos correcciones de pre-flight de la
   SPEC 020 (bootstrap del primer workspace y bloqueo de cambio de
   `profiles.role` desde clientes autenticados).
4. `022_materials_topics.sql` (SPEC 022) — idempotente; crea `materials`,
   `topics`, `material_topic_links`, `material_import_batches` y
   `material_import_items` con `updated_at`, índices y RLS básica (scope vía
   oposición). No migra preguntas ni tests.
5. `023_questions_options.sql` (SPEC 023) — idempotente; crea el banco de
   preguntas: `questions`, `question_options`, `question_validation_results`,
   `question_reviews`, `question_review_feedback` y `question_generation_runs`,
   con índices y RLS básica (alumno solo lee preguntas `validated`; tablas
   internas solo para gestores). No migra tests ni intentos.
6. `024_tests_attempts_answers.sql` (SPEC 024) — idempotente; crea `tests`,
   `test_questions`, `test_attempts` y `test_answers` con índices y RLS básica
   (el alumno solo ve **sus** intentos/respuestas). **Cierra la migración
   principal del MVP.**

Para aplicar/crear migraciones con la CLI (`supabase link` / `db push`),
convenciones de nombres e idempotencia y la secuencia prevista 021–024, ver el
[runbook de migraciones](./migrations-runbook.md).

## 5. Activar Auth email/contraseña

En **Authentication → Providers → Email**: activa **Email** con contraseña.
Para pruebas puedes desactivar temporalmente la confirmación por email
(**Authentication → Sign In / Up**), recordando reactivarla para producción.

## 6. Redirect para restablecer contraseña

En **Authentication → URL Configuration**:

- **Site URL**: la URL local de desarrollo (p. ej. `http://localhost:5173`).
- **Redirect URLs**: añade la URL a la que vuelve el enlace de recuperación
  (la app la pasa como `redirectTo` al pedir el reset; usa la raíz del sitio).

## 7. Probar

1. `cd app/frontend && npm run dev`.
2. Abre la app → **Crear cuenta** (registro con email/contraseña).
3. Inicia sesión, cierra sesión.
4. **¿Has olvidado la contraseña?** → revisa el email de recuperación → abre el
   enlace → establece la nueva contraseña.

## 8. Seguridad — checklist

- [ ] El `.env` real **no** está en el repositorio (lo cubre `.gitignore`).
- [ ] `service_role` **solo** en variable de servidor, nunca `VITE_*`.
- [ ] No hay claves reales en código, docs ni tests.
- [ ] RLS activado en las tablas sensibles (lo hace la migración).
- [ ] El borrado de cuenta del MVP es **lógico** (`profiles.status = deleted`);
      el borrado real en `auth.users` requiere `service_role` desde servidor
      (fase posterior).
