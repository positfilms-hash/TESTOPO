# Claude Prompt - SPEC 018.4 AI Question Generation & Review Feedback Loop

## Context

Queremos empezar a implementar la IA real de TESTOPO para generar preguntas desde material, manteniendo el principio central del producto:

```text
La IA no valida preguntas.
La IA solo genera borradores o preguntas pendientes de revision.
Los tests solo usan preguntas validadas por revision humana.
```

Tambien queremos que la app empiece a aprender de errores detectados en revision, pero no mediante entrenamiento real. Para el MVP, el aprendizaje es feedback contextual: registrar motivos de rechazo/correccion y usarlos para mejorar prompts futuros.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/018-4-ai-generation-feedback.md
```

Branch de trabajo:

```text
feature/pre-beta-ai-generation-feedback
```

## Product Goal

Implementar:

- Proveedor IA configurable.
- Interfaz `QuestionGenerationProvider`.
- Modo mock para tests.
- Prompt base en `/prompts/question-generator.md`.
- Generacion de preguntas desde material o fragmento.
- Guardado de preguntas generadas como `pending_review`, `draft` o `needs_fix`.
- Validacion automatica posterior a generacion.
- Registro de metadatos de generacion.
- Modelo de feedback de revision.
- Motivos de rechazo o correccion.
- Resumen de feedback.
- Uso del feedback en futuras generaciones.
- Tests criticos.

## Non-Negotiable Rules

- La IA nunca crea preguntas en estado `validated`.
- Una pregunta generada por IA solo puede nacer como `draft`, `pending_review` o `needs_fix`.
- Recomendacion por defecto: `pending_review`.
- Toda pregunta generada debe pasar por validacion automatica.
- Si falla validacion critica, debe quedar en `needs_fix`.
- Si pasa validacion formal, debe quedar en `pending_review`.
- Solo una accion explicita de revision humana puede pasar una pregunta a `validated`.
- Los tests siguen usando solo preguntas `validated`.
- Student no ve preguntas pendientes, rechazadas ni en correccion.
- Student no ve respuestas correctas antes de enviar un test.

## Out Of Scope

No implementes:

- Fine-tuning.
- Entrenamiento real de modelos.
- Embeddings.
- RAG avanzado.
- Indexacion vectorial.
- Generacion automatica de tests completos por IA.
- Tests generados directamente por IA para estudiantes.
- Preguntas validadas automaticamente.
- Sustitucion de la revision humana.
- Aprendizaje autonomo no controlado.
- Evaluacion juridica avanzada.
- Correccion automatica definitiva.

## AI Provider

Crea o consolida una interfaz desacoplada:

```ts
interface QuestionGenerationProvider {
  generateQuestions(input: QuestionGenerationInput): Promise<QuestionGenerationOutput>
}
```

Entrada recomendada:

```ts
type QuestionGenerationInput = {
  materialId: string
  topicId?: string
  materialTitle: string
  materialText: string
  excerpt?: string
  difficulty: "easy" | "medium" | "hard" | "mixed"
  questionCount: number
  previousFeedback?: QuestionGenerationFeedbackSummary[]
}
```

Salida recomendada:

```ts
type QuestionGenerationOutput = {
  questions: GeneratedQuestionCandidate[]
  provider: string
  model?: string
  rawResponse?: unknown
}
```

## Generated Candidate Shape

Modelo recomendado:

```ts
type GeneratedQuestionCandidate = {
  statement: string
  options: {
    text: string
    isCorrect: boolean
  }[]
  correctAnswerExplanation: string
  sourceExcerpt: string
  sourceReference: string
  topicId?: string
  difficulty: "easy" | "medium" | "hard"
  confidence?: number
  warnings?: string[]
}
```

## Generation Rules

La IA debe:

- Usar solo el material aportado.
- No inventar contenido externo.
- Crear una unica respuesta correcta.
- Crear varias opciones plausibles.
- Incluir explicacion.
- Incluir fragmento o referencia de fuente.
- Asociar tema si existe.
- Indicar dificultad.
- Evitar preguntas ambiguas.
- Evitar preguntas de opinion.
- Evitar "todas las anteriores" o "ninguna de las anteriores", salvo autorizacion expresa.
- Evitar respuestas correctas demasiado evidentes.
- No repetir preguntas existentes.

## Base Prompt

Crea o actualiza:

```text
/prompts/question-generator.md
```

Debe incluir reglas obligatorias:

1. Usa unicamente el material proporcionado.
2. No inventes informacion externa.
3. Cada pregunta debe tener una unica respuesta correcta.
4. Cada pregunta debe incluir explicacion.
5. Cada pregunta debe indicar la fuente exacta o fragmento usado.
6. No generes preguntas ambiguas.
7. No generes preguntas de opinion.
8. No generes preguntas sin base textual.
9. No marques ninguna pregunta como validada.
10. Si no hay suficiente material, devuelve menos preguntas o indica que no se puede generar.

La salida debe ser JSON estructurado con:

- `statement`
- `options`
- correct option
- explanation
- source excerpt
- source reference
- difficulty
- warnings

## Environment Variables

No hardcodees claves.

Usa variables:

```text
AI_PROVIDER
AI_API_KEY
AI_MODEL
MAX_GENERATION_INPUT_CHARS
MAX_GENERATED_QUESTIONS
```

Actualiza `.env.example` con placeholders, sin claves reales.

Debe existir modo mock:

```text
AI_PROVIDER=mock
```

Los tests no deben depender de una API externa real.

## Feedback Model

Crea modelo `QuestionReviewFeedback` o similar.

Campos minimos:

- `id`
- `question_id`
- `review_id`
- `feedback_type`
- `severity`
- `comment`
- `created_by`
- `created_at`

Tipos recomendados:

- `ambiguous_statement`
- `multiple_correct_answers`
- `wrong_correct_answer`
- `weak_explanation`
- `missing_source`
- `bad_source_excerpt`
- `too_easy`
- `too_hard`
- `duplicated_question`
- `off_topic`
- `invented_content`
- `bad_options`
- `unclear_wording`
- `needs_legal_precision`
- `other`

Severidad:

- `low`
- `medium`
- `high`
- `critical`

## Feedback Summary

Crea servicio o funcion:

```ts
getFeedbackSummaryForGeneration(input): Promise<QuestionGenerationFeedbackSummary[]>
```

Debe resumir:

- Errores frecuentes por oposicion.
- Errores frecuentes por tema.
- Errores frecuentes por material.
- Ultimos errores criticos.

Modelo recomendado:

```ts
type QuestionGenerationFeedbackSummary = {
  feedbackType: string
  count: number
  severity: string
  exampleComments?: string[]
}
```

## Feedback Loop

Para el MVP, el aprendizaje funciona por contexto:

1. Se guardan errores detectados en revision.
2. Se agrupan por tema, material, oposicion y tipo de error.
3. Antes de generar nuevas preguntas, se consultan errores frecuentes.
4. El prompt de generacion incluye instrucciones adicionales para evitar esos errores.

Esto no es entrenamiento real, fine-tuning, embeddings ni RAG.

## Human Review Integration

En la pantalla de revision, el admin debe poder marcar motivos como:

- Ambigua.
- Varias respuestas correctas.
- Respuesta correcta incorrecta.
- Explicacion insuficiente.
- Fuente insuficiente.
- Fuera de tema.
- Contenido inventado.
- Opciones mal planteadas.
- Otro.

Tambien puede anadir comentario libre.

Al marcar `needs_fix` o `rejected`, se recomienda pedir al menos un motivo.

## Generation Metadata

Guardar en la pregunta o en una entidad `QuestionGenerationRun`:

- `id`
- `material_id`
- `topic_id`
- `requested_count`
- `generated_count`
- `provider`
- `model`
- `status`
- `feedback_used`
- `created_by`
- `created_at`

Estados:

- `pending`
- `completed`
- `completed_with_warnings`
- `failed`

## Limits

Usar limites configurables:

```text
MAX_GENERATION_INPUT_CHARS=20000
MAX_GENERATED_QUESTIONS=20
```

No superar el maximo de preguntas por generacion.

Si el material es demasiado largo:

- Usar fragmento.
- O limitar caracteres.

No implementar RAG avanzado.

## Required Tests

Deben existir tests para:

- La IA genera preguntas en `pending_review`, no `validated`.
- Si la pregunta tiene errores criticos queda en `needs_fix`.
- No se generan preguntas sin material.
- No se generan preguntas sin fuente.
- No se generan preguntas sin explicacion.
- No se permite mas de una respuesta correcta.
- No se supera el maximo de preguntas por generacion.
- El modo mock funciona en tests.
- El feedback de revision se guarda.
- El feedback se resume para futuras generaciones.
- El feedback se incluye en el input del proveedor.
- Al rechazar una pregunta puede registrarse motivo.
- Al marcar `needs_fix` puede registrarse motivo.
- Los tests siguen usando solo preguntas `validated`.
- Student no ve preguntas generadas pendientes.
- No se rompe el flujo de revision humana.

Ejecuta tambien los tests/build existentes del proyecto.

## PR Expectations

En la descripcion del PR incluye:

- Resumen de proveedor IA y modo mock.
- Variables de entorno necesarias, sin valores reales.
- Estados usados para preguntas generadas.
- Como se guarda y resume feedback.
- Confirmacion explicita de que la IA nunca crea preguntas `validated`.
- Confirmacion explicita de que los tests siguen usando solo `validated`.
- Confirmacion explicita de que no se implemento fine-tuning, embeddings ni RAG avanzado.
- Checks ejecutados.

## Acceptance Criteria

- Existe proveedor IA configurable.
- Existe modo mock para tests.
- La IA puede generar preguntas desde material o fragmento.
- Las preguntas generadas nunca nacen como `validated`.
- Las preguntas generadas pasan por validacion automatica.
- Los errores de revision pueden guardarse como feedback.
- El feedback puede resumirse.
- El feedback puede usarse en futuras generaciones.
- Los tests siguen usando solo preguntas validadas.
- Student no ve preguntas pendientes.
- No se implementa fine-tuning.
- No se implementan embeddings.
- No se implementa RAG avanzado.
- No se sustituye la revision humana.
- No se rompen funcionalidades existentes.

