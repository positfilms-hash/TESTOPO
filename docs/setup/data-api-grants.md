# Grants base de la Data API para `authenticated`

## Por qué existe la migración 033

Supabase expone las tablas a través de **PostgREST** (la "Data API"). Para que un
rol pueda usar una tabla por la API hacen falta **dos capas independientes**:

1. **Privilegios SQL** (`GRANT`) sobre el esquema y la tabla: permiten que el rol
   "llegue" a la tabla.
2. **RLS** (Row Level Security): decide, fila a fila, qué puede ver/escribir.

La RLS **no sustituye** a los grants: si el rol `authenticated` no tiene `GRANT`,
PostgREST devuelve `permission denied for table ...` **antes** de que la RLS llegue
a evaluarse.

Cuando un proyecto Supabase se crea con **“Automatically expose new tables”
activado**, la plataforma concede esos grants base automáticamente. Si esa opción
está **desactivada** (como en el proyecto `Testopo-staging` recién creado), los
grants **faltan** y la app no puede ni recuperar el perfil
(`permission denied for table profiles`), lo que **bloquea SPEC 036**
(rehidratación de sesión, que empieza leyendo `public.profiles`).

La migración **`033_authenticated_data_api_grants.sql`** concede explícitamente:

- `GRANT USAGE ON SCHEMA public TO authenticated`;
- `GRANT SELECT, INSERT, UPDATE, DELETE` sobre las **tablas base del dominio** a
  `authenticated`.

Es **aditiva e idempotente** (se puede aplicar varias veces sin error).

## Lo que NO cambia (a propósito)

- **La RLS sigue siendo la autoridad real.** Estos grants solo abren la puerta; las
  políticas existentes (p. ej. `profiles_select_own`, `can_manage_workspace`,
  `has_active_opposition_access`) deciden qué fila ve/escribe cada usuario. No se
  modifica ninguna política, ni Auth, ni roles, ni `service_role`, ni el frontend.
- **`anon` no recibe permisos.** Ningún flujo existente los necesita (login y
  registro van por `auth.*`, no por estas tablas). Si una política/flujo futuro lo
  requiere, se concederá entonces de forma explícita.
- **Las vistas seguras `safe_questions` / `safe_question_options` se mantienen
  intactas** con su `GRANT SELECT` propio (SPEC 029): no se conceden por
  `ALL TABLES` precisamente para no darles `INSERT/UPDATE/DELETE`. El alumno sigue
  leyendo el banco solo por esas vistas y por las RPC `SECURITY DEFINER`
  (`submit_attempt` / `get_attempt_review`), que conservan su `GRANT EXECUTE`.

## Verificación

Tras aplicar la migración en staging, ejecutar en el SQL Editor:
[`../qa/authenticated-grants-verification.sql`](../qa/authenticated-grants-verification.sql).

Comprueba: (A) `authenticated` tiene los 4 privilegios sobre las tablas base;
(B) con un usuario autenticado concreto, `public.profiles` devuelve **solo su
propio perfil**; (C) un **Student** sigue **sin ver** tablas internas de gestión
(`question_generation_runs`, `document_classifications`, `material_ocr_runs` → 0
filas) porque la **RLS** lo filtra, aunque ya tenga el grant base.

## Aplicar la migración

Sigue el runbook general de migraciones
([`migrations-runbook.md`](./migrations-runbook.md)). Es una migración SQL
ordinaria; no requiere despliegue de código ni cambios de secretos.
