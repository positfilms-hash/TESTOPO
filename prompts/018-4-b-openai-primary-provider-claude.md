# Claude Prompt - SPEC 018.4-B OpenAI as Primary AI Provider

## Context

Esta mini spec ajusta la SPEC 018.4 - AI Question Generation & Review Feedback Loop.

Decision de producto:

```text
OpenAI sera el proveedor principal para generar preguntas tipo test en TESTOPO.
Anthropic/Claude puede quedar como proveedor alternativo configurable.
Mock debe mantenerse para tests y desarrollo local.
```

El principio central no cambia:

```text
La IA no valida preguntas.
La IA solo genera borradores o preguntas pendientes de revision.
Los tests solo usan preguntas validadas por revision humana.
```

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/018-4-b-openai-primary-provider.md
```

Branch de trabajo:

```text
feature/openai-primary-ai-provider
```

## Product Goal

Implementar OpenAI como proveedor principal configurable de generacion de preguntas, manteniendo:

- Arquitectura desacoplada por `QuestionGenerationProvider`.
- Anthropic como proveedor opcional.
- Mock provider para tests.
- Validacion estructural antes de guardar.
- Revision humana obligatoria.

## Non-Negotiable Rules

- OpenAI nunca crea preguntas en estado `validated`.
- Ningun proveedor IA puede crear preguntas en estado `validated`.
- Una pregunta generada por IA solo puede nacer como `draft`, `pending_review` o `needs_fix`.
- Toda salida de OpenAI debe validarse antes de guardarse.
- Si la salida esta incompleta, no se guarda como pregunta valida.
- Solo una accion explicita de revision humana puede pasar una pregunta a `validated`.
- Los tests siguen usando solo preguntas `validated`.
- Student no ve preguntas pendientes, rechazadas ni en correccion.
- El mock debe seguir funcionando sin llamadas externas.
- Los tests no deben depender de OpenAI real.

## Out Of Scope

No implementes:

- Fine-tuning.
- Entrenamiento propio.
- RAG avanzado.
- Embeddings.
- Indexacion vectorial.
- Generacion directa de tests para estudiantes.
- Validacion automatica definitiva.
- Sustitucion de revision humana.
- Migraciones Supabase.
- Pagos.
- OAuth.
- Funciones fuera de IA de preguntas.

## Provider Architecture

Mantener el dominio desacoplado de proveedores concretos.

El codigo de dominio debe depender de:

```ts
QuestionGenerationProvider
```

No debe depender directamente de OpenAI ni de Anthropic.

Implementaciones esperadas:

- `OpenAIQuestionGenerationProvider`
- `AnthropicQuestionGenerationProvider` opcional o ya existente.
- `MockQuestionGenerationProvider`

Si el proyecto ya usa una firma diferente, manten la convencion existente y adapta la implementacion a esa interfaz.

## Provider Factory

Crear o ajustar:

```ts
createQuestionGenerationProvider(config): QuestionGenerationProvider
```

Comportamiento:

```text
AI_PROVIDER=openai      -> OpenAIQuestionGenerationProvider
AI_PROVIDER=anthropic   -> AnthropicQuestionGenerationProvider
AI_PROVIDER=mock        -> MockQuestionGenerationProvider
sin configuracion       -> Mock o error controlado segun entorno
```

Para desarrollo local puede usarse mock si no hay claves.

Para produccion/beta, OpenAI debe ser el proveedor recomendado.

## Environment Variables

Actualizar `.env.example`:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
MAX_GENERATION_INPUT_CHARS=20000
MAX_GENERATED_QUESTIONS=20
```

Reglas:

- No hardcodees claves.
- No subas `.env`.
- No pongas claves reales en documentacion.
- Si `AI_PROVIDER=openai` y falta `OPENAI_API_KEY`, devolver error claro.
- Si `AI_PROVIDER=anthropic` y falta su key, devolver error claro.
- Tests deben poder ejecutarse con `AI_PROVIDER=mock`.

Si ya existen variables antiguas como `AI_API_KEY` o `AI_MODEL`, puedes mantener compatibilidad temporal, pero la documentacion nueva debe recomendar `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL`.

## OpenAI Provider

Implementa `OpenAIQuestionGenerationProvider`.

Debe:

- Usar API oficial de OpenAI.
- Usar salida estructurada compatible con JSON/schema cuando sea posible.
- Ser configurable por `OPENAI_MODEL`.
- No fijar un modelo unico dentro del codigo como unica opcion.
- No hardcodear API keys.
- No guardar preguntas directamente.
- Devolver candidatos al servicio de generacion existente.
- Permitir tests con `fetch` o cliente inyectable.

Claude debe consultar la documentacion oficial actual de OpenAI al implementar el proveedor real y adaptar el request al API vigente del SDK o endpoint usado.

## Structured Output

La salida de OpenAI debe mapear a un candidato compatible con TESTOPO:

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
  warnings?: string[]
}
```

Si el dominio actual usa `snake_case`, mapear correctamente.

Validaciones obligatorias:

- Al menos dos opciones.
- Exactamente una opcion correcta.
- Explicacion obligatoria.
- Fuente o fragmento obligatorio.
- Dificultad valida.
- No aceptar campos incompletos.
- No guardar respuestas sin validar estructura.

## Prompt

Crear o adaptar:

```text
/prompts/question-generator-openai.md
```

Debe incluir:

```text
# TESTOPO OpenAI Question Generator Prompt

Eres un generador de preguntas tipo test para oposiciones.

Reglas obligatorias:
1. Usa unicamente el material proporcionado.
2. No inventes informacion externa.
3. Cada pregunta debe tener una unica respuesta correcta.
4. Cada pregunta debe incluir explicacion.
5. Cada pregunta debe indicar fuente o fragmento usado.
6. No generes preguntas ambiguas.
7. No generes preguntas de opinion.
8. No generes preguntas sin base textual.
9. No marques ninguna pregunta como validada.
10. Si no hay suficiente material, devuelve menos preguntas.

Devuelve unicamente datos compatibles con el schema esperado por TESTOPO.
```

## Required Flow

El flujo obligatorio es:

```text
OpenAI genera salida
  -> Parser valida estructura
  -> Validador TESTOPO revisa reglas criticas
  -> Pregunta se guarda como pending_review o needs_fix
  -> Admin revisa
  -> Solo admin puede aprobar
```

Nunca:

```text
OpenAI genera salida
  -> Pregunta validated
```

## Anthropic Fallback

Anthropic puede quedar como alternativa.

Uso:

```text
AI_PROVIDER=anthropic
```

Pero:

- No debe ser obligatorio.
- No debe bloquear OpenAI.
- No debe ser requerido para tests.
- Si no hay configuracion, debe fallar con error claro.

Si ya existe `AnthropicQuestionGenerationProvider`, adaptalo al nuevo esquema de variables si procede.

## Mock Provider

Mantener `MockQuestionGenerationProvider`.

Debe servir para:

- Tests automaticos.
- Desarrollo local sin coste.
- Demos sin llamadas externas.
- CI sin dependencias externas.

El mock debe devolver preguntas realistas pero claramente ficticias.

## Errors

Errores recomendados:

- `AI_PROVIDER_NOT_CONFIGURED`
- `AI_PROVIDER_INVALID`
- `OPENAI_API_KEY_MISSING`
- `OPENAI_GENERATION_FAILED`
- `OPENAI_INVALID_RESPONSE`
- `OPENAI_EMPTY_RESPONSE`
- `AI_OUTPUT_SCHEMA_INVALID`
- `AI_GENERATED_TOO_FEW_QUESTIONS`
- `AI_GENERATED_QUESTION_INVALID`

Mensajes visibles recomendados:

- No se ha podido generar preguntas porque el proveedor de IA no esta configurado.
- La IA ha devuelto una respuesta incompleta. No se han guardado preguntas invalidas.
- Se han generado preguntas pendientes de revision.

## Documentation

Actualizar o crear:

```text
/docs/setup/ai-provider-setup.md
```

Debe explicar:

- Como elegir proveedor IA.
- Como configurar OpenAI.
- Como usar mock.
- Como configurar Anthropic si se implementa.
- Que variables de entorno existen.
- Que proveedor se recomienda para beta.
- Que las preguntas generadas requieren revision humana.

Debe dejar claro:

- OpenAI genera preguntas candidatas.
- OpenAI no valida preguntas.
- La revision humana sigue siendo obligatoria.

## Required Tests

Deben existir tests para:

- `AI_PROVIDER=openai` selecciona `OpenAIQuestionGenerationProvider`.
- `AI_PROVIDER=mock` selecciona `MockQuestionGenerationProvider`.
- `AI_PROVIDER=anthropic` sigue siendo opcional/configurable si existe.
- Proveedor no valido devuelve error controlado.
- Si falta `OPENAI_API_KEY`, falla de forma clara.
- OpenAI provider no guarda preguntas directamente.
- La salida incompleta se rechaza.
- Una pregunta con varias opciones correctas se rechaza o queda `needs_fix`.
- Una pregunta sin fuente se rechaza o queda `needs_fix`.
- Una pregunta sin explicacion se rechaza o queda `needs_fix`.
- Una respuesta correcta genera `pending_review`, nunca `validated`.
- Tests pueden ejecutarse sin llamar a OpenAI usando mock.
- Las claves no aparecen hardcodeadas en codigo.

Ejecuta tambien tests/build existentes.

## PR Expectations

En la descripcion del PR incluye:

- Resumen de OpenAI como proveedor principal.
- Variables de entorno necesarias, sin valores reales.
- Estado de Anthropic como fallback.
- Confirmacion de que mock sigue funcionando.
- Confirmacion de que no hay claves hardcodeadas.
- Confirmacion de que ninguna pregunta generada nace como `validated`.
- Confirmacion de que no se implemento fine-tuning, embeddings ni RAG avanzado.
- Tests/checks ejecutados.

## Acceptance Criteria

- OpenAI queda como proveedor principal configurable.
- Existe `OpenAIQuestionGenerationProvider`.
- El codigo usa `QuestionGenerationProvider`, no OpenAI directamente.
- Existe factory de proveedor IA.
- Mock sigue funcionando.
- Anthropic queda opcional o preparado.
- `.env.example` esta actualizado.
- Hay documentacion de configuracion IA.
- No hay claves hardcodeadas.
- La salida de OpenAI se valida estructuralmente.
- Las preguntas generadas nunca nacen como `validated`.
- Los tests siguen usando solo preguntas validadas.
- Los tests automaticos no dependen de llamadas reales a OpenAI.
- No se implementa fine-tuning.
- No se implementa RAG avanzado.
- No se implementan embeddings.

