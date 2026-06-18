# Claude Prompt - SPEC 023 Supabase Repositories: Questions & Options

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 023 - Supabase Repositories: Questions & Options
```

La app ya tiene:

- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 018.4/018.4-B - AI Question Generation y OpenAI provider.
- Tooling/runbook de migraciones Supabase.

## Spec

Implementa estrictamente:

```text
docs/specs/023-supabase-questions-options.md
```

Branch de trabajo:

```text
feature/supabase-questions-options
```

Runbook obligatorio:

```text
docs/setup/migrations-runbook.md
```

No crees un proceso paralelo de migracion.

## Product Goal

Persistir en Supabase el bloque del banco de preguntas:

- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.

Estado esperado tras esta spec:

```text
Supabase:
- Auth
- profiles
- workspaces
- workspace_members
- oppositions
- opposition_access
- materials
- topics
- material_topic_links
- material_import_batches
- material_import_items
- questions
- question_options
- question_validation_results
- question_reviews
- question_review_feedback
- question_generation_runs

InMemory:
- tests
- test_questions
- test_attempts
- test_answers
```

## Non-Negotiable Rules

- Usa `docs/setup/migrations-runbook.md`.
- No migres `tests`.
- No migres `test_questions`.
- No migres `test_attempts`.
- No migres `test_answers`.
- No cambies reglas de negocio del banco de preguntas.
- La IA nunca puede crear preguntas como `validated`.
- Solo revision humana puede aprobar preguntas.
- Student no puede ver preguntas no validadas.
- No elimines InMemory.
- Mantener fallback InMemory si Supabase no esta configurado.
- No hardcodees claves.
- No subas `.env`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- CI/tests deben poder pasar sin Supabase real configurado.

## Required Implementation

### 1. SQL migration

Crear:

```text
supabase/migrations/023_questions_options.sql
```

Debe seguir el runbook:

- Nombre alineado con la SPEC.
- Idempotente.
- Sin datos reales ni claves.
- `updated_at` + trigger donde aplique.
- RLS basica.
- Documentacion actualizada.

Debe crear o consolidar:

- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.

Incluye:

- Primary keys.
- Foreign keys.
- Checks.
- Indices utiles.
- RLS basica.
- Constraints que refuercen reglas centrales cuando sea razonable.

No tocar tablas fuera de alcance salvo referencias necesarias.

### 2. Supabase repositories

Crear repositorios Supabase que implementen las interfaces async existentes:

- `SupabaseQuestionRepository`.
- `SupabaseQuestionOptionRepository`.
- `SupabaseQuestionValidationResultRepository`.
- `SupabaseQuestionReviewRepository`.
- `SupabaseQuestionReviewFeedbackRepository`.
- `SupabaseQuestionGenerationRunRepository`.

Los repos deben mapear filas Supabase a modelos de dominio sin cambiar contratos de servicios.

### 3. Repository factory / persistence selector

Actualizar el factory para que:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos siguen InMemory

APP_PERSISTENCE_MODE=supabase
-> profiles/workspaces/oppositions/materials/topics/questions/options/reviews/generation runs usan Supabase
-> tests/attempts/answers siguen InMemory
```

### 4. AI Question Generation

Mantener el flujo:

```text
IA genera candidatos
-> generation run se guarda
-> questions/options se guardan
-> validation result se guarda
-> preguntas quedan pending_review o needs_fix
```

Reglas:

- Pregunta generada por IA nunca queda `validated`.
- Salida incompleta de IA se rechaza o queda `needs_fix` segun reglas existentes.
- OpenAI provider no debe llamarse en tests unitarios.
- Mock provider sigue funcionando.

### 5. Admin Review

Mantener el flujo:

```text
Admin revisa
-> cambia status
-> review log se guarda
-> feedback se guarda si aplica
```

Reglas:

- Solo owner/admin/manager autorizado puede aprobar.
- Student no puede aprobar.
- Una aprobacion debe dejar review log.
- Solo esta revision humana puede cambiar una pregunta a `validated`.

## Required Tests

Anade tests para:

- Crear/listar/actualizar questions.
- Filtros por status/difficulty/topic/material/generated_by_ai.
- Crear/reemplazar options.
- Rechazar opciones duplicadas.
- Rechazar validacion sin opciones, con menos de dos opciones, con cero correctas o varias correctas.
- Guardar validation result y obtener ultimo.
- Validacion pasada recomienda `pending_review`, no `validated`.
- Errores criticos recomiendan `needs_fix`.
- Admin puede aprobar pregunta valida.
- Admin no puede aprobar pregunta invalida.
- Student no puede aprobar.
- Aprobacion/rechazo/needs_fix crean review log.
- Guardar/listar/resumir feedback.
- Generation run se guarda y actualiza.
- Preguntas generadas quedan `pending_review` o `needs_fix`.
- Pregunta generada nunca queda `validated`.
- Factory usa InMemory en modo memory.
- Factory usa Supabase para questions/options/reviews en modo supabase.
- Tests/attempts/answers siguen InMemory.
- No se expone `SUPABASE_SERVICE_ROLE_KEY` en frontend.
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

- Que `questions` esta en Supabase.
- Que `question_options` esta en Supabase.
- Que validation results estan en Supabase.
- Que reviews estan en Supabase.
- Que review feedback esta en Supabase.
- Que generation runs estan en Supabase.
- Que tests/attempts/answers siguen en memoria.
- Como activar Supabase.
- Como volver a InMemory.
- Migracion `023_questions_options.sql`.
- Estado hibrido actual.
- Specs futuras pendientes.

## Security And Quality Checklist

Antes de terminar, verifica:

- No hay claves reales en el repo.
- No hay `SUPABASE_SERVICE_ROLE_KEY` en codigo frontend.
- No hay `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- No se usa service role desde componentes React.
- No se loguean claves.
- `.env` sigue ignorado.
- RLS basica o documentacion explicita de pendientes.
- Guards de aplicacion siguen activos.
- `is_correct` no se expone a student antes de enviar test.
- Student no ve preguntas no validadas.
- IA no puede crear `validated`.
- Solo revision humana aprueba.

## Out Of Scope

No implementes:

- Repositorios Supabase para tests.
- Repositorios Supabase para test questions.
- Repositorios Supabase para attempts.
- Repositorios Supabase para answers.
- RLS hardening final.
- Edge Functions.
- Fine-tuning.
- RAG avanzado.
- Embeddings.
- Sustitucion de revision humana.

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de cambios.
- Migracion creada.
- Repositorios Supabase creados.
- Como activar modo Supabase.
- Que sigue en InMemory.
- Confirmacion de que IA nunca crea `validated`.
- Confirmacion de que solo revision humana aprueba.
- Tests ejecutados.
- Confirmacion explicita de que no se migraron tests/attempts/answers.
