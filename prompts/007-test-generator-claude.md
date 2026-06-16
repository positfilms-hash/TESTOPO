# Claude Prompt - SPEC 007 Test Generator

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.

La SPEC 006 permite aprobar preguntas mediante revision humana. Esta SPEC 007 debe usar esas preguntas aprobadas para crear tests de practica.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/007-test-generator.md
```

Branch de trabajo:

```text
feature/test-generator
```

## Critical Rule

Un test normal solo puede contener preguntas en estado `validated`.

Nunca incluyas preguntas con estado:

- `draft`
- `pending_review`
- `needs_fix`
- `rejected`
- `obsolete`

Esta regla es la barrera de calidad entre revision humana y practica del usuario.

## Scope

Implementa el generador basico de tests:

- Modelo de test.
- Modelo de pregunta dentro de test.
- Creacion de test aleatorio global.
- Creacion de test por tema.
- Creacion de test por dificultad.
- Creacion de test mixto.
- Seleccion aleatoria de preguntas.
- Filtro por numero de preguntas.
- Filtro por `topic_id`.
- Filtro por `difficulty`.
- Filtro mixto por tema y dificultad.
- Exclusion de preguntas no validadas.
- Exclusion de preguntas obsoletas o vinculadas a fuente/material/tema obsoleto.
- Validacion de numero de preguntas.
- Validacion de tema y dificultad.
- Consulta de test generado.
- Cancelacion de test.
- Tests automaticos de reglas criticas.

## Existing Integration Requirements

Conecta con:

- SPEC 001: reutiliza el banco de preguntas y el modelo `Question`.
- SPEC 003: reutiliza `Topic`; si se filtra por `topic_id`, el tema debe existir y no estar `obsolete`.
- SPEC 006: solo preguntas que pasaron revision humana y estan `validated` pueden entrar en tests.

Tambien respeta:

- SPEC 002: si la pregunta tiene fuente/material obsoleto, excluirla.
- SPEC 004: preguntas generadas en `draft` o `pending_review` no pueden entrar.
- SPEC 005: preguntas en `needs_fix` no pueden entrar.

No dupliques modelos de pregunta.

No alteres estados de preguntas para meterlas en tests.

No rompas tests existentes de SPEC 001 a SPEC 006.

## Test Model

Crea un modelo llamado `Test`, `PracticeTest` o similar.

Campos minimos:

- `id`
- `title`
- `mode`
- `status`
- `question_count`
- `filters`
- `created_at`
- `updated_at`

Modos permitidos:

- `random`
- `by_topic`
- `by_difficulty`
- `mixed`

Estados permitidos:

- `created`
- `in_progress`
- `completed`
- `cancelled`

Estado inicial recomendado:

- `created`

`filters` debe guardar:

- `topic_id`
- `difficulty`
- `question_count`
- `random_seed`

## Test Question Model

Crea un modelo llamado `TestQuestion`, `PracticeTestQuestion` o similar.

Campos minimos:

- `id`
- `test_id`
- `question_id`
- `order`
- `options_order`
- `created_at`

`question_id` siempre debe apuntar a una pregunta `validated`.

Si aleatorizar `options_order` complica demasiado, dejalo documentado para una spec futura.

## Generator Input

Debe aceptar:

- `question_count`
- `topic_id`
- `difficulty`
- `mode`

Reglas:

- `question_count` por defecto: 20.
- Minimo: 1.
- Maximo: 100.
- `topic_id` es opcional, pero si existe debe apuntar a un tema existente y no `obsolete`.
- `difficulty` puede ser `easy`, `medium`, `hard` o `mixed`.
- `mode` puede ser `random`, `by_topic`, `by_difficulty` o `mixed`.

## Business Rules

- Seleccionar solo preguntas `validated`.
- Excluir preguntas con fuente `obsolete`.
- Excluir preguntas vinculadas a material `obsolete`, si existe relacion.
- Excluir preguntas vinculadas a tema `obsolete`, si existe relacion.
- Si no hay suficientes preguntas para cumplir filtros, devolver error y no crear test parcial.
- No duplicar preguntas dentro del mismo test.
- Seleccionar preguntas aleatoriamente.
- Guardar `random_seed` en filtros si se usa.
- Si `difficulty` es `mixed`, intentar distribucion simple:
  - `easy`: 40%
  - `medium`: 40%
  - `hard`: 20%
- Si no hay suficientes preguntas de una dificultad para `mixed`, puede completar con otras dificultades disponibles, pero debe reflejarlo en metadatos/filtros si se implementa.

## Required Operations

### Create Global Random Test

Entrada:

- `question_count`

Selecciona preguntas validadas de todo el banco.

### Create Test By Topic

Entrada:

- `question_count`
- `topic_id`

Selecciona preguntas validadas asociadas a ese tema.

### Create Test By Difficulty

Entrada:

- `question_count`
- `difficulty`

Selecciona preguntas validadas de esa dificultad.

### Create Mixed Test

Entrada:

- `question_count`
- `topic_id`
- `difficulty`

Permite combinar filtros.

### Get Test

Debe recuperar un test por ID con sus preguntas.

Para esta spec puede mostrar:

- Enunciado.
- Opciones.
- Orden.
- Tema.
- Dificultad.

Importante: si existe separacion entre modo alumno y modo revision, no exponer respuesta correcta en modo alumno. Si no existe todavia, documenta que no debe mostrarse durante la realizacion del test.

### Cancel Test

Debe marcar el test como:

- `cancelled`

No debe borrar preguntas ni banco.

## Validation Errors

Usa errores claros. Codigos recomendados:

- `TEST_QUESTION_COUNT_REQUIRED`
- `TEST_INVALID_QUESTION_COUNT`
- `TEST_MAX_QUESTION_COUNT_EXCEEDED`
- `TEST_TOPIC_NOT_FOUND`
- `TEST_TOPIC_OBSOLETE`
- `TEST_INVALID_DIFFICULTY`
- `TEST_INVALID_MODE`
- `TEST_NOT_ENOUGH_VALIDATED_QUESTIONS`
- `TEST_DUPLICATE_QUESTION_NOT_ALLOWED`
- `TEST_ONLY_VALIDATED_QUESTIONS_ALLOWED`

## Out of Scope

No implementes:

- Correccion completa de respuestas.
- Resultados avanzados.
- Estadisticas del usuario.
- Historial complejo.
- Simulacros oficiales con penalizacion.
- Temporizador.
- Usuarios y autenticacion.
- Ranking.
- Recomendaciones inteligentes.
- Repaso de fallos.
- Repeticion espaciada.
- Frontend avanzado.
- Pagos.
- Gamificacion.

La correccion de respuestas y resultados detallados vendran en SPEC 008.

## Required Tests

Incluye tests automaticos para comprobar:

- Se puede crear un test aleatorio con preguntas validadas.
- No se puede crear un test con preguntas no validadas.
- No se incluyen preguntas `draft`.
- No se incluyen preguntas `pending_review`.
- No se incluyen preguntas `needs_fix`.
- No se incluyen preguntas `rejected`.
- No se incluyen preguntas `obsolete`.
- No se incluyen preguntas con fuente obsoleta, si existe relacion.
- No se incluyen preguntas con material obsoleto, si existe relacion.
- No se incluyen preguntas con tema obsoleto, si existe relacion.
- No se puede crear un test con `question_count` menor que 1.
- No se puede crear un test con `question_count` mayor que 100.
- No se puede crear un test si no hay suficientes preguntas validadas.
- Se puede crear un test filtrando por tema.
- Se puede crear un test filtrando por dificultad.
- Se puede crear un test con dificultad `mixed`.
- Un test no contiene preguntas duplicadas.
- Se puede consultar un test generado.
- Se puede cancelar un test.
- No se rompen los tests existentes de SPEC 001 a SPEC 006.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar tests.
- Confirmacion de que solo se usan preguntas `validated`.
- Confirmacion de que se excluyen `draft`, `pending_review`, `needs_fix`, `rejected` y `obsolete`.
- Confirmacion de conexion con SPEC 001, SPEC 003 y SPEC 006.
- Confirmacion de que no se implemento correccion de respuestas, resultados avanzados, estadisticas, simulacros, temporizador, usuarios, autenticacion ni frontend avanzado.
- Confirmacion de que no se rompen tests existentes.
