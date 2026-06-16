# Claude Prompt - SPEC 008 Test Taking & Results

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.
- SPEC 007 - Test Generator.

La SPEC 007 genera tests usando solo preguntas `validated`. Esta SPEC 008 debe permitir realizar esos tests, guardar respuestas, enviar el intento, obtener resultado y revisar explicaciones.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/008-test-taking-results.md
```

Branch de trabajo:

```text
feature/user-results
```

## Critical Rule

Antes de enviar el test, nunca debe mostrarse:

- `correct_answer`
- `is_correct`
- explicacion de la respuesta correcta
- `correct_option_id`
- cualquier campo que revele cual opcion es correcta

Despues de enviar el test, el usuario debe poder ver:

- Resultado.
- Respuesta correcta.
- Si su seleccion fue correcta.
- Explicacion por pregunta.

## Scope

Implementa el flujo minimo de realizacion y correccion de tests:

- Modelo de intento de test.
- Modelo de respuesta del usuario.
- Inicio de intento.
- Consulta de test en modo respuesta sin mostrar soluciones.
- Guardado de respuestas.
- Actualizacion de respuestas.
- Borrado de respuestas.
- Envio/finalizacion del test.
- Correccion automatica.
- Calculo de aciertos.
- Calculo de fallos.
- Calculo de preguntas no respondidas.
- Calculo de puntuacion basica.
- Consulta de resultado.
- Consulta de revision con respuesta correcta y explicacion.
- Cancelacion de intento.
- Tests automaticos de reglas criticas.

## Existing Integration Requirements

Conecta con:

- SPEC 001: usa `Question`, opciones, explicacion y respuesta correcta del banco existente.
- SPEC 007: usa tests generados, sus preguntas y orden.

Tambien respeta:

- SPEC 006: solo deberian llegar aqui tests creados con preguntas `validated`.
- SPEC 007: no dupliques el modelo de test ni preguntas dentro de test.

No rompas tests existentes de SPEC 001 a SPEC 007.

## Attempt Model

Crea un modelo llamado `TestAttempt`, `PracticeTestAttempt` o similar.

Campos minimos:

- `id`
- `test_id`
- `status`
- `started_at`
- `submitted_at`
- `score`
- `total_questions`
- `correct_count`
- `incorrect_count`
- `unanswered_count`
- `created_at`
- `updated_at`

Estados permitidos:

- `in_progress`
- `submitted`
- `cancelled`

Estado inicial recomendado:

- `in_progress`

Para MVP:

- `score = correct_count`
- `percentage = correct_count / total_questions * 100`
- Sin penalizacion por fallo.

## Answer Model

Crea un modelo llamado `TestAnswer`, `AttemptAnswer` o similar.

Campos minimos:

- `id`
- `attempt_id`
- `test_question_id`
- `question_id`
- `selected_option_id`
- `is_correct`
- `answered_at`
- `created_at`
- `updated_at`

Reglas:

- `selected_option_id` puede estar vacio si la pregunta no se responde.
- `is_correct` se calcula al enviar.
- Mientras el intento esta `in_progress`, `is_correct` puede estar vacio o no calculado.
- Responder de nuevo a la misma pregunta actualiza la respuesta previa; no duplica registros.

## Required Operations

### Start Attempt

Entrada:

- `test_id`

Debe crear un intento en estado `in_progress`.

No se puede iniciar sobre test inexistente o cancelado.

### Get Test For Taking

Debe devolver el test con preguntas y opciones, sin mostrar soluciones.

Debe incluir:

- `attempt_id`
- `test_id`
- preguntas
- opciones
- orden de preguntas
- dificultad
- tema

No debe incluir:

- opcion correcta
- `correct_answer`
- `is_correct`
- explicacion
- resultado

### Save Answer

Entrada:

- `attempt_id`
- `test_question_id`
- `selected_option_id`

Debe guardar o actualizar la respuesta.

Validar:

- El intento existe.
- El intento esta `in_progress`.
- La pregunta pertenece al test del intento.
- La opcion pertenece a esa pregunta.

### Clear Answer

Entrada:

- `attempt_id`
- `test_question_id`

Debe dejar la pregunta como no respondida.

### Submit Attempt

Entrada:

- `attempt_id`

Debe:

- Corregir cada respuesta.
- Marcar no respondidas.
- Calcular `correct_count`.
- Calcular `incorrect_count`.
- Calcular `unanswered_count`.
- Calcular `score`.
- Calcular `percentage` si se incluye.
- Cambiar estado a `submitted`.
- Guardar `submitted_at`.

No se puede enviar dos veces ni enviar intento cancelado.

### Get Result

Debe devolver:

- `attempt_id`
- `test_id`
- `score`
- `percentage`
- `total_questions`
- `correct_count`
- `incorrect_count`
- `unanswered_count`
- `submitted_at`

### Get Review

Solo disponible despues de enviar.

Debe devolver cada pregunta con:

- `statement`
- `options`
- `selected_option_id`
- `correct_option_id`
- `is_correct`
- `explanation`
- `topic`
- `difficulty`
- `source_reference`

### Cancel Attempt

Debe cancelar un intento en progreso.

## Validation Errors

Usa errores claros. Codigos recomendados:

- `TEST_NOT_FOUND`
- `TEST_CANCELLED_CANNOT_BE_STARTED`
- `TEST_ATTEMPT_NOT_FOUND`
- `TEST_ATTEMPT_ALREADY_SUBMITTED`
- `TEST_ATTEMPT_CANCELLED`
- `QUESTION_NOT_IN_TEST`
- `OPTION_NOT_IN_QUESTION`
- `TEST_ATTEMPT_REVIEW_NOT_AVAILABLE`
- `TEST_ATTEMPT_INVALID_STATUS`

## Out of Scope

No implementes:

- Usuarios y autenticacion completa.
- Historial avanzado por usuario.
- Estadisticas acumuladas.
- Recomendaciones de estudio.
- Repaso inteligente de fallos.
- Repeticion espaciada.
- Temporizador obligatorio.
- Penalizacion configurable por error.
- Simulacros oficiales complejos.
- Ranking.
- Gamificacion.
- Certificados.
- Frontend visual avanzado.
- Pagos.

Si no hay usuarios, el intento puede existir sin `user_id`.

## Required Tests

Incluye tests automaticos para comprobar:

- Se puede iniciar un intento de test.
- No se puede iniciar intento sobre test inexistente.
- No se puede iniciar intento sobre test cancelado.
- La vista de test en progreso no muestra respuesta correcta.
- La vista de test en progreso no muestra explicacion.
- Se puede guardar una respuesta.
- Se puede actualizar una respuesta.
- Actualizar respuesta no duplica registros.
- Se puede borrar una respuesta.
- No se puede responder una pregunta que no pertenece al test.
- No se puede seleccionar una opcion que no pertenece a la pregunta.
- No se puede modificar respuesta despues de enviar.
- Se puede enviar un test.
- Al enviar, se calculan aciertos correctamente.
- Al enviar, se calculan fallos correctamente.
- Al enviar, se calculan preguntas no respondidas correctamente.
- Al enviar, se calcula puntuacion simple.
- No se puede enviar dos veces el mismo intento.
- No se puede enviar un intento cancelado.
- Se puede consultar resultado despues de enviar.
- Se puede consultar revision despues de enviar.
- La revision muestra respuesta correcta y explicacion.
- No se puede consultar revision antes de enviar.
- Se puede cancelar un intento en progreso.
- No se rompen los tests existentes de SPEC 001 a SPEC 007.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar tests.
- Confirmacion de que antes de enviar no se muestra respuesta correcta, `is_correct`, `correct_option_id` ni explicacion.
- Confirmacion de que despues de enviar se muestra resultado, respuesta correcta y explicacion por pregunta.
- Confirmacion de conexion con SPEC 001 y SPEC 007.
- Confirmacion de que no se implemento usuarios/autenticacion, estadisticas avanzadas, recomendaciones, temporizador, penalizacion, simulacros, ranking, gamificacion, frontend avanzado ni pagos.
- Confirmacion de que no se rompen tests existentes.
