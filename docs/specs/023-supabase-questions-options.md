# SPEC 023 - Supabase Repositories: Questions & Options

## 1. Objetivo

Migrar a Supabase el bloque del banco de preguntas de TESTOPO.

Se migran:

- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.

No se migran todavia:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

## 2. Contexto

Specs previas relevantes:

- SPEC 001 - Question Bank.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.
- SPEC 018.4 - AI Question Generation & Review Feedback Loop.
- SPEC 018.4-B - OpenAI as Primary AI Provider.
- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.

Despues de la SPEC 022 ya existen en Supabase:

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

Ahora migramos el banco de preguntas.

Esta SPEC 023 debe usar el tooling/runbook existente:

```text
docs/setup/migrations-runbook.md
```

No crear un proceso paralelo de migracion.

## 3. Branch

```text
feature/supabase-questions-options
```

## 4. Principio Central

La migracion a Supabase no debe cambiar las reglas de fiabilidad de TESTOPO.

Regla principal:

```text
Una pregunta no es valida porque este en Supabase.
Una pregunta solo es valida si cumple reglas de calidad y ha sido aprobada.
```

Correcto:

```text
IA genera pregunta
  -> Pregunta queda pending_review o needs_fix
  -> Validador automatico revisa
  -> Admin revisa
  -> Admin aprueba
  -> Pregunta pasa a validated
```

Incorrecto:

```text
IA genera pregunta
  -> Pregunta se guarda directamente como validated
```

Reglas no negociables:

- La IA nunca puede crear preguntas como `validated`.
- Solo revision humana puede aprobar preguntas.
- Student no puede ver preguntas no validadas.
- Tests, attempts y answers siguen en memoria.

## 5. Alcance

Claude debe implementar:

- Migracion SQL para `questions`.
- Migracion SQL para `question_options`.
- Migracion SQL para `question_validation_results`.
- Migracion SQL para `question_reviews`.
- Migracion SQL para `question_review_feedback`.
- Migracion SQL para `question_generation_runs`.
- Repositorios Supabase para estas entidades.
- Adaptacion del factory de repositorios.
- Integracion con `materials` y `topics` ya migrados.
- Integracion con OpenAI provider/mock provider ya existentes.
- Integracion con validacion automatica.
- Integracion con revision humana.
- Tests criticos.
- Actualizacion de documentacion de persistencia.
- Uso del tooling/runbook de migracion ya existente.

## 6. Fuera De Alcance

No implementar todavia:

- Supabase repositories para `tests`.
- Supabase repositories para `test_questions`.
- Supabase repositories para `test_attempts`.
- Supabase repositories para `test_answers`.
- RLS final completa de todo el dominio.
- Edge Functions.
- Borrado real de cuenta Auth.
- Fine-tuning.
- RAG avanzado.
- Embeddings.
- Validacion automatica definitiva.
- Generacion directa de tests para estudiantes.
- Sustitucion de revision humana.
- Beta readiness.

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

InMemory:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Este estado hibrido es correcto.

## 8. Tablas Afectadas

### 8.1 `questions`

Representa una pregunta del banco.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
material_id uuid references materials(id)
topic_id uuid references topics(id)
statement text not null
explanation text
source_reference text
source_excerpt text
difficulty text not null
status text not null default 'draft'
created_by uuid references profiles(id)
generated_by_ai boolean not null default false
generation_run_id uuid
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores permitidos para `difficulty`:

- `easy`.
- `medium`.
- `hard`.

Valores permitidos para `status`:

- `draft`.
- `pending_review`.
- `validated`.
- `rejected`.
- `needs_fix`.
- `obsolete`.

Reglas:

- Una pregunta siempre pertenece a una oposicion.
- Una pregunta siempre pertenece a un workspace.
- `workspace_id` debe coincidir con el workspace de la oposicion.
- Si tiene `material_id`, debe pertenecer a la misma oposicion.
- Si tiene `topic_id`, debe pertenecer a la misma oposicion.
- Una pregunta generada por IA nunca puede nacer como `validated`.
- Student no puede ver preguntas no validadas.
- Student no debe acceder al banco interno de preguntas.
- Tests futuros solo podran usar preguntas `validated`.

### 8.2 `question_options`

Representa las opciones de respuesta de una pregunta.

Campos recomendados:

```text
id uuid primary key
question_id uuid not null references questions(id) on delete cascade
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
text text not null
is_correct boolean not null default false
order_index integer not null default 0
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Reglas:

- Cada opcion pertenece a una pregunta.
- Las opciones deben pertenecer al mismo workspace/opposition que la pregunta.
- Una pregunta valida debe tener al menos dos opciones.
- Una pregunta valida debe tener exactamente una opcion correcta.
- No permitir opciones duplicadas dentro de la misma pregunta.
- No exponer `is_correct` al estudiante antes de enviar test.

### 8.3 `question_validation_results`

Resultado del validador automatico.

Campos recomendados:

```text
id uuid primary key
question_id uuid not null references questions(id) on delete cascade
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
status text not null
passed boolean not null default false
errors jsonb
warnings jsonb
info jsonb
recommended_status text
validator_version text
validated_at timestamptz not null default now()
created_at timestamptz not null default now()
```

Valores para `status`:

- `passed`.
- `failed`.
- `passed_with_warnings`.

Valores para `recommended_status`:

- `pending_review`.
- `needs_fix`.

Regla:

- El validador automatico nunca recomienda `validated`.

### 8.4 `question_reviews`

Registro de revision humana.

Campos recomendados:

```text
id uuid primary key
question_id uuid not null references questions(id) on delete cascade
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
action text not null
previous_status text
new_status text not null
reviewer_id uuid references profiles(id)
reviewer_name text
notes text
validation_result_id uuid references question_validation_results(id)
created_at timestamptz not null default now()
```

Valores para `action`:

- `approve`.
- `reject`.
- `mark_needs_fix`.
- `mark_obsolete`.
- `edit`.
- `return_to_pending_review`.

Reglas:

- Solo owner/admin/manager autorizado puede revisar.
- Solo revision humana puede pasar una pregunta a `validated`.
- Debe quedar registro de cada accion de revision.
- No permitir transiciones invalidas.

### 8.5 `question_review_feedback`

Feedback humano usado para mejorar futuras generaciones.

Campos recomendados:

```text
id uuid primary key
question_id uuid not null references questions(id) on delete cascade
review_id uuid references question_reviews(id)
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
feedback_type text not null
severity text not null
comment text
created_by uuid references profiles(id)
created_at timestamptz not null default now()
```

Valores recomendados para `feedback_type`:

- `ambiguous_statement`.
- `multiple_correct_answers`.
- `wrong_correct_answer`.
- `weak_explanation`.
- `missing_source`.
- `bad_source_excerpt`.
- `too_easy`.
- `too_hard`.
- `duplicated_question`.
- `off_topic`.
- `invented_content`.
- `bad_options`.
- `unclear_wording`.
- `needs_legal_precision`.
- `other`.

Valores para `severity`:

- `low`.
- `medium`.
- `high`.
- `critical`.

Reglas:

- El feedback debe poder resumirse para futuras generaciones.
- Al rechazar o marcar `needs_fix`, se recomienda guardar motivo.
- El feedback no valida ni invalida automaticamente por si solo.
- El feedback alimenta el prompt/contexto de IA.

### 8.6 `question_generation_runs`

Registro de ejecuciones de generacion IA.

Campos recomendados:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
opposition_id uuid not null references oppositions(id)
material_id uuid references materials(id)
topic_id uuid references topics(id)
requested_count integer not null
generated_count integer not null default 0
provider text
model text
status text not null
feedback_used jsonb
warnings jsonb
errors jsonb
created_by uuid references profiles(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Valores para `status`:

- `pending`.
- `completed`.
- `completed_with_warnings`.
- `failed`.

Reglas:

- Registrar proveedor y modelo usados.
- Registrar si se uso feedback previo.
- No guardar claves de API.
- No guardar datos sensibles innecesarios.
- Una generacion puede producir preguntas, pero nunca `validated`.

## 9. Migraciones

Crear migracion en:

```text
supabase/migrations
```

Nombre obligatorio segun runbook:

```text
023_questions_options.sql
```

La migracion debe:

1. Crear `questions`.
2. Crear `question_options`.
3. Crear `question_validation_results`.
4. Crear `question_reviews`.
5. Crear `question_review_feedback`.
6. Crear `question_generation_runs`.
7. Crear constraints basicos.
8. Crear indices.
9. Crear o reutilizar trigger de `updated_at`.
10. Activar RLS basica siguiendo el patron de specs previas.
11. No tocar tablas fuera de alcance salvo referencias necesarias.

Debe seguir las reglas de idempotencia de:

```text
docs/setup/migrations-runbook.md
```

## 10. Indices Recomendados

Crear indices para:

- `questions.workspace_id`.
- `questions.opposition_id`.
- `questions.material_id`.
- `questions.topic_id`.
- `questions.status`.
- `questions.difficulty`.
- `questions.generated_by_ai`.
- `questions.generation_run_id`.
- `question_options.question_id`.
- `question_options.opposition_id`.
- `question_validation_results.question_id`.
- `question_validation_results.opposition_id`.
- `question_validation_results.status`.
- `question_reviews.question_id`.
- `question_reviews.opposition_id`.
- `question_reviews.reviewer_id`.
- `question_reviews.action`.
- `question_review_feedback.question_id`.
- `question_review_feedback.opposition_id`.
- `question_review_feedback.feedback_type`.
- `question_review_feedback.severity`.
- `question_generation_runs.workspace_id`.
- `question_generation_runs.opposition_id`.
- `question_generation_runs.material_id`.
- `question_generation_runs.topic_id`.
- `question_generation_runs.status`.
- `question_generation_runs.created_by`.

## 11. Row Level Security Basica

Seguir el patron de las specs anteriores.

No hace falta implementar todavia toda la RLS final. Eso sera una spec posterior de hardening.

Politicas minimas recomendadas:

`questions`:

- Owner/admin/manager puede leer preguntas de oposiciones de su workspace.
- Owner/admin/manager puede crear y editar preguntas.
- Owner/admin/manager puede revisar preguntas.
- Student no debe leer preguntas no validadas.
- Student no debe acceder al banco de preguntas administrativo.
- Si se permite alguna lectura student, debe limitarse a preguntas `validated` y solo a traves del flujo de test.

`question_options`:

- Owner/admin/manager puede leer opciones completas.
- Student no debe ver `is_correct` antes de enviar test.
- Las opciones para student deben servirse desde servicio controlado, no directamente desde tabla abierta.

`question_validation_results`:

- Owner/admin/manager puede leer resultados de validacion.
- Student no debe ver informes internos de validacion.

`question_reviews`:

- Owner/admin/manager puede leer historial de revision.
- Student no debe ver historial interno de revision.

`question_review_feedback`:

- Owner/admin/manager puede leer feedback.
- Student no debe ver feedback interno.

`question_generation_runs`:

- Owner/admin/manager puede ver generaciones.
- Student no puede ver ejecuciones IA internas.

Si RLS completa complica la implementacion:

- Activar RLS.
- Anadir politicas basicas.
- Mantener guards de aplicacion.
- Documentar politicas pendientes.

## 12. Repositorios Supabase

Crear implementaciones similares a:

- `SupabaseQuestionRepository`.
- `SupabaseQuestionOptionRepository`.
- `SupabaseQuestionValidationResultRepository`.
- `SupabaseQuestionReviewRepository`.
- `SupabaseQuestionReviewFeedbackRepository`.
- `SupabaseQuestionGenerationRunRepository`.

Deben cumplir las interfaces async existentes.

## 13. Metodos Esperados: `QuestionRepository`

Ejemplo conceptual:

```ts
class SupabaseQuestionRepository implements QuestionRepository {
  async findById(id: string): Promise<Question | null> {}
  async listByOpposition(oppositionId: string, filters?: QuestionFilters): Promise<Question[]> {}
  async listByTopic(topicId: string, filters?: QuestionFilters): Promise<Question[]> {}
  async listByMaterial(materialId: string, filters?: QuestionFilters): Promise<Question[]> {}
  async create(input: CreateQuestionInput): Promise<Question> {}
  async update(id: string, input: UpdateQuestionInput): Promise<Question> {}
  async changeStatus(id: string, status: QuestionStatus): Promise<Question> {}
}
```

Debe soportar filtros por:

- `status`.
- `difficulty`.
- `topic_id`.
- `material_id`.
- `generated_by_ai`.

## 14. Metodos Esperados: `QuestionOptionRepository`

Ejemplo conceptual:

```ts
class SupabaseQuestionOptionRepository implements QuestionOptionRepository {
  async listByQuestion(questionId: string): Promise<QuestionOption[]> {}
  async createMany(questionId: string, options: CreateQuestionOptionInput[]): Promise<QuestionOption[]> {}
  async replaceForQuestion(questionId: string, options: CreateQuestionOptionInput[]): Promise<QuestionOption[]> {}
  async deleteByQuestion(questionId: string): Promise<void> {}
}
```

Reglas:

- Al crear o reemplazar opciones, validar duplicados.
- Mantener exactamente una correcta para preguntas que pasan a validacion.
- No romper el orden de opciones.

## 15. Metodos Esperados: Validation Result Repository

```ts
class SupabaseQuestionValidationResultRepository implements QuestionValidationResultRepository {
  async create(input: CreateQuestionValidationResultInput): Promise<QuestionValidationResult> {}
  async findLatestByQuestion(questionId: string): Promise<QuestionValidationResult | null> {}
  async listByQuestion(questionId: string): Promise<QuestionValidationResult[]> {}
}
```

## 16. Metodos Esperados: Review Repository

```ts
class SupabaseQuestionReviewRepository implements QuestionReviewRepository {
  async create(input: CreateQuestionReviewInput): Promise<QuestionReview> {}
  async listByQuestion(questionId: string): Promise<QuestionReview[]> {}
  async listByOpposition(oppositionId: string, filters?: ReviewFilters): Promise<QuestionReview[]> {}
}
```

## 17. Metodos Esperados: Feedback Repository

```ts
class SupabaseQuestionReviewFeedbackRepository implements QuestionReviewFeedbackRepository {
  async create(input: CreateQuestionReviewFeedbackInput): Promise<QuestionReviewFeedback> {}
  async listByQuestion(questionId: string): Promise<QuestionReviewFeedback[]> {}
  async summarizeForGeneration(input: FeedbackSummaryInput): Promise<QuestionGenerationFeedbackSummary[]> {}
}
```

Debe permitir resumir feedback por:

- `opposition_id`.
- `topic_id`.
- `material_id`.
- `feedback_type`.
- `severity`.

## 18. Metodos Esperados: Generation Run Repository

```ts
class SupabaseQuestionGenerationRunRepository implements QuestionGenerationRunRepository {
  async create(input: CreateQuestionGenerationRunInput): Promise<QuestionGenerationRun> {}
  async update(id: string, input: UpdateQuestionGenerationRunInput): Promise<QuestionGenerationRun> {}
  async findById(id: string): Promise<QuestionGenerationRun | null> {}
  async listByOpposition(oppositionId: string): Promise<QuestionGenerationRun[]> {}
  async listByMaterial(materialId: string): Promise<QuestionGenerationRun[]> {}
  async listByTopic(topicId: string): Promise<QuestionGenerationRun[]> {}
}
```

## 19. Factory De Repositorios

Actualizar el factory siguiendo el patron de specs previas.

Comportamiento esperado:

```text
APP_PERSISTENCE_MODE=memory
-> todos los repos usan InMemory

APP_PERSISTENCE_MODE=supabase
-> profiles/workspaces/oppositions/materials/topics/questions usan Supabase
-> tests/attempts/answers siguen en InMemory
```

Debe quedar documentado el estado hibrido.

## 20. Compatibilidad Con AI Question Generation

La generacion de preguntas debe funcionar en modo Supabase.

Flujo esperado:

```text
Material en Supabase
  -> Topic en Supabase
  -> IA genera candidatos
  -> GenerationRun se guarda en Supabase
  -> Questions se guardan en Supabase
  -> Options se guardan en Supabase
  -> ValidationResult se guarda en Supabase
  -> Preguntas quedan pending_review o needs_fix
```

Reglas:

- Pregunta generada por IA nunca puede quedar `validated`.
- Si la salida IA es incompleta, no guardar pregunta invalida.
- Si una pregunta tiene errores criticos, debe quedar `needs_fix`.
- Si pasa validacion formal, queda `pending_review`.

## 21. Compatibilidad Con Admin Review

La revision humana debe funcionar en modo Supabase.

Flujo esperado:

```text
Admin abre preguntas pendientes
  -> Admin revisa pregunta
  -> Admin aprueba/rechaza/marca needs_fix
  -> Question status se actualiza en Supabase
  -> QuestionReview se guarda en Supabase
  -> QuestionReviewFeedback se guarda si aplica
```

Reglas:

- Solo owner/admin/manager autorizado puede revisar.
- Student no puede revisar.
- Una pregunta no puede aprobarse si falla reglas criticas.
- Toda aprobacion debe dejar review log.
- Rechazo o `needs_fix` deberia permitir guardar feedback.

## 22. Compatibilidad Con Question Validation

La validacion automatica debe funcionar en modo Supabase.

Debe comprobar:

- Enunciado.
- Opciones.
- Exactamente una correcta.
- Explicacion.
- Fuente.
- Material no `obsolete`.
- Topic no `obsolete`.
- Dificultad valida.
- Estado valido.
- Duplicados.
- Fuente y tema de la misma oposicion.

El resultado debe guardarse en `question_validation_results`.

El validador automatico puede recomendar `pending_review` o `needs_fix`, nunca `validated`.

## 23. Compatibilidad Con Student Portal

Student no debe ver preguntas pendientes, rechazadas, en correccion u obsoletas.

Aunque tests todavia sigan en memoria, las reglas deben preservarse:

- Student no ve banco de preguntas interno.
- Student no ve respuesta correcta antes de enviar test.
- Student no ve explicacion antes de enviar test.
- Student solo podra usar preguntas validadas cuando tests migren o lean desde Supabase en spec posterior.

## 24. Reglas De Negocio Que Deben Mantenerse

Deben seguir cumpliendose:

1. Pregunta validada requiere enunciado.
2. Pregunta validada requiere al menos dos opciones.
3. Pregunta validada requiere exactamente una opcion correcta.
4. Pregunta validada requiere explicacion.
5. Pregunta validada requiere fuente.
6. Pregunta validada requiere tema.
7. Pregunta validada requiere dificultad valida.
8. Pregunta validada no puede tener material `obsolete`.
9. Pregunta validada no puede tener topic `obsolete`.
10. Pregunta generada por IA nunca nace como `validated`.
11. Solo revision humana puede aprobar.
12. Student no ve preguntas no validadas.
13. No se cruzan workspaces.
14. No se cruzan oposiciones.
15. Feedback se guarda para mejorar futuras generaciones.

## 25. Errores Recomendados

- `QUESTION_NOT_FOUND`.
- `QUESTION_REQUIRED`.
- `QUESTION_OPPOSITION_REQUIRED`.
- `QUESTION_WORKSPACE_REQUIRED`.
- `QUESTION_MATERIAL_NOT_FOUND`.
- `QUESTION_TOPIC_NOT_FOUND`.
- `QUESTION_CREATE_FAILED`.
- `QUESTION_UPDATE_FAILED`.
- `QUESTION_ACCESS_DENIED`.
- `QUESTION_INVALID_STATUS`.
- `QUESTION_INVALID_DIFFICULTY`.
- `QUESTION_STATEMENT_REQUIRED`.
- `QUESTION_OPTIONS_REQUIRED`.
- `QUESTION_MIN_OPTIONS_NOT_MET`.
- `QUESTION_SINGLE_CORRECT_OPTION_REQUIRED`.
- `QUESTION_EXPLANATION_REQUIRED`.
- `QUESTION_SOURCE_REQUIRED`.
- `QUESTION_TOPIC_REQUIRED`.
- `QUESTION_DUPLICATE_OPTIONS`.
- `QUESTION_SOURCE_OBSOLETE`.
- `QUESTION_TOPIC_OBSOLETE`.
- `QUESTION_AI_CANNOT_VALIDATE`.
- `QUESTION_OPTION_NOT_FOUND`.
- `QUESTION_OPTION_CREATE_FAILED`.
- `QUESTION_OPTION_DUPLICATE`.
- `QUESTION_VALIDATION_FAILED`.
- `QUESTION_VALIDATION_RESULT_CREATE_FAILED`.
- `QUESTION_REVIEW_NOT_FOUND`.
- `QUESTION_REVIEW_CREATE_FAILED`.
- `QUESTION_REVIEW_APPROVAL_BLOCKED`.
- `QUESTION_REVIEW_INVALID_TRANSITION`.
- `QUESTION_FEEDBACK_CREATE_FAILED`.
- `QUESTION_GENERATION_RUN_CREATE_FAILED`.
- `QUESTION_GENERATION_RUN_UPDATE_FAILED`.
- `SUPABASE_QUERY_FAILED`.
- `PERSISTENCE_MODE_INVALID`.

## 26. Tests Obligatorios

Questions:

- Crear pregunta en oposicion valida.
- No crear pregunta sin oposicion.
- No crear pregunta cruzando workspace/opposition.
- Buscar pregunta por id.
- Listar preguntas por oposicion.
- Listar preguntas por topic.
- Listar preguntas por material.
- Filtrar por status.
- Filtrar por difficulty.
- Actualizar pregunta.
- Cambiar status.
- No permitir status invalido.
- No permitir difficulty invalida.

Options:

- Crear opciones para una pregunta.
- Reemplazar opciones.
- No permitir opciones duplicadas.
- No permitir pregunta validada sin opciones.
- No permitir pregunta validada con menos de dos opciones.
- No permitir pregunta validada con cero correctas.
- No permitir pregunta validada con varias correctas.

Validation:

- Guardar validation result.
- Obtener ultimo validation result.
- Errores criticos recomiendan `needs_fix`.
- Validacion pasada recomienda `pending_review`, no `validated`.

Review:

- Admin puede aprobar pregunta valida.
- Admin no puede aprobar pregunta invalida.
- Student no puede aprobar pregunta.
- Aprobacion crea review log.
- Rechazo crea review log.
- `needs_fix` crea review log.
- Transiciones invalidas se bloquean.

Feedback:

- Guardar feedback de revision.
- Listar feedback por pregunta.
- Resumir feedback para generacion.
- Feedback se incluye en futuras generaciones si el servicio lo usa.

AI generation:

- Generation run se guarda.
- Preguntas generadas se guardan en `pending_review` o `needs_fix`.
- Pregunta generada nunca queda `validated`.
- Mock provider sigue funcionando.
- OpenAI provider no se llama en tests unitarios.
- Salida incompleta de IA se rechaza.

Factory/persistencia:

- Factory usa InMemory en modo memory.
- Factory usa Supabase para questions/options/reviews en modo supabase.
- Tests siguen en InMemory.
- Tests existentes siguen pasando.
- No se expone service role en frontend.

## 27. Documentacion

Actualizar:

```text
docs/architecture/persistence.md
docs/setup/supabase-setup.md
docs/setup/migrations-runbook.md
```

Debe explicar:

- Que `questions` ya esta en Supabase.
- Que `question_options` ya esta en Supabase.
- Que validation results ya estan en Supabase.
- Que reviews ya estan en Supabase.
- Que review feedback ya esta en Supabase.
- Que generation runs ya estan en Supabase.
- Que tests y attempts siguen en memoria.
- Como ejecutar la migracion.
- Como usar el tooling/runbook existente.
- Como volver a modo memory.
- Que queda pendiente.
- Si existe un runbook especifico, referenciarlo.

## 28. Tooling/Runbook De Migracion

Claude debe usar el tooling/runbook existente para:

- Crear migracion.
- Validar migracion.
- Crear repositorios Supabase.
- Actualizar factory.
- Anadir tests.
- Actualizar documentacion.
- Verificar que no se migran entidades fuera de alcance.

No crear tooling paralelo salvo que sea estrictamente necesario.

## 29. Estado Esperado Tras Esta Spec

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
- Validation results funcionan en Supabase.
- Reviews funcionan en Supabase.
- Review feedback funciona en Supabase.
- Generation runs funcionan en Supabase.
- Tests siguen en memoria.
- Attempts siguen en memoria.
- Answers siguen en memoria.

## 30. Futuras Specs Previstas

Despues de esta spec, el orden recomendado sera:

- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
- SPEC 025 - Supabase RLS Hardening.
- SPEC 026 - Supabase Edge Functions for Account Deletion.
- SPEC 027 - Beta Readiness.

## 31. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existe migracion para `questions`.
- Existe migracion para `question_options`.
- Existe migracion para `question_validation_results`.
- Existe migracion para `question_reviews`.
- Existe migracion para `question_review_feedback`.
- Existe migracion para `question_generation_runs`.
- Existen repositorios Supabase para estas entidades.
- El factory los usa en modo Supabase.
- El fallback InMemory sigue funcionando.
- La generacion IA guarda preguntas en Supabase sin validarlas automaticamente.
- La validacion automatica guarda resultados en Supabase.
- La revision humana guarda logs en Supabase.
- El feedback humano se guarda y puede resumirse.
- Student no ve preguntas no validadas.
- No se migran tests/attempts/answers.
- La documentacion explica el nuevo estado hibrido.
- Se ha usado el tooling/runbook existente.
- No se expone `SUPABASE_SERVICE_ROLE_KEY`.
- Tests existentes siguen pasando.

## 32. Prompt Para Claude

Claude, implementa la SPEC 023 - Supabase Repositories: Questions & Options.

Debes continuar la migracion progresiva a Supabase usando el tooling/runbook ya creado:

```text
docs/setup/migrations-runbook.md
```

Migra unicamente:

- `questions`.
- `question_options`.
- `question_validation_results`.
- `question_reviews`.
- `question_review_feedback`.
- `question_generation_runs`.

No migres todavia:

- `tests`.
- `test_questions`.
- `test_attempts`.
- `test_answers`.

Debes implementar:

1. Migraciones SQL para las tablas indicadas.
2. Repositorios Supabase para questions/options/validation/reviews/feedback/generation runs.
3. Adaptacion del factory de repositorios.
4. Integracion con workspaces/oppositions/materials/topics ya migrados.
5. Compatibilidad con AI Question Generation.
6. Compatibilidad con Admin Review.
7. Compatibilidad con Question Validation.
8. Fallback InMemory.
9. Tests criticos.
10. Documentacion del nuevo estado hibrido.
11. Uso del runbook/tooling existente.

Reglas obligatorias:

- Usa el tooling/runbook existente.
- No crees un proceso paralelo de migracion.
- No hardcodees claves.
- No subas `.env`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- No migres tablas fuera de alcance.
- Manten fallback InMemory.
- La IA nunca puede crear preguntas como `validated`.
- Solo revision humana puede aprobar preguntas.
- Student no puede ver preguntas no validadas.
- Tests y attempts siguen en memoria.
- Manten los tests existentes en verde.
- Documenta que queda en Supabase y que sigue en memoria.

Objetivo:

Dejar TESTOPO con el banco de preguntas real persistido en Supabase, manteniendo intactas las reglas de fiabilidad, revision humana y trazabilidad.
