# SPEC 024 - Supabase Repositories: Tests, Attempts & Answers

## 1. Objetivo

Migrar a Supabase el bloque de tests, intentos, respuestas y resultados de TESTOPO.

Esta spec completa la migracion principal del MVP a Supabase.

Se migran:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Despues de esta spec, el nucleo funcional del MVP debe estar persistido en Supabase:

- Usuarios.
- Workspaces.
- Oposiciones.
- Materiales.
- Temario.
- Preguntas.
- Tests.
- Resultados.

## 2. Contexto

Specs previas relevantes:

- SPEC 007 - Test Generator.
- SPEC 008 - Test Taking & Results.
- SPEC 013 - Student Portal.
- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.

Despues de la SPEC 023 ya existen en Supabase:

- Auth.
- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.
- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.

Ahora migramos:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Esta SPEC 024 debe usar el tooling/runbook existente:

```text
docs/setup/migrations-runbook.md
```

No crear un proceso paralelo de migracion.

## 3. Branch

```text
feature/supabase-tests-attempts-answers
```

## 4. Principio Central

La migracion a Supabase no debe cambiar las reglas del test.

Reglas principales:

- Un test solo usa preguntas `validated`.
- Student no ve respuestas correctas antes de enviar.
- Student no ve explicaciones antes de enviar.
- Student solo ve sus propios resultados.
- Student no accede a tests de oposiciones no autorizadas.

Correcto:

```text
Pregunta validated
  -> Test generado
  -> Student responde
  -> Student envia
  -> Resultado calculado
  -> Explicacion y fuente visibles despues de enviar
```

Incorrecto:

```text
Pregunta pending_review entra en test
Student ve correct_answer antes de enviar
Student ve resultado de otro usuario
```

## 5. Alcance

Claude debe implementar:

- Migracion SQL para `tests`.
- Migracion SQL para `test_questions`.
- Migracion SQL para `test_attempts`.
- Migracion SQL para `test_answers`.
- Repositorios Supabase para estas entidades.
- Adaptacion del factory de repositorios.
- Integracion con preguntas ya migradas a Supabase.
- Integracion con portal Student.
- Integracion con resultados.
- Tests criticos.
- Actualizacion de documentacion de persistencia.
- Uso del tooling/runbook de migracion existente.

## 6. Fuera De Alcance

No implementar todavia:

- RLS final completa de todo el dominio.
- Edge Functions.
- Borrado real de cuenta Auth.
- Estadisticas avanzadas.
- Ranking.
- Gamificacion.
- Repeticion espaciada.
- Plan inteligente de estudio.
- Exportacion PDF de resultados.
- Marketplace.
- Pagos.
- Beta readiness.

Esta spec solo migra tests y resultados a Supabase.

## 7. Estado Esperado Tras Esta Spec

Supabase:

- Auth.
- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `material_topic_links`.
- `material_import_batches`.
- `material_import_items`.
- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.
- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

InMemory:

- Solo mocks/dev si `APP_PERSISTENCE_MODE=memory`.

El MVP principal ya debe poder funcionar con Supabase como persistencia real.

## 8. Tablas Afectadas

### 8.1 `tests`

Representa un test generado para una oposicion.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
created_by uuid references profiles(id)
title text
mode text not null
status text not null default 'created'
question_count integer not null
filters jsonb
random_seed text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `mode`:

- `random`.
- `by_topic`.
- `by_difficulty`.
- `mixed`.

Valores permitidos para `status`:

- `created`.
- `in_progress`.
- `completed`.
- `cancelled`.

Reglas:

- Un test siempre pertenece a una oposicion.
- Un test siempre pertenece a un workspace.
- `workspace_id` debe coincidir con el workspace de la oposicion.
- Un test no debe contener preguntas no validadas.
- Un test cancelado no debe iniciarse.
- Los filtros deben guardar informacion util para reconstruir como se genero.

### 8.2 `test_questions`

Representa las preguntas incluidas en un test y su orden.

Campos recomendados:

```text
id uuid primary key
test_id uuid not null references tests(id) on delete cascade
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
question_id uuid not null references questions(id)
order_index integer not null
options_order jsonb
created_at timestamptz not null default now()
```

Reglas:

- `question_id` debe pertenecer a la misma oposicion que el test.
- La pregunta debe estar en estado `validated`.
- No duplicar la misma pregunta dentro de un test.
- `options_order` permite aleatorizar opciones sin cambiar la pregunta original.
- Student no debe recibir `is_correct` al cargar test.

Restricciones recomendadas:

```text
unique(test_id, question_id)
unique(test_id, order_index)
```

### 8.3 `test_attempts`

Representa un intento de realizar un test.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
test_id uuid not null references tests(id)
user_id uuid not null references profiles(id)
status text not null default 'in_progress'
started_at timestamptz not null default now()
submitted_at timestamptz
score integer
total_questions integer not null default 0
correct_count integer not null default 0
incorrect_count integer not null default 0
unanswered_count integer not null default 0
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `status`:

- `in_progress`.
- `submitted`.
- `cancelled`.

Reglas:

- Un intento pertenece a un usuario concreto.
- Student solo puede ver sus propios intentos.
- No se puede modificar un intento `submitted`.
- No se puede enviar dos veces.
- No se puede responder a preguntas fuera del test.
- Los contadores se calculan al enviar.
- Las preguntas sin responder cuentan como `unanswered`, no como incorrectas.

### 8.4 `test_answers`

Representa una respuesta del usuario a una pregunta del test.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
attempt_id uuid not null references test_attempts(id) on delete cascade
test_question_id uuid not null references test_questions(id)
question_id uuid not null references questions(id)
selected_option_id uuid references question_options(id)
is_correct boolean
answered_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Restriccion recomendada:

```text
unique(attempt_id, test_question_id)
```

Reglas:

- `test_question_id` debe pertenecer al mismo test del intento.
- `question_id` debe coincidir con la pregunta del `test_question`.
- `selected_option_id` debe pertenecer a la pregunta.
- `is_correct` puede calcularse al guardar o al enviar, pero no debe mostrarse antes de submit.
- Una respuesta puede actualizarse mientras el intento esta `in_progress`.
- No puede actualizarse despues de `submitted`.

## 9. Migraciones

Crear migracion en:

```text
supabase/migrations
```

Nombre obligatorio segun runbook:

```text
024_tests_attempts_answers.sql
```

La migracion debe:

1. Crear `tests`.
2. Crear `test_questions`.
3. Crear `test_attempts`.
4. Crear `test_answers`.
5. Crear constraints basicos.
6. Crear indices.
7. Crear o reutilizar trigger de `updated_at`.
8. Activar RLS basica siguiendo el patron de specs previas.
9. No tocar tablas fuera de alcance salvo referencias necesarias.

Debe seguir las reglas de idempotencia de:

```text
docs/setup/migrations-runbook.md
```

## 10. Indices Recomendados

Crear indices para:

- `tests.workspace_id`.
- `tests.opposition_id`.
- `tests.created_by`.
- `tests.status`.
- `tests.mode`.
- `test_questions.test_id`.
- `test_questions.question_id`.
- `test_questions.opposition_id`.
- `test_questions.test_id + order_index`.
- `test_attempts.workspace_id`.
- `test_attempts.opposition_id`.
- `test_attempts.test_id`.
- `test_attempts.user_id`.
- `test_attempts.status`.
- `test_attempts.submitted_at`.
- `test_answers.attempt_id`.
- `test_answers.test_question_id`.
- `test_answers.question_id`.
- `test_answers.selected_option_id`.

## 11. Row Level Security Basica

Seguir el patron de specs anteriores.

La RLS final completa se hara en una spec posterior de hardening.

Politicas minimas recomendadas:

`tests`:

- Owner/admin/manager puede crear tests de oposiciones de su workspace.
- Student puede leer tests asociados a oposiciones donde tiene acceso activo.
- Student no puede crear tests administrativos si esa accion esta restringida.
- Si Student puede generar test propio, debe hacerlo solo dentro de oposiciones autorizadas.

`test_questions`:

- Owner/admin/manager puede leer preguntas del test.
- Student puede leer la estructura del test, pero no debe recibir respuestas correctas.
- RLS puede limitar acceso, pero el ocultamiento de `is_correct` debe reforzarse en servicios.

`test_attempts`:

- Student puede crear intento propio.
- Student puede leer solo sus propios intentos.
- Student no puede leer intentos de otros usuarios.
- Owner/admin puede leer resultados si el producto lo permite para seguimiento, pero no debe romper privacidad sin decision explicita.

`test_answers`:

- Student puede crear/actualizar respuestas propias mientras el intento esta `in_progress`.
- Student puede leer respuestas propias.
- Student no puede leer respuestas de otros usuarios.
- No permitir modificaciones tras submit.

Si la RLS completa complica la implementacion:

- Activar RLS.
- Anadir politicas basicas.
- Mantener guards de aplicacion.
- Documentar politicas pendientes.

## 12. Repositorios Supabase

Crear implementaciones similares a:

- `SupabaseTestRepository`.
- `SupabaseTestQuestionRepository`.
- `SupabaseTestAttemptRepository`.
- `SupabaseTestAnswerRepository`.

Deben cumplir las interfaces async existentes.

## 13. Metodos Esperados: `TestRepository`

Ejemplo conceptual:

```ts
class SupabaseTestRepository implements TestRepository {
  async findById(id: string): Promise<Test | null> {}
  async listByOpposition(oppositionId: string, filters?: TestFilters): Promise<Test[]> {}
  async listByUser(userId: string): Promise<Test[]> {}
  async create(input: CreateTestInput): Promise<Test> {}
  async update(id: string, input: UpdateTestInput): Promise<Test> {}
  async cancel(id: string): Promise<Test> {}
}
```

Debe soportar filtros por:

- `status`.
- `mode`.
- `created_by`.

## 14. Metodos Esperados: `TestQuestionRepository`

Ejemplo conceptual:

```ts
class SupabaseTestQuestionRepository implements TestQuestionRepository {
  async listByTest(testId: string): Promise<TestQuestion[]> {}
  async addMany(testId: string, questions: CreateTestQuestionInput[]): Promise<TestQuestion[]> {}
  async findById(id: string): Promise<TestQuestion | null> {}
}
```

Reglas:

- No duplicar pregunta dentro del test.
- Mantener orden.
- Mantener `options_order`.
- Verificar que todas las preguntas esten `validated`.

## 15. Metodos Esperados: `TestAttemptRepository`

Ejemplo conceptual:

```ts
class SupabaseTestAttemptRepository implements TestAttemptRepository {
  async findById(id: string): Promise<TestAttempt | null> {}
  async listByUser(userId: string, filters?: AttemptFilters): Promise<TestAttempt[]> {}
  async listByTest(testId: string): Promise<TestAttempt[]> {}
  async create(input: CreateTestAttemptInput): Promise<TestAttempt> {}
  async update(id: string, input: UpdateTestAttemptInput): Promise<TestAttempt> {}
  async submit(id: string, result: SubmitAttemptResultInput): Promise<TestAttempt> {}
  async cancel(id: string): Promise<TestAttempt> {}
}
```

## 16. Metodos Esperados: `TestAnswerRepository`

Ejemplo conceptual:

```ts
class SupabaseTestAnswerRepository implements TestAnswerRepository {
  async findByAttemptAndTestQuestion(attemptId: string, testQuestionId: string): Promise<TestAnswer | null> {}
  async listByAttempt(attemptId: string): Promise<TestAnswer[]> {}
  async upsertAnswer(input: UpsertTestAnswerInput): Promise<TestAnswer> {}
  async deleteAnswer(attemptId: string, testQuestionId: string): Promise<void> {}
}
```

Reglas:

- Upsert mientras attempt esta `in_progress`.
- No permitir upsert tras submit.
- Validar que option pertenece a la pregunta.
- Validar que `test_question` pertenece al test del attempt.

## 17. Factory De Repositorios

Actualizar el factory siguiendo el patron de specs previas.

Comportamiento esperado:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos usan InMemory

APP_PERSISTENCE_MODE=supabase
-> todos los repos principales del MVP usan Supabase
```

Repos principales ya en Supabase:

- `profiles`.
- `workspaces`.
- `workspace_members`.
- `oppositions`.
- `opposition_access`.
- `materials`.
- `topics`.
- `questions`.
- `tests`.
- `attempts`.
- `answers`.

El fallback InMemory debe seguir existiendo para tests, desarrollo y modo demo.

## 18. Compatibilidad Con Test Generator

La generacion de tests debe funcionar en modo Supabase.

Flujo esperado:

```text
Student/Admin solicita test
  -> Servicio busca preguntas validated en Supabase
  -> Aplica filtros: oposicion, tema, dificultad, modo
  -> Crea Test en Supabase
  -> Crea TestQuestions en Supabase
  -> Devuelve test sin respuestas correctas al estudiante
```

Reglas:

- Solo usar preguntas `validated`.
- Excluir preguntas `draft`, `pending_review`, `needs_fix`, `rejected`, `obsolete`.
- Excluir preguntas cuyo material este `obsolete`.
- Excluir preguntas cuyo topic este `obsolete`.
- No duplicar preguntas dentro del test.
- Respetar `question_count`.
- Si no hay suficientes preguntas, devolver error claro.

## 19. Compatibilidad Con Test Taking

El flujo de realizacion de test debe funcionar en modo Supabase.

Flujo esperado:

```text
Student inicia test
  -> Se crea TestAttempt
  -> Student responde preguntas
  -> Se crean/actualizan TestAnswers
  -> Student envia
  -> Se calcula resultado
  -> Se actualiza TestAttempt
  -> Se bloquean modificaciones posteriores
```

Reglas:

- No iniciar test cancelado.
- No responder preguntas fuera del test.
- No seleccionar opciones de otra pregunta.
- No modificar respuestas tras submit.
- No enviar dos veces.
- No consultar revision antes de enviar.

## 20. Compatibilidad Con Resultados

Despues de enviar, Student debe poder ver:

- `score`.
- `percentage`.
- `correct_count`.
- `incorrect_count`.
- `unanswered_count`.
- `selected_option`.
- `correct_option`.
- `explanation`.
- `source_reference`.
- `source_excerpt`.
- `topic`.
- `difficulty`.

Antes de enviar, Student no debe ver:

- `correct_option`.
- `is_correct`.
- `explanation`.
- `source_reference` como solucion.
- `source_excerpt` como solucion.

La fuente puede mostrarse como referencia de material si ya se hacia, pero no como pista directa de respuesta si compromete el test.

## 21. Compatibilidad Con Student Portal

Student Portal debe seguir cumpliendo:

- Student ve oposiciones autorizadas.
- Student crea tests solo en oposiciones autorizadas.
- Student realiza tests.
- Student ve sus resultados.
- Student no ve resultados de otros.
- Student no ve respuestas correctas antes de enviar.
- Student no accede al banco administrativo de preguntas.

## 22. Compatibilidad Con Admin

Admin/owner/manager debe poder:

- Crear tests si el flujo admin lo permite.
- Ver tests de una oposicion.
- Cancelar tests.
- Ver resultados agregados solo si ya existia ese flujo.
- No romper la separacion admin/student.
- No anadir estadisticas avanzadas en esta spec.

## 23. Reglas De Negocio Que Deben Mantenerse

Deben seguir cumpliendose:

1. Test solo usa preguntas `validated`.
2. Test no usa preguntas `obsolete`.
3. Test no usa preguntas con material `obsolete`.
4. Test no usa preguntas con topic `obsolete`.
5. Test no duplica preguntas.
6. Student no ve respuestas correctas antes de enviar.
7. Student no ve explicacion antes de enviar.
8. Student solo ve sus intentos.
9. No se puede modificar attempt `submitted`.
10. No se puede enviar dos veces.
11. `Unanswered` no cuenta como incorrecta.
12. Score se calcula correctamente.
13. No se cruzan workspaces.
14. No se cruzan oposiciones.
15. No se rompen permisos de `opposition_access`.

## 24. Errores Recomendados

- `TEST_NOT_FOUND`.
- `TEST_REQUIRED`.
- `TEST_OPPOSITION_REQUIRED`.
- `TEST_WORKSPACE_REQUIRED`.
- `TEST_CREATE_FAILED`.
- `TEST_UPDATE_FAILED`.
- `TEST_CANCEL_FAILED`.
- `TEST_ACCESS_DENIED`.
- `TEST_INVALID_MODE`.
- `TEST_INVALID_STATUS`.
- `TEST_INVALID_QUESTION_COUNT`.
- `TEST_NOT_ENOUGH_VALIDATED_QUESTIONS`.
- `TEST_ONLY_VALIDATED_QUESTIONS_ALLOWED`.
- `TEST_DUPLICATE_QUESTION_NOT_ALLOWED`.
- `TEST_CANCELLED_CANNOT_BE_STARTED`.
- `TEST_QUESTION_NOT_FOUND`.
- `TEST_QUESTION_CREATE_FAILED`.
- `TEST_QUESTION_OPPOSITION_MISMATCH`.
- `TEST_QUESTION_NOT_VALIDATED`.
- `TEST_ATTEMPT_NOT_FOUND`.
- `TEST_ATTEMPT_CREATE_FAILED`.
- `TEST_ATTEMPT_UPDATE_FAILED`.
- `TEST_ATTEMPT_ALREADY_SUBMITTED`.
- `TEST_ATTEMPT_CANCELLED`.
- `TEST_ATTEMPT_ACCESS_DENIED`.
- `TEST_ATTEMPT_INVALID_STATUS`.
- `TEST_ATTEMPT_REVIEW_NOT_AVAILABLE`.
- `TEST_ANSWER_NOT_FOUND`.
- `TEST_ANSWER_CREATE_FAILED`.
- `TEST_ANSWER_UPDATE_FAILED`.
- `QUESTION_NOT_IN_TEST`.
- `OPTION_NOT_IN_QUESTION`.
- `ANSWER_AFTER_SUBMIT_NOT_ALLOWED`.
- `SUPABASE_QUERY_FAILED`.
- `PERSISTENCE_MODE_INVALID`.

## 25. Tests Obligatorios

Tests:

- Crear test en oposicion valida.
- No crear test sin oposicion.
- No crear test cruzando workspace/opposition.
- Crear test solo con preguntas `validated`.
- Excluir preguntas no validadas.
- Excluir preguntas con material `obsolete`.
- Excluir preguntas con topic `obsolete`.
- No duplicar preguntas en test.
- Fallar si no hay suficientes preguntas validadas.
- Cancelar test.
- No iniciar test cancelado.

Test questions:

- Crear `test_questions` con orden.
- Mantener `options_order`.
- No duplicar `question_id` en el mismo test.
- No anadir pregunta de otra oposicion.
- No anadir pregunta no `validated`.

Attempts:

- Crear attempt propio.
- No crear attempt para test inexistente.
- No crear attempt para test cancelado.
- Student solo ve sus attempts.
- Student no ve attempts de otro usuario.
- Cancelar attempt.
- No modificar attempt `cancelled`.
- No modificar attempt `submitted`.

Answers:

- Guardar respuesta.
- Actualizar respuesta.
- Borrar respuesta si el flujo lo permite.
- No responder pregunta fuera del test.
- No seleccionar opcion de otra pregunta.
- No responder tras submit.
- No duplicar respuesta para mismo attempt/test_question.

Submit/result:

- Submit calcula `correct_count`.
- Submit calcula `incorrect_count`.
- Submit calcula `unanswered_count`.
- `Unanswered` no cuenta como incorrect.
- Submit calcula score.
- No permitir doble submit.
- Resultado muestra explicacion despues de submit.
- Revision no disponible antes de submit.
- Student no ve correct answers antes de submit.

Factory/persistencia:

- Factory usa InMemory en modo memory.
- Factory usa Supabase para tests/attempts/answers en modo supabase.
- Tests existentes siguen pasando.
- No se expone service role en frontend.

## 26. Documentacion

Actualizar:

```text
docs/architecture/persistence.md
docs/setup/supabase-setup.md
docs/setup/migrations-runbook.md
```

Debe explicar:

- Que `tests` ya estan en Supabase.
- Que `test_questions` ya estan en Supabase.
- Que attempts ya estan en Supabase.
- Que answers ya estan en Supabase.
- Que el MVP principal ya esta persistido en Supabase.
- Como ejecutar la migracion.
- Como usar el tooling/runbook existente.
- Como volver a modo memory.
- Que queda pendiente.
- Si existe un runbook especifico, referenciarlo.

## 27. Tooling/Runbook De Migracion

Claude debe usar el tooling/runbook existente para:

- Crear migracion.
- Validar migracion.
- Crear repositorios Supabase.
- Actualizar factory.
- Anadir tests.
- Actualizar documentacion.
- Verificar que no se migran entidades fuera de alcance.

No crear tooling paralelo salvo que sea estrictamente necesario.

## 28. Estado Esperado Tras Esta Spec

Al terminar:

- Auth real funciona.
- Profiles funcionan en Supabase.
- Workspaces funcionan en Supabase.
- Workspace members funcionan en Supabase.
- Oppositions funcionan en Supabase.
- Opposition access funciona en Supabase.
- Materials funcionan en Supabase.
- Topics funcionan en Supabase.
- Questions funcionan en Supabase.
- Question options funcionan en Supabase.
- Tests funcionan en Supabase.
- Test questions funcionan en Supabase.
- Test attempts funcionan en Supabase.
- Test answers funcionan en Supabase.
- El MVP principal tiene persistencia real.

## 29. Futuras Specs Previstas

Despues de esta spec, el orden recomendado sera:

- SPEC 025 - Supabase RLS Hardening.
- SPEC 026 - Supabase Edge Functions for Account Deletion.
- SPEC 027 - Beta Readiness.

Tambien puede anadirse antes de beta una spec de:

```text
Pre-Beta QA & Data Consistency
```

si aparecen problemas tras la migracion completa.

## 30. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existe migracion para `tests`.
- Existe migracion para `test_questions`.
- Existe migracion para `test_attempts`.
- Existe migracion para `test_answers`.
- Existen repositorios Supabase para estas entidades.
- El factory los usa en modo Supabase.
- El fallback InMemory sigue funcionando.
- El test generator lee preguntas validadas desde Supabase.
- Los tests creados se guardan en Supabase.
- Los attempts se guardan en Supabase.
- Las answers se guardan en Supabase.
- Submit calcula resultados correctamente.
- Student no ve respuestas correctas antes de enviar.
- Student no ve explicaciones antes de enviar.
- Student solo ve sus propios resultados.
- No se rompen permisos de workspace/opposition.
- La documentacion explica que el MVP principal ya esta persistido.
- Se ha usado el tooling/runbook existente.
- No se expone `SUPABASE_SERVICE_ROLE_KEY`.
- Tests existentes siguen pasando.

## 31. Prompt Para Claude

Claude, implementa la SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.

Debes continuar la migracion progresiva a Supabase usando el tooling/runbook ya creado:

```text
docs/setup/migrations-runbook.md
```

Migra unicamente:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Debes implementar:

1. Migraciones SQL para las tablas indicadas.
2. Repositorios Supabase para tests/test_questions/test_attempts/test_answers.
3. Adaptacion del factory de repositorios.
4. Integracion con questions ya migradas.
5. Integracion con Student Portal.
6. Compatibilidad con Test Generator.
7. Compatibilidad con Test Taking.
8. Compatibilidad con Results.
9. Fallback InMemory.
10. Tests criticos.
11. Documentacion del nuevo estado de persistencia.
12. Uso del runbook/tooling existente.

Reglas obligatorias:

- Usa el tooling/runbook existente.
- No crees un proceso paralelo de migracion.
- No hardcodees claves.
- No subas `.env`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- Manten fallback InMemory.
- Los tests solo pueden usar preguntas `validated`.
- Student no puede ver respuestas correctas antes de enviar.
- Student no puede ver explicacion antes de enviar.
- Student solo puede ver sus propios resultados.
- No se puede modificar un attempt `submitted`.
- No se puede enviar dos veces.
- Manten los tests existentes en verde.
- Documenta que el MVP principal ya esta persistido en Supabase.

Objetivo:

Dejar TESTOPO con tests, intentos, respuestas y resultados persistidos en Supabase, cerrando la migracion principal del MVP antes del hardening de seguridad y la beta.
