# Claude Prompt - SPEC 024 Supabase Repositories: Tests, Attempts & Answers

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 024 - Supabase Repositories: Tests, Attempts & Answers
```

La app ya tiene:

- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.
- Tooling/runbook de migraciones Supabase.

## Spec

Implementa estrictamente:

```text
docs/specs/024-supabase-tests-attempts-answers.md
```

Branch de trabajo:

```text
feature/supabase-tests-attempts-answers
```

Runbook obligatorio:

```text
docs/setup/migrations-runbook.md
```

No crees un proceso paralelo de migracion.

## Product Goal

Persistir en Supabase el bloque de tests, intentos, respuestas y resultados:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Esta spec cierra la migracion principal del MVP antes de RLS hardening/beta.

## Non-Negotiable Rules

- Usa `docs/setup/migrations-runbook.md`.
- Migra solo `tests`, `test_questions`, `test_attempts` y `test_answers`.
- No cambies reglas de generacion/correccion de tests.
- Los tests solo pueden usar preguntas `validated`.
- Student no puede ver respuestas correctas antes de enviar.
- Student no puede ver explicaciones antes de enviar.
- Student solo puede ver sus propios resultados.
- No se puede modificar un attempt `submitted`.
- No se puede enviar dos veces.
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
supabase/migrations/024_tests_attempts_answers.sql
```

Debe seguir el runbook:

- Nombre alineado con la SPEC.
- Idempotente.
- Sin datos reales ni claves.
- `updated_at` + trigger donde aplique.
- RLS basica.
- Documentacion actualizada.

Debe crear o consolidar:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Incluye:

- Primary keys.
- Foreign keys.
- Checks.
- Unique `test_questions(test_id, question_id)`.
- Unique `test_questions(test_id, order_index)`.
- Unique `test_answers(attempt_id, test_question_id)`.
- Indices utiles.
- RLS basica.

No tocar tablas fuera de alcance salvo referencias necesarias.

### 2. Supabase repositories

Crear repositorios Supabase que implementen las interfaces async existentes:

- `SupabaseTestRepository`.
- `SupabaseTestQuestionRepository`.
- `SupabaseTestAttemptRepository`.
- `SupabaseTestAnswerRepository`.

Los repos deben mapear filas Supabase a modelos de dominio sin cambiar contratos de servicios.

### 3. Repository factory / persistence selector

Actualizar el factory para que:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos siguen InMemory

APP_PERSISTENCE_MODE=supabase
-> todos los repos principales del MVP usan Supabase
```

El fallback InMemory debe seguir existiendo para tests, desarrollo y modo demo.

### 4. Test Generator

Mantener:

- Solo preguntas `validated`.
- Excluir draft/pending_review/needs_fix/rejected/obsolete.
- Excluir preguntas con material/topic obsolete.
- No duplicar preguntas.
- Devolver error claro si no hay suficientes preguntas.
- Devolver test al estudiante sin respuestas correctas.

### 5. Test Taking And Results

Mantener:

- Crear attempt propio.
- Guardar/actualizar answers mientras attempt esta `in_progress`.
- Bloquear updates tras submit.
- Calcular score, correct, incorrect, unanswered.
- Unanswered no cuenta como incorrect.
- No permitir doble submit.
- No mostrar solucion antes de submit.
- Mostrar solucion/explicacion/fuente despues de submit.
- Student solo ve sus resultados.

## Required Tests

Anade tests para:

- Crear test en oposicion valida.
- No crear test sin oposicion.
- No crear test cruzando workspace/opposition.
- Crear test solo con preguntas `validated`.
- Excluir preguntas no validadas.
- Excluir preguntas con material/topic obsolete.
- No duplicar preguntas en test.
- Fallar si no hay suficientes preguntas validadas.
- Cancelar test y no iniciar test cancelado.
- Crear test_questions con orden y `options_order`.
- No anadir pregunta de otra oposicion o no validated.
- Crear attempt propio.
- Student solo ve sus attempts.
- Student no ve attempts/resultados de otros usuarios.
- No modificar attempt cancelled/submitted.
- Guardar/actualizar/borrar respuesta si el flujo lo permite.
- No responder pregunta fuera del test.
- No seleccionar opcion de otra pregunta.
- No responder tras submit.
- Submit calcula contadores y score.
- Unanswered no cuenta como incorrect.
- No permitir doble submit.
- Resultado muestra explicacion despues de submit.
- Revision no disponible antes de submit.
- Student no ve correct answers antes de submit.
- Factory usa InMemory en modo memory.
- Factory usa Supabase para tests/attempts/answers en modo supabase.
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

- Que `tests` esta en Supabase.
- Que `test_questions` esta en Supabase.
- Que `test_attempts` esta en Supabase.
- Que `test_answers` esta en Supabase.
- Que el MVP principal ya esta persistido en Supabase.
- Como activar Supabase.
- Como volver a InMemory.
- Migracion `024_tests_attempts_answers.sql`.
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
- `is_correct` no se expone antes de submit.
- `correct_option` no se expone antes de submit.
- `explanation` no se expone antes de submit.
- Student no ve resultados de otros usuarios.
- Attempts submitted son inmutables.

## Out Of Scope

No implementes:

- RLS hardening final.
- Edge Functions.
- Borrado real de cuenta Auth.
- Estadisticas avanzadas.
- Ranking.
- Gamificacion.
- Repeticion espaciada.
- Plan inteligente de estudio.
- Export PDF de resultados.
- Pagos.
- Beta readiness.

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de cambios.
- Migracion creada.
- Repositorios Supabase creados.
- Como activar modo Supabase.
- Confirmacion de que el MVP principal ya queda persistido en Supabase.
- Confirmacion de que tests solo usan preguntas `validated`.
- Confirmacion de que Student no ve soluciones antes de submit.
- Confirmacion de que Student solo ve sus propios resultados.
- Tests ejecutados.
