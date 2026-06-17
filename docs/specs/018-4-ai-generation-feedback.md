# SPEC 018.4 - AI Question Generation & Review Feedback Loop

## 1. Objetivo

Implementar la primera version real de generacion de preguntas con IA en TESTOPO y crear un sistema inicial de aprendizaje basado en feedback humano.

La IA debe ayudar a crear preguntas, pero no debe sustituir la revision humana.

Regla central:

- La IA puede proponer preguntas.
- La IA no puede validar preguntas definitivamente.
- Los tests solo usan preguntas validadas.

## 2. Contexto

TESTOPO se basa en un principio fundamental:

```text
Una pregunta no es valida porque la IA la haya generado.
Una pregunta solo es valida si tiene fuente, explicacion, una unica respuesta correcta, tema, dificultad y ha pasado revision.
```

Ya existe un flujo conceptual:

```text
Material
  -> Generacion de preguntas
  -> Validacion automatica
  -> Revision humana
  -> Pregunta validada
  -> Test
```

Esta spec convierte la generacion IA en algo mas real y anade feedback de calidad.

## 3. Branch

```text
feature/pre-beta-ai-generation-feedback
```

## 4. Alcance

Claude debe implementar:

- Proveedor real o configurable de IA para generar preguntas.
- Interfaz desacoplada `QuestionGenerationProvider`.
- Prompt estructurado de generacion.
- Generacion de preguntas desde material o fragmento.
- Guardado de preguntas generadas como `pending_review`, `draft` o `needs_fix`.
- Registro de metadatos de generacion.
- Sistema de feedback de revision.
- Motivos de rechazo o correccion.
- Uso del feedback para mejorar futuras generaciones.
- Validaciones para evitar preguntas peligrosas, ambiguas o sin fuente.
- Tests automaticos criticos.

## 5. Fuera De Alcance

No implementar todavia:

- Fine-tuning.
- Entrenamiento real de modelos.
- Embeddings.
- RAG avanzado.
- Indexacion vectorial.
- Generacion automatica de tests completos por IA.
- Preguntas validadas automaticamente.
- Sustitucion de la revision humana.
- Aprendizaje autonomo no controlado.
- Evaluacion juridica avanzada.
- Correccion automatica definitiva.

## 6. Diferencia Entre Generar Preguntas Y Generar Tests

La IA debe generar preguntas candidatas.

No debe generar tests finales directamente.

Correcto:

```text
IA genera 20 preguntas candidatas
  -> Admin revisa
  -> Admin aprueba 12
  -> El test se genera usando esas 12 preguntas validadas y otras del pool validado
```

Incorrecto:

```text
IA genera un test completo
  -> Student lo hace directamente
```

Esto queda prohibido para el MVP.

## 7. Estados Permitidos Para Preguntas Generadas Por IA

Una pregunta generada por IA solo puede nacer en estos estados:

- `draft`
- `pending_review`
- `needs_fix`

Recomendacion:

- `pending_review`

Nunca:

- `validated`

## 8. Proveedor De IA

Crear o consolidar una interfaz similar a:

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

## 9. Pregunta Generada

Modelo minimo:

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

## 10. Reglas De Generacion

La IA debe cumplir:

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
- Evitar preguntas con "todas las anteriores" o "ninguna de las anteriores", salvo autorizacion expresa.
- Evitar respuestas correctas demasiado evidentes.
- No repetir preguntas existentes.

## 11. Prompt Base De Generacion

Crear o actualizar:

```text
/prompts/question-generator.md
```

Debe incluir:

```text
# TESTOPO Question Generator Prompt

Eres un generador de preguntas tipo test para oposiciones.

Reglas obligatorias:
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

Formato de salida:
Devuelve JSON estructurado con:
- statement
- options
- correct option
- explanation
- source excerpt
- source reference
- difficulty
- warnings
```

## 12. Feedback De Revision

Crear modelo `QuestionReviewFeedback` o similar.

Campos minimos:

- `id`
- `question_id`
- `review_id`
- `feedback_type`
- `severity`
- `comment`
- `created_by`
- `created_at`

## 13. Tipos De Feedback

Valores recomendados para `feedback_type`:

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

## 14. Severidad

Valores:

- `low`
- `medium`
- `high`
- `critical`

Ejemplos:

- `missing_source` = `critical`
- `multiple_correct_answers` = `critical`
- `weak_explanation` = `medium`
- `too_easy` = `low`

## 15. Uso Del Feedback Para Futuras Generaciones

Para el MVP, el aprendizaje debe funcionar asi:

1. Se guardan los errores detectados.
2. Se agrupan por tema, material, oposicion y tipo de error.
3. Antes de generar nuevas preguntas, se consultan errores frecuentes.
4. El prompt de generacion incluye instrucciones adicionales.

Ejemplo:

```text
En generaciones anteriores de este tema se detectaron estos errores:
- Preguntas demasiado ambiguas.
- Opciones con mas de una respuesta correcta.
- Explicaciones demasiado breves.

Evita especialmente esos errores.
```

Esto no es entrenamiento real. Es mejora por contexto y reglas.

## 16. Resumen De Feedback

Crear funcion o servicio:

```ts
getFeedbackSummaryForGeneration(input): Promise<QuestionGenerationFeedbackSummary[]>
```

Debe poder resumir:

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

## 17. Integracion Con Revision Humana

En la pantalla de revision de pregunta, el admin debe poder marcar motivos como:

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

## 18. Generacion Desde Material

La IA debe poder generar preguntas desde:

- Material completo si el texto no es demasiado largo.
- Fragmento seleccionado.
- Tema concreto.

Si el material es demasiado largo, para MVP:

- Usar un fragmento.
- O limitar a una cantidad razonable de caracteres.

No implementar todavia RAG avanzado.

## 19. Limites Recomendados

Para evitar costes y errores:

- Maximo preguntas por generacion: 20.
- Maximo caracteres por generacion: configurable.

Ejemplo:

```text
MAX_GENERATION_INPUT_CHARS=20000
MAX_GENERATED_QUESTIONS=20
```

## 20. Variables De Entorno

No hardcodear claves.

Usar variables de entorno:

- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_MODEL`
- `MAX_GENERATION_INPUT_CHARS`
- `MAX_GENERATED_QUESTIONS`

Crear valores de ejemplo en `.env.example` sin claves reales.

## 21. Modo Mock

Mantener modo mock o fallback para tests.

Ejemplo:

```text
AI_PROVIDER=mock
```

Asi los tests no dependen de una API externa.

## 22. Validacion Posterior A Generacion

Toda pregunta generada debe pasar por el validador automatico existente.

Si falla validacion critica:

```text
status = needs_fix
```

Si pasa validacion formal:

```text
status = pending_review
```

Nunca:

```text
status = validated
```

## 23. Metadatos De Generacion

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

## 24. Mensajes De Usuario

Ejemplos:

- Se han generado 12 preguntas pendientes de revision.
- No se han podido generar preguntas porque el material no contiene suficiente texto.
- Algunas preguntas necesitan correccion antes de poder revisarse.
- La IA ha tenido en cuenta errores detectados en revisiones anteriores de este tema.

## 25. Tests Obligatorios

Deben existir tests para comprobar:

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

## 26. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existe proveedor IA configurable.
- Existe modo mock para tests.
- La IA puede generar preguntas desde material o fragmento.
- Las preguntas generadas nunca nacen como `validated`.
- Las preguntas generadas pasan por validacion automatica.
- Los errores de revision pueden guardarse como feedback.
- El feedback puede resumirse.
- El feedback puede usarse en futuras generaciones.
- Los tests siguen usando solo preguntas validadas.
- No se implementa fine-tuning.
- No se implementa RAG avanzado.
- No se implementan embeddings.
- No se sustituye la revision humana.
- No se rompen funcionalidades existentes.

