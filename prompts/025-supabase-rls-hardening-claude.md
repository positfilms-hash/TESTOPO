# Claude Prompt - SPEC 025 Supabase RLS Hardening

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 025 - Supabase RLS Hardening
```

El MVP principal ya esta migrado a Supabase por specs 020-024. Esta spec no migra nuevas entidades de producto: endurece permisos de base de datos.

## Spec

Implementa estrictamente:

```text
docs/specs/025-supabase-rls-hardening.md
```

Branch de trabajo:

```text
feature/supabase-rls-hardening
```

Runbook obligatorio:

```text
docs/setup/migrations-runbook.md
```

No crees un proceso paralelo de migracion o seguridad.

## Product Goal

Defensa en profundidad:

```text
Guards de aplicacion + Row Level Security en Supabase
```

RLS no sustituye los servicios.

Los servicios no sustituyen RLS.

## Required Implementation

### 1. SQL migration

Crear:

```text
supabase/migrations/025_rls_hardening.sql
```

Debe:

- Activar RLS en todas las tablas sensibles.
- Crear o actualizar helper functions seguras.
- Crear politicas de select/insert/update/delete donde aplique.
- Revocar accesos inseguros si existen.
- No eliminar datos.
- No cambiar modelos salvo necesidad minima.
- Documentar cualquier gap.

Tablas sensibles:

- `profiles`
- `workspaces`
- `workspace_members`
- `oppositions`
- `opposition_access`
- `materials`
- `topics`
- `material_topic_links`
- `material_import_batches`
- `material_import_items`
- `questions`
- `question_options`
- `question_validation_results`
- `question_reviews`
- `question_review_feedback`
- `question_generation_runs`
- `tests`
- `test_questions`
- `test_attempts`
- `test_answers`

### 2. Helper functions

Puedes usar helpers como:

- `is_workspace_member(workspace_id uuid)`
- `is_workspace_admin(workspace_id uuid)`
- `is_workspace_owner(workspace_id uuid)`
- `has_active_opposition_access(opposition_id uuid)`
- `is_opposition_manager(opposition_id uuid)`
- `is_test_attempt_owner(attempt_id uuid)`

Reglas:

- Usar `auth.uid()`.
- Evitar permisos demasiado amplios.
- Evitar recursividad peligrosa en policies.
- Documentar helpers.

### 3. Permission rules

Reglas obligatorias:

- Deny by default.
- Auth required para tablas sensibles.
- Student no accede a datos internos.
- Student no ve preguntas no validadas.
- Student no ve `is_correct` antes de submit.
- Student no ve explicaciones antes de submit.
- Student no ve validation results/reviews/feedback/generation runs.
- Student no ve attempts/answers/resultados de otros usuarios.
- Student no crea/edita materiales, topics, preguntas ni imports.
- Owner/admin gestiona solo sus workspaces/oposiciones.
- Manager gestiona solo oposiciones autorizadas si ese rol existe.
- No se mezclan workspaces.
- No se mezclan oposiciones.
- No usar `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- Mantener guards de aplicacion.
- Mantener fallback InMemory.

### 4. Student test data

RLS no oculta columnas por si sola. Para `question_options.is_correct`, `explanation`, `source_excerpt` y solucion de test:

- No exponer tabla completa a frontend student.
- Mantener filtrado de servicios.
- Implementar vista/RPC segura si encaja.
- Si queda pendiente, documentarlo en `docs/security/rls-known-gaps.md`.

## Required Tests

Anade tests/verificaciones para:

- Usuario no lee workspace donde no es miembro.
- Student no gestiona miembros ni eleva rol.
- Owner/admin gestiona miembros de su workspace.
- Student ve solo oposiciones con access active.
- Student no ve oposiciones revoked/de otro workspace.
- Student ve solo materials/topics active.
- Student no crea material/topic.
- Student no ve preguntas draft/pending_review/needs_fix/rejected/obsolete.
- Owner/admin ve preguntas internas de su oposicion.
- Student no crea ni aprueba preguntas.
- Student no recibe `is_correct` antes de submit.
- Student no recibe explicacion antes de submit.
- Student no lee validation/reviews/feedback/generation runs.
- Student crea attempt solo para test autorizado.
- Student no ve attempts/answers de otro usuario.
- Student no modifica attempt submitted.
- Student no responde tras submit.
- Resultado solo visible al owner del attempt.
- Owner/admin no gestiona otro workspace.
- Manager no cruza oposiciones.
- `SUPABASE_SERVICE_ROLE_KEY` no aparece en bundle frontend.
- `.env` no esta en repo.
- `.env.example` no contiene claves reales.

Los tests de RLS real pueden ser opcionales si requieren Supabase configurado. Los tests unitarios deben seguir pasando sin Supabase real.

## Required Documentation

Crear o actualizar:

```text
docs/security/rls-policies.md
docs/security/rls-test-plan.md
docs/security/rls-known-gaps.md
docs/architecture/persistence.md
docs/setup/migrations-runbook.md
```

`rls-policies.md` debe explicar:

- Tablas con RLS.
- Roles.
- Permisos de student.
- Permisos de owner/admin.
- Permisos de manager.
- Datos internos.
- Datos visibles al estudiante.
- Politicas por tabla.

`rls-test-plan.md` debe incluir pruebas manuales student/admin.

`rls-known-gaps.md` debe existir aunque no haya gaps.

No ocultar gaps.

## Out Of Scope

No implementes:

- Edge Functions.
- Borrado real de cuenta Auth.
- Pagos.
- OAuth.
- Auditoria avanzada.
- Logs avanzados.
- Beta readiness.

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de cambios.
- Migracion `025_rls_hardening.sql`.
- Helpers creados.
- Politicas principales.
- Gaps conocidos.
- Tests ejecutados.
- Confirmacion de que service role no esta en frontend.
- Confirmacion de que fallback InMemory sigue funcionando.
- Confirmacion de que no se cambiaron reglas de negocio.
