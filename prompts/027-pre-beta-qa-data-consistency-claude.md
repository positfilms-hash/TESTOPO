# Claude Prompt - SPEC 027 Pre-Beta QA & Data Consistency

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 027 - Pre-Beta QA & Data Consistency
```

El MVP principal ya fue migrado a Supabase:

- SPEC 020 - Profiles & Workspaces.
- SPEC 021 - Oppositions & Access.
- SPEC 022 - Materials & Topics.
- SPEC 023 - Questions & Options.
- SPEC 024 - Tests, Attempts & Answers.
- SPEC 025 - RLS Hardening.
- SPEC 026 - Account Deletion Edge Function.

Esta spec prepara el proyecto para SPEC 028 - Beta Readiness.

No es una spec de producto. Es una spec de estabilizacion, QA, permisos, consistencia de datos y correccion de bugs.

## Spec

Implementa estrictamente:

```text
docs/specs/027-pre-beta-qa-data-consistency.md
```

Branch de trabajo:

```text
feature/pre-beta-qa-data-consistency
```

Runbooks/documentos que debes respetar:

```text
docs/setup/migrations-runbook.md
docs/architecture/persistence.md
docs/security/rls-policies.md
docs/security/account-deletion.md
docs/security/rls-test-plan.md
```

Si alguno no existe todavia porque una spec anterior no fue mergeada, no inventes un proceso paralelo: crea la documentacion esperada en la ubicacion de la spec correspondiente o deja una nota clara en el bug log/checklist.

## Product Goal

Dejar TESTOPO limpio, consistente y comprobado antes de preparar la beta.

La beta no esta lista si:

- Se mezclan workspaces.
- Se mezclan oposiciones.
- Student ve datos internos.
- Student ve respuestas antes de submit.
- Student ve resultados de otro usuario.
- Tests usan preguntas no `validated`.
- Preguntas IA nacen como `validated`.
- Account deletion rompe datos compartidos.
- `SUPABASE_SERVICE_ROLE_KEY` aparece en frontend.

## Required Documentation

Crear o actualizar:

```text
docs/qa/pre-beta-qa-plan.md
docs/qa/pre-beta-data-consistency-checklist.md
docs/qa/pre-beta-permissions-checklist.md
docs/qa/pre-beta-bug-log.md
docs/qa/pre-beta-manual-test-script.md
docs/qa/pre-beta-release-blockers.md
```

Opcional:

```text
tests/fixtures/pre-beta-demo-data.md
```

Adapta el formato a la carpeta `docs/qa/` existente. No dupliques plantillas si ya existe una equivalente util.

## Required Tests

Anade o refuerza tests para:

- Workspace boundary.
- Opposition boundary.
- Student permissions.
- Admin/owner permissions.
- Premium individual permissions.
- Question validation rules.
- AI generation status.
- Human review approval rules.
- Test generation only with `validated` questions.
- Attempt ownership.
- Answer ownership.
- Account deletion.
- RLS critical cases.
- Repository factory memory/supabase.
- Fallback InMemory.

Los tests unitarios deben pasar sin Supabase real.

Los tests que dependan de Supabase real, RLS real o Edge Functions pueden quedar como integration/manual checks documentados, pero deben quedar claramente identificados.

## Required QA Coverage

### Data Consistency

Verifica o documenta checks para:

- Workspaces sin owner.
- Memberships duplicadas.
- Memberships activas de profiles deleted.
- Owner unico eliminado.
- Oppositions sin workspace.
- Opposition access a oposicion inexistente.
- Materials/topics/questions/tests cruzando workspace u oposicion.
- Topics con ciclos o parent de otra oposicion.
- Material-topic links invalidos.
- Questions `validated` incompletas.
- Questions IA naciendo como `validated`.
- Tests con preguntas no `validated`.
- Tests con preguntas duplicadas.
- Attempts visibles para otro student.
- Answers editables tras submit.

### Permissions

Student no puede:

- Entrar en admin.
- Crear workspace organization.
- Crear oposicion.
- Subir material.
- Crear topic.
- Crear/revisar/aprobar preguntas.
- Ver preguntas no validadas.
- Ver respuestas correctas antes de submit.
- Ver explicaciones antes de submit.
- Ver results/attempts de otro usuario.
- Eliminar otra cuenta.
- Cambiar su rol o darse acceso.

Owner/admin no puede:

- Gestionar workspace ajeno.
- Ver datos de oposicion ajena.
- Cruzar materiales/preguntas/tests entre workspaces.
- Aprobar preguntas invalidas.
- Usar service role desde frontend.

Premium individual no puede:

- Ver datos de otros usuarios.
- Gestionar workspaces organization ajenos.
- Aprobar preguntas de otros workspaces.

## Required Manual Flows

Documenta en `docs/qa/pre-beta-manual-test-script.md`:

1. Flujo organization completo.
2. Flujo student aislado.
3. Flujo premium individual.
4. Flujo account deletion con owner unico bloqueado y owner con sustituto permitido.

Cada flujo debe indicar:

- Perfil usado.
- Datos previos.
- Pasos.
- Resultado esperado.
- Que bloquearia beta.

## Bug Fix Rules

Puedes corregir bugs encontrados durante QA.

Correcto:

- Corregir fuga de datos.
- Corregir permisos demasiado amplios.
- Corregir RLS demasiado permisiva.
- Corregir test con preguntas no `validated`.
- Corregir contador de resultados.
- Corregir account deletion que rompe datos compartidos.
- Corregir fallback InMemory roto.

Incorrecto:

- Anadir ranking.
- Anadir estadisticas avanzadas.
- Anadir pagos.
- Anadir nuevos roles complejos.
- Anadir RAG/OCR/embeddings.
- Redisenar visualmente la app.
- Empezar Beta Readiness.

## Security Checklist

Antes de terminar, verifica:

- No hay `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- No hay `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- `.env` no esta versionado.
- `.env.example` no contiene claves reales.
- Edge Function de account deletion usa service role solo en servidor.
- Student no lee datos internos.
- Student no lee resultados ajenos.
- Student no lee respuestas correctas antes de submit.
- RLS critical cases estan documentados/probados.
- Guards de aplicacion siguen existiendo ademas de RLS.

## Required Commands

Ejecuta lo que aplique en este repo:

```bash
npm.cmd test
npm.cmd run typecheck
```

Ejecuta backend y frontend por separado si el monorepo lo requiere.

Si frontend/Vite falla por permisos del entorno local, documenta el motivo y ejecuta desde el contexto permitido.

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de documentos QA creados.
- Tests anadidos o reforzados.
- Bugs encontrados.
- Bugs corregidos.
- Blockers abiertos, si existen.
- Checks manuales pendientes, si existen.
- Confirmacion de que no se anadieron funcionalidades nuevas.
- Confirmacion de que InMemory y Supabase siguen cubiertos.
- Confirmacion de que service role no esta en frontend.
- Estado final de preparacion para SPEC 028.
