# Claude Prompt - SPEC 004 Question Generation Drafts

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.

La SPEC 001 define el modelo de pregunta, estados y validacion. La SPEC 002 define `Material` como fuente trazable. La SPEC 003 define `Topic` para clasificar materiales y preguntas.

Esta SPEC 004 debe generar candidatos de preguntas desde material registrado, fragmentos o texto manual.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/004-question-generation.md
```

Branch de trabajo:

```text
feature/question-generation
```

## Critical Rule

Ninguna pregunta generada puede quedar directamente como `validated`.

Las preguntas generadas deben quedar siempre en:

- `draft`
- `pending_review`

Estado recomendado para generacion automatica:

- `pending_review`

Si no hay `topic_id` y solo hay referencia textual o manual, debe quedar en `draft`, no en `pending_review`.

## Scope

Implementa:

- Servicio o modulo de generacion de preguntas.
- Entrada basada en `material_id`.
- Entrada basada en `topic_id`.
- Entrada desde fragmento.
- Entrada desde texto manual, si encaja con el stack actual.
- Seleccion de `difficulty`.
- Seleccion y limite de `question_count`.
- Validacion formal basica antes de guardar.
- Guardado de preguntas generadas en el banco de preguntas existente.
- Vinculacion con `Material` como fuente.
- Vinculacion con `Topic` si existe.
- Explicacion obligatoria.
- Registro de `reference` o `excerpt`.
- Metadatos de generacion.
- Prompt base en `/prompts/question-generator.md`.
- Tests automaticos de reglas criticas.

## Existing Integration Requirements

Usa los modelos y servicios existentes. No dupliques el modelo de pregunta.

Conecta con:

- SPEC 001: usa el modelo `Question`, `QuestionService` y validacion formal existente cuando sea posible.
- SPEC 002: exige que `material_id` exista y que el material no este `obsolete`.
- SPEC 003: si se proporciona `topic_id`, exige que exista y que el tema no este `obsolete`.

Antes o durante esta implementacion, corrige los riesgos recomendados detectados en revision:

- Si `source.material_id` existe, no debe poder validarse una pregunta cuando el material no pueda resolverse o este `obsolete`.
- Si `topic_id` existe, no debe poder validarse una pregunta cuando el tema no pueda resolverse o este `obsolete`.
- `validateQuestion` debe comprobar que `correct_answer` coincide con la unica opcion marcada como correcta.
- `TopicService.linkMaterial` no debe permitir vincular material inexistente.

Mantener estos puntos es importante porque SPEC 004 depende directamente de trazabilidad fuerte.

## Generator Input

El generador debe aceptar:

- `material_id`
- `topic_id`
- `difficulty`
- `question_count`
- `reference`
- `generation_mode`

Valores permitidos de `difficulty`:

- `easy`
- `medium`
- `hard`
- `mixed`

Si `difficulty` es `mixed`, usa una distribucion simple y documentada. Para MVP puede ser:

- `easy`: 40%
- `medium`: 40%
- `hard`: 20%

Limites de `question_count`:

- minimo: 1
- maximo: 20

Valores permitidos de `generation_mode`:

- `from_material_text`
- `from_material_excerpt`
- `manual_seed`

## Generated Question Requirements

Cada pregunta generada debe incluir:

- `statement`
- `options`
- `correct_answer`
- `explanation`
- `source`
- `topic`
- `difficulty`
- `status`
- `generation_metadata`

Reglas:

- Debe ser pregunta tipo test de respuesta unica.
- Preferiblemente 4 opciones.
- Minimo 2 opciones.
- Exactamente una opcion correcta.
- Explicacion obligatoria.
- Fuente obligatoria.
- La fuente debe incluir `material_id`, `title`, `type`, `reference`, `excerpt` y `status` cuando aplique.
- Si se proporciona `topic_id`, la pregunta debe quedar vinculada a ese tema.
- No guardar claves privadas, tokens ni datos sensibles en `generation_metadata`.

## Out of Scope

No implementes:

- Validacion automatica avanzada de verdad juridica.
- Revision humana visual avanzada.
- Panel complejo de administracion.
- Simulacros de examen.
- Generacion de tests finales.
- Estadisticas avanzadas.
- Estadisticas de dificultad real.
- Recomendaciones de estudio.
- OCR.
- Extraccion avanzada de PDF o DOCX.
- Procesamiento avanzado de PDF o DOCX.
- Comparacion automatica entre normas.
- Correccion automatica de temario obsoleto.
- Publicacion automatica de preguntas validadas.
- Multiples tipos de pregunta.
- Preguntas multirrespuesta.
- Integracion real con proveedor externo de IA si no existe ya.

## Provider Design

Si no hay integracion real de IA, crea una interfaz desacoplada, por ejemplo:

- `QuestionGenerationProvider`

Para el MVP, es aceptable:

- Mock provider.
- Funcion de generacion simulada.
- Interfaz preparada.
- Prompt base documentado.

No guardes tokens ni claves. No hagas llamadas externas si no existe infraestructura ya definida.

## Business Rules

- La IA o proveedor solo propone candidatos.
- No hay validacion automatica final.
- No se puede generar desde material inexistente.
- No se puede generar desde material `obsolete`.
- No se puede generar desde tema inexistente si se proporciona `topic_id`.
- No se puede generar desde tema `obsolete`.
- No se puede generar desde material sin `content_text` salvo que se proporcione fragmento.
- No se puede generar mas de 20 preguntas por solicitud.
- No se puede guardar pregunta generada sin fuente.
- No se puede guardar pregunta generada sin explicacion.
- Antes de guardar, cada candidato debe pasar validacion formal basica.
- No se deben guardar duplicados exactos de `statement` normalizado.
- Las preguntas generadas deben guardarse en el banco de preguntas existente.

## Validation Errors

Usa errores claros. Codigos recomendados:

- `QUESTION_GENERATION_MATERIAL_REQUIRED`
- `QUESTION_GENERATION_MATERIAL_NOT_FOUND`
- `QUESTION_GENERATION_MATERIAL_OBSOLETE`
- `QUESTION_GENERATION_TOPIC_NOT_FOUND`
- `QUESTION_GENERATION_TOPIC_OBSOLETE`
- `QUESTION_GENERATION_CONTENT_REQUIRED`
- `QUESTION_GENERATION_INVALID_DIFFICULTY`
- `QUESTION_GENERATION_INVALID_COUNT`
- `QUESTION_GENERATION_MAX_COUNT_EXCEEDED`
- `QUESTION_GENERATION_INVALID_MODE`
- `QUESTION_GENERATION_EMPTY_RESULT`
- `QUESTION_GENERATION_INVALID_OUTPUT`
- `QUESTION_GENERATION_DUPLICATE_STATEMENT`
- `QUESTION_GENERATION_SOURCE_REQUIRED`
- `QUESTION_GENERATION_EXPLANATION_REQUIRED`

## Required Operations

Implementa:

### Generate From Material

Entrada:

- `material_id`
- `topic_id`
- `difficulty`
- `question_count`

Debe usar `content_text` del material. Si no hay `content_text`, devolver error.

### Generate From Excerpt

Entrada:

- `material_id`
- `topic_id`
- `excerpt`
- `difficulty`
- `question_count`

Debe guardar el fragmento en `source.excerpt`.

### Generate From Manual Text

Entrada:

- `manual_text`
- `topic_id`
- `difficulty`
- `question_count`
- `reference`

Debe crear preguntas en `draft`, salvo que haya material asociado. Si no hay material asociado, la fuente debe marcarse claramente como manual o temporal.

### Save Generated Questions

Usa el modelo del banco de preguntas de SPEC 001. No crees un segundo modelo paralelo.

### Generation History

Si es sencillo, registra historial basico:

- `QuestionGenerationRun`
- `id`
- `material_id`
- `topic_id`
- `mode`
- `requested_count`
- `created_count`
- `status`
- `errors`
- `created_at`

No compliques el MVP por este historial.

## Prompt File

Crea o actualiza:

```text
/prompts/question-generator.md
```

Debe dejar claro:

- Generar solo desde material proporcionado.
- No usar conocimiento externo.
- Exactamente una respuesta correcta.
- Explicacion obligatoria.
- Citar fuente, referencia o fragmento.
- Evitar ambiguedad.
- Evitar duplicados.
- Usar dificultad solicitada.
- Salida estructurada y machine-readable.
- Las preguntas son borradores, no validadas automaticamente.

## Required Tests

Incluye tests automaticos para comprobar:

- No se puede generar sin `material_id`, salvo modo `manual_seed`.
- No se puede generar desde material inexistente.
- No se puede generar desde material `obsolete`.
- No se puede generar desde material sin texto ni fragmento.
- No se puede generar con dificultad invalida.
- No se puede generar con `question_count` menor que 1.
- No se puede generar con `question_count` mayor que 20.
- Las preguntas generadas quedan en `draft` o `pending_review`.
- Las preguntas generadas nunca quedan en `validated`.
- Las preguntas generadas tienen fuente.
- Las preguntas generadas tienen explicacion.
- Las preguntas generadas tienen exactamente una respuesta correcta.
- Las preguntas generadas se guardan en el banco de preguntas existente.
- No se guardan preguntas con enunciado duplicado exacto.
- No se rompen los tests existentes de SPEC 001, SPEC 002 y SPEC 003.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar tests.
- Confirmacion de que no se implemento validacion automatica avanzada, revision humana avanzada, generacion de tests finales, simulacros, estadisticas avanzadas, OCR, procesamiento avanzado de documentos, preguntas multirrespuesta ni publicacion automatica.
- Confirmacion de que toda pregunta generada queda en `draft` o `pending_review`, nunca en `validated`.
- Confirmacion de conexion con Question Bank, Material Registry y Topic Map.
- Confirmacion de que no se rompen tests existentes.
