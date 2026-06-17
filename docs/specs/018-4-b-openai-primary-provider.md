# SPEC 018.4-B - OpenAI as Primary AI Provider

## 1. Objetivo

Ajustar la SPEC 018.4 para definir OpenAI como proveedor principal de generacion de preguntas tipo test en TESTOPO.

La app debe mantener una arquitectura desacoplada por proveedor, pero la configuracion recomendada por defecto sera:

- Proveedor principal: OpenAI.
- Proveedor alternativo: Anthropic.
- Proveedor de tests: Mock.

Esta mini spec no cambia el principio central del producto:

```text
Una pregunta generada por IA nunca es valida automaticamente.
```

## 2. Contexto

La SPEC 018.4 anadio:

```text
QuestionGenerationProvider
  -> Generacion de preguntas desde material
  -> Validacion automatica
  -> Revision humana
  -> Pool validado
```

Esta mini spec concreta que proveedor debe usarse principalmente para la generacion real.

## 3. Decision De Producto

Usar OpenAI como proveedor principal para:

- Generar preguntas tipo test.
- Devolver salida estructurada.
- Crear opciones.
- Indicar respuesta correcta.
- Generar explicacion.
- Incluir fuente o fragmento.
- Anadir warnings si detecta problemas.
- Clasificar dificultad inicial.

Anthropic/Claude puede mantenerse como proveedor alternativo configurable.

## 4. Branch

```text
feature/openai-primary-ai-provider
```

## 5. Principio Central

El proveedor de IA no cambia las reglas de calidad.

Aunque la pregunta venga de OpenAI:

- Nunca puede nacer como `validated`.
- Siempre debe pasar por validacion interna.
- Siempre debe quedar pendiente de revision humana si es formalmente aceptable.
- Solo una accion humana explicita puede aprobarla.

Estados permitidos para preguntas generadas:

- `draft`
- `pending_review`
- `needs_fix`

Estado prohibido:

- `validated`

## 6. Alcance

Claude debe implementar o ajustar:

- `OpenAIQuestionGenerationProvider`.
- Configuracion `AI_PROVIDER=openai`.
- Variables de entorno para OpenAI.
- Mantener proveedor Anthropic opcional si ya existe o dejar interfaz preparada.
- Mantener proveedor mock para tests.
- Adaptar factory de proveedores IA.
- Adaptar tests.
- Actualizar `.env.example`.
- Actualizar documentacion de IA.
- Asegurar que la salida se valida contra el modelo interno de pregunta.

## 7. Fuera De Alcance

No implementar:

- Fine-tuning.
- Entrenamiento propio.
- RAG avanzado.
- Embeddings.
- Indexacion vectorial.
- Generacion directa de tests para estudiantes.
- Validacion automatica definitiva.
- Sustitucion de revision humana.
- Cambio de proveedor de desarrollo de codigo.
- Migraciones Supabase.
- Pagos.
- OAuth.
- Funciones fuera de IA de preguntas.

## 8. Arquitectura De Proveedores

Mantener una interfaz comun:

```ts
interface QuestionGenerationProvider {
  generateQuestions(input: QuestionGenerationInput): Promise<QuestionGenerationOutput>
}
```

Si el proyecto ya usa una firma equivalente, mantener la convencion existente y adaptar esta spec a esa interfaz.

Implementaciones recomendadas:

- `OpenAIQuestionGenerationProvider`
- `AnthropicQuestionGenerationProvider`
- `MockQuestionGenerationProvider`

El codigo de dominio no debe depender directamente de OpenAI ni de Anthropic.

Debe depender solo de:

```ts
QuestionGenerationProvider
```

## 9. Factory De Proveedor IA

Crear o ajustar un factory:

```ts
createQuestionGenerationProvider(config): QuestionGenerationProvider
```

Comportamiento esperado:

```text
AI_PROVIDER=openai      -> OpenAIQuestionGenerationProvider
AI_PROVIDER=anthropic   -> AnthropicQuestionGenerationProvider
AI_PROVIDER=mock        -> MockQuestionGenerationProvider
sin configuracion       -> Mock o error controlado segun entorno
```

Para desarrollo local, puede usarse mock si no hay claves.

Para produccion/beta, debe usarse OpenAI salvo decision explicita.

## 10. Variables De Entorno

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

- No hardcodear claves.
- No subir `.env`.
- No poner claves reales en documentacion.
- Si falta `OPENAI_API_KEY` y `AI_PROVIDER=openai`, mostrar error claro.
- Tests deben poder ejecutarse con `AI_PROVIDER=mock`.

## 11. Modelo Recomendado Para OpenAI

El modelo exacto debe quedar configurable mediante:

```text
OPENAI_MODEL=
```

No fijar el modelo dentro del codigo como unica opcion.

Puede haber un valor recomendado en `.env.example`, pero sin bloquear la arquitectura.

Claude debe consultar la documentacion oficial actual de OpenAI al implementar el proveedor real y elegir una API compatible con salida estructurada.

## 12. Salida Estructurada

El proveedor OpenAI debe intentar devolver una salida estructurada compatible con el modelo interno:

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

Si el dominio actual usa nombres snake_case o una forma distinta, el parser debe mapear la respuesta de OpenAI al modelo interno sin perder:

- Enunciado.
- Opciones.
- Unica respuesta correcta.
- Explicacion.
- Fuente o fragmento.
- Dificultad.
- Warnings.

Reglas:

- Debe haber al menos dos opciones.
- Debe haber exactamente una opcion correcta.
- Debe haber explicacion.
- Debe haber fuente o fragmento.
- La dificultad debe ser valida.
- No aceptar campos incompletos.
- No guardar respuestas sin validar estructura.

## 13. Prompt OpenAI

Crear o adaptar:

```text
/prompts/question-generator-openai.md
```

Puede reutilizar el prompt general de la SPEC 018.4, pero debe estar optimizado para salida estructurada.

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

## 14. Validacion Posterior

Toda respuesta de OpenAI debe pasar por validacion interna.

Flujo obligatorio:

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

## 15. Anthropic Como Fallback

Anthropic puede quedar como alternativa.

Uso esperado:

```text
AI_PROVIDER=anthropic
```

Pero no debe ser obligatorio para que la app funcione.

Si no se implementa todavia el proveedor Anthropic real, dejar:

- Interfaz preparada.
- Error claro si se selecciona sin configuracion.
- Mock operativo para tests.

Si ya existe proveedor Anthropic, adaptarlo al nuevo esquema de variables:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`

Puede mantenerse compatibilidad temporal con variables antiguas si ya existen, pero la documentacion debe apuntar al nuevo esquema.

## 16. Mock Provider

El proveedor mock debe mantenerse.

Debe servir para:

- Tests automaticos.
- Desarrollo local sin coste.
- Demostraciones sin llamadas externas.
- Evitar que CI dependa de APIs externas.

El mock debe devolver preguntas realistas pero claramente ficticias.

## 17. Manejo De Errores

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

## 18. Tests Obligatorios

Deben existir tests para comprobar:

- `AI_PROVIDER=openai` selecciona `OpenAIQuestionGenerationProvider`.
- `AI_PROVIDER=mock` selecciona `MockQuestionGenerationProvider`.
- Proveedor no valido devuelve error controlado.
- Si falta `OPENAI_API_KEY`, falla de forma clara.
- OpenAI provider no guarda preguntas directamente.
- La salida incompleta se rechaza.
- Una pregunta con varias opciones correctas se rechaza o queda `needs_fix`.
- Una pregunta sin fuente se rechaza o queda `needs_fix`.
- Una pregunta sin explicacion se rechaza o queda `needs_fix`.
- Una respuesta correcta genera `pending_review`, nunca `validated`.
- Los tests pueden ejecutarse sin llamar a OpenAI usando mock.
- Las claves no aparecen hardcodeadas en codigo.

## 19. Documentacion

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

## 20. Criterios De Aceptacion

La tarea se considera completada cuando:

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

