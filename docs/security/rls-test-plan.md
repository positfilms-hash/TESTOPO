# Plan de pruebas de RLS (SPEC 025)

Estas pruebas validan la RLS **contra un Supabase real** (la RLS no aplica en
modo `memory`, que es el de los tests unitarios/CI). Ejecútalas manualmente en un
proyecto de staging tras aplicar las migraciones `0001`→`025`.

## Preparación

1. Crea 2 usuarios Auth: **Student A** y **Student B**, y un **Admin/owner**.
2. Admin crea un workspace, una oposición y concede `opposition_access` activo a
   Student A (no a Student B).
3. Admin crea material/topic `active` y otro `obsolete`, preguntas en varios
   estados (`validated`, `pending_review`, `draft`), y un test.
4. Para cada comprobación, usa el SQL Editor con el rol del usuario (impersonando
   vía la API con su JWT) o el cliente con su sesión.

> Sugerencia: en el SQL Editor puedes simular un usuario con
> `set request.jwt.claims = '{"sub":"<uuid-del-usuario>","role":"authenticated"}';`
> y `set role authenticated;` antes de cada `select`.

## Student (debe FALLAR / devolver 0 filas)

- [ ] Student B lee una oposición a la que **no** tiene acceso → 0 filas.
- [ ] Student lee un material `obsolete` → 0 filas.
- [ ] Student lee un topic `obsolete` → 0 filas.
- [ ] Student lee una pregunta `pending_review`/`draft`/`needs_fix`/`rejected`/
      `obsolete` → 0 filas.
- [ ] Student lee `question_validation_results`/`question_reviews`/
      `question_review_feedback`/`question_generation_runs` → 0 filas.
- [ ] Student A lee un `test_attempt` de Student B → 0 filas.
- [ ] Student A lee un `test_answer` de Student B → 0 filas.
- [ ] Student `insert` en `materials`/`topics`/`questions` → error (RLS).
- [ ] Student `update` de su `profiles.role` a `admin` → el valor **no** cambia
      (trigger lo revierte); igual para `status`/`email`.
- [ ] Student se inserta a sí mismo en `workspace_members` con rol `admin` → error.

## Student (debe FUNCIONAR)

- [ ] Student A lee la oposición con acceso activo.
- [ ] Student A lee materiales/topics `active` de esa oposición.
- [ ] Student A lee preguntas `validated` de esa oposición.
- [ ] Student A crea un `test_attempt` propio y sus `test_answers`.
- [ ] Student A lee sus propios intentos y resultados.

## Admin/owner/manager

- [ ] Admin crea material/topic/pregunta en **su** workspace → OK.
- [ ] Admin lee preguntas internas (no `validated`) de su oposición → OK.
- [ ] Admin **no** puede leer ni editar datos de **otro** workspace → 0 filas/error.
- [ ] Manager gestiona solo la oposición autorizada (si ese rol se usa).

## Service role / secretos

- [ ] `rg -i service_role app/frontend/src` → sin resultados.
- [ ] No existe `VITE_SUPABASE_SERVICE_ROLE_KEY` en ningún `.env*`.
- [ ] `.env` está en `.gitignore` y no versionado; `.env.example` sin claves reales.
- [ ] Test automático: `app/frontend/tests/supabaseSecurity.test.ts` en verde.

## Resultado

Anota cualquier desviación en [`rls-known-gaps.md`](./rls-known-gaps.md).
