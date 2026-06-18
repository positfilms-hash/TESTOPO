# Políticas RLS de TESTOPO (SPEC 025)

Defensa en profundidad: la autorización vive en **dos capas** que coexisten —
los **guards de aplicación** (`PlatformService` y servicios de dominio) y la
**Row Level Security** de Supabase. La RLS no sustituye a los servicios ni al
revés. Esta página resume qué protege cada tabla; el SQL está en
`supabase/migrations/0001_init.sql`, `021`, `022`, `023`, `024` y
`025_rls_hardening.sql` (idempotentes).

## Roles

- **Perfil global** (`profiles.role`): `admin` | `student`. Hoy no decide
  capacidades de gestión por sí solo (lo hacen workspace/oposición).
- **Workspace** (`workspace_members.role`): `owner` | `admin` | `student`.
- **Oposición** (`opposition_access.role_in_opposition`): `owner` | `manager` | `student`.

"Gestor" = `owner`/`admin` del workspace (helper `can_manage_workspace`).

## Helper functions (SECURITY DEFINER, usan `auth.uid()`)

| Función | Qué decide |
| --- | --- |
| `is_workspace_member(ws)` | el usuario es miembro activo del workspace |
| `can_manage_workspace(ws)` | el usuario es `owner`/`admin` activo del workspace |
| `opposition_workspace(opp)` | workspace de una oposición |
| `question_opposition(q)` | oposición de una pregunta |
| `test_opposition(t)` | oposición de un test |
| `has_active_opposition_access(opp)` | el usuario tiene `opposition_access` **activo** a la oposición |

Son `security definer` para evitar recursión de RLS y fijan `search_path`.

## Resumen por tabla

| Tabla | Lectura | Escritura |
| --- | --- | --- |
| `profiles` | propio perfil; gestores leen perfiles de miembros de sus workspaces | propio perfil **sin** `role`/`status`/`email` (trigger lo revierte) |
| `workspaces` | miembros activos | crear el propio (`owner_id = auth.uid()`); gestionar = gestores |
| `workspace_members` | propia membresía o gestores del workspace | gestores; bootstrap del propio `owner` inicial |
| `oppositions` | gestores; alumno **solo con acceso activo** | gestores |
| `opposition_access` | propio acceso o gestores | gestores |
| `materials` | gestores; alumno solo `active` **y** con acceso activo | gestores |
| `topics` | gestores; alumno solo `active` **y** con acceso activo | gestores |
| `material_topic_links` | gestores; alumno solo si material+topic `active` y acceso activo | gestores |
| `material_import_batches`/`items` | solo gestores | solo gestores |
| `questions` | gestores; alumno **solo `validated`** | gestores |
| `question_options` | gestores; alumno solo opciones de preguntas `validated` (ver gaps) | gestores |
| `question_validation_results` | solo gestores | solo gestores |
| `question_reviews` | solo gestores | solo gestores |
| `question_review_feedback` | solo gestores | solo gestores |
| `question_generation_runs` | solo gestores | solo gestores |
| `tests` | gestores; alumno con acceso activo | gestores o alumno con acceso activo |
| `test_questions` | gestores; alumno con acceso activo | gestores o alumno con acceso activo |
| `test_attempts` | **propios** (`user_id = auth.uid()`); gestores para seguimiento | propios |
| `test_answers` | respuestas de **sus** intentos | respuestas de sus intentos |

## Principios aplicados

- **Deny by default**: sin política explícita, sin acceso (RLS activa en las 20
  tablas).
- **Auth required**: las políticas usan `auth.uid()`; el rol `anon` no pasa.
- **Workspace/Opposition boundary**: el acceso se ancla a `workspace_members` y
  `opposition_access`; no se cruzan workspaces ni oposiciones.
- **Student limited access**: el alumno no ve datos internos (validación,
  reviews, feedback, generation), ni preguntas no `validated`, ni intentos de
  otros, ni material/topic no `active`.
- **Service role solo servidor**: `SUPABASE_SERVICE_ROLE_KEY` nunca en frontend
  (verificado por `app/frontend/tests/supabaseSecurity.test.ts`).

Gaps pendientes: ver [`rls-known-gaps.md`](./rls-known-gaps.md). Plan de pruebas:
[`rls-test-plan.md`](./rls-test-plan.md).
