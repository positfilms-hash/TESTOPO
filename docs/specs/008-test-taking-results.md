# SPEC 008 - Test Taking & Results

## 1. Objetivo

Crear el modulo basico para realizar tests y obtener resultados en TESTOPO.

Este modulo debe permitir que un usuario responda un test generado, envie sus respuestas y reciba una correccion con puntuacion, aciertos, fallos, preguntas sin responder y explicaciones.

El objetivo no es todavia crear estadisticas avanzadas ni personalizacion inteligente. El objetivo es cerrar el flujo minimo del MVP.

## 2. Contexto MVP

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen o deben existir:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.
- SPEC 007 - Test Generator.

La SPEC 007 permite generar tests con preguntas `validated`.

Esta SPEC 008 permite realizar esos tests y ver resultados.

Principio central:

> El usuario debe poder practicar con preguntas validadas y aprender de sus errores mediante explicaciones claras.

## 3. Branch recomendada

```text
feature/user-results
```

## 4. Alcance

Claude debe implementar el flujo minimo para hacer y corregir tests.

Debe incluir:

- Modelo de intento de test.
- Modelo de respuesta del usuario.
- Inicio de un test.
- Guardado de respuestas.
- Envio/finalizacion del test.
- Correccion automatica.
- Calculo de aciertos, fallos y no respondidas.
- Calculo de puntuacion basica.
- Consulta de resultado.
- Consulta de revision con explicaciones.
- Proteccion para no mostrar respuestas correctas antes de finalizar.
- Tests automaticos de reglas criticas.

## 5. Fuera de alcance

No debe implementarse todavia:

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

Esta spec solo cubre realizacion y correccion basica de tests.

## 6. Modelo de intento de test

Crear un modelo llamado `TestAttempt`, `PracticeTestAttempt` o similar.

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

## 7. Descripcion de campos

### id

Identificador unico del intento.

### test_id

Referencia al test generado en la SPEC 007.

### status

Estado del intento.

Valores permitidos:

- `in_progress`
- `submitted`
- `cancelled`

Estado inicial recomendado:

- `in_progress`

### started_at

Fecha y hora de inicio del intento.

### submitted_at

Fecha y hora de envio del test.

Debe estar vacio mientras el intento este `in_progress`.

### score

Puntuacion final.

Para el MVP, usar puntuacion simple:

```text
score = correct_count
```

Opcionalmente se puede anadir porcentaje:

```text
percentage = correct_count / total_questions * 100
```

No implementar penalizacion por fallo todavia.

### total_questions

Numero total de preguntas del test.

### correct_count

Numero de respuestas correctas.

### incorrect_count

Numero de respuestas incorrectas.

### unanswered_count

Numero de preguntas sin responder.

### created_at

Fecha de creacion.

### updated_at

Fecha de ultima actualizacion.

## 8. Modelo de respuesta del usuario

Crear un modelo llamado `TestAnswer`, `AttemptAnswer` o similar.

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

### attempt_id

Referencia al intento.

### test_question_id

Referencia a la pregunta dentro del test.

### question_id

Referencia a la pregunta original del banco.

### selected_option_id

Opcion seleccionada por el usuario.

Puede estar vacio si la pregunta no se responde.

### is_correct

Resultado de la respuesta.

Debe calcularse al enviar el test.

Mientras el intento este `in_progress`, puede estar vacio o no calculado.

### answered_at

Fecha y hora en que se guardo la respuesta.

## 9. Reglas de negocio

### 9.1 Solo tests existentes

No se puede iniciar un intento sobre un test inexistente.

Error recomendado:

- `TEST_NOT_FOUND`

### 9.2 Solo tests validos

No se puede iniciar un intento sobre un test cancelado.

Error recomendado:

- `TEST_CANCELLED_CANNOT_BE_STARTED`

### 9.3 No mostrar respuestas correctas antes de enviar

Mientras un intento este `in_progress`, la vista del test no debe exponer:

- `correct_answer`
- `is_correct`
- explicacion de la respuesta correcta
- cualquier campo que revele cual es la opcion correcta

La explicacion y la respuesta correcta solo deben mostrarse despues de enviar el test.

### 9.4 Guardar respuestas

El usuario debe poder guardar o actualizar una respuesta mientras el intento este `in_progress`.

Si responde de nuevo a la misma pregunta, debe actualizarse la respuesta anterior, no duplicarse.

### 9.5 No responder preguntas fuera del test

No se puede guardar una respuesta para una pregunta que no pertenece al test del intento.

Error recomendado:

- `QUESTION_NOT_IN_TEST`

### 9.6 No modificar respuestas despues de enviar

Una vez que el intento esta `submitted`, no se pueden modificar respuestas.

Error recomendado:

- `TEST_ATTEMPT_ALREADY_SUBMITTED`

### 9.7 Enviar test

Al enviar el test:

- El intento pasa a `submitted`.
- Se calcula cada respuesta como correcta o incorrecta.
- Se calculan aciertos, fallos y no respondidas.
- Se calcula la puntuacion.
- Se guarda `submitted_at`.

### 9.8 Preguntas no respondidas

Una pregunta sin `selected_option_id` debe contar como no respondida.

No debe contar como correcta ni como incorrecta.

### 9.9 Correccion simple

Para el MVP:

```text
respuesta correcta = selected_option_id coincide con la opcion marcada como correcta en la pregunta original
```

No implementar penalizacion por fallo.

### 9.10 Test ya enviado

No se puede enviar dos veces el mismo intento.

Error recomendado:

- `TEST_ATTEMPT_ALREADY_SUBMITTED`

### 9.11 Cancelar intento

Debe poder marcarse un intento como:

- `cancelled`

Un intento cancelado no debe poder enviarse.

Error recomendado:

- `TEST_ATTEMPT_CANCELLED`

## 10. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 10.1 Iniciar intento de test

Entrada:

- `test_id`

Debe crear un `TestAttempt` en estado `in_progress`.

### 10.2 Consultar test para responder

Debe devolver el test con sus preguntas y opciones, pero sin mostrar respuestas correctas ni explicaciones.

Debe incluir:

- ID de intento.
- ID de test.
- Preguntas.
- Opciones.
- Orden de preguntas.
- Dificultad.
- Tema.

No debe incluir:

- Opcion correcta.
- Campo `is_correct`.
- Explicacion.
- Resultado.

### 10.3 Guardar respuesta

Entrada:

- `attempt_id`
- `test_question_id`
- `selected_option_id`

Debe guardar o actualizar la respuesta.

### 10.4 Borrar respuesta

Entrada:

- `attempt_id`
- `test_question_id`

Debe dejar la pregunta como no respondida.

### 10.5 Enviar test

Entrada:

- `attempt_id`

Debe corregir y finalizar el intento.

### 10.6 Consultar resultado

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

### 10.7 Consultar revision del test

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

Esta vista solo debe estar disponible despues de enviar el test.

### 10.8 Cancelar intento

Debe permitir cancelar un intento en progreso.

## 11. Validaciones minimas

No se puede:

- Iniciar intento sobre test inexistente.
- Iniciar intento sobre test cancelado.
- Guardar respuesta en intento inexistente.
- Guardar respuesta en intento enviado.
- Guardar respuesta en intento cancelado.
- Guardar respuesta para pregunta que no pertenece al test.
- Guardar opcion que no pertenece a esa pregunta.
- Enviar intento inexistente.
- Enviar intento ya enviado.
- Enviar intento cancelado.
- Consultar revision antes de enviar.

Errores recomendados:

- `TEST_NOT_FOUND`
- `TEST_CANCELLED_CANNOT_BE_STARTED`
- `TEST_ATTEMPT_NOT_FOUND`
- `TEST_ATTEMPT_ALREADY_SUBMITTED`
- `TEST_ATTEMPT_CANCELLED`
- `QUESTION_NOT_IN_TEST`
- `OPTION_NOT_IN_QUESTION`
- `TEST_ATTEMPT_REVIEW_NOT_AVAILABLE`
- `TEST_ATTEMPT_INVALID_STATUS`

## 12. Tests automaticos obligatorios

Deben existir tests para comprobar:

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

## 13. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe modelo de intento de test.
- Existe modelo de respuesta del usuario.
- Se puede iniciar un intento.
- Se puede consultar un test sin revelar respuestas correctas.
- Se pueden guardar respuestas.
- Se pueden actualizar respuestas.
- Se pueden borrar respuestas.
- Se puede enviar un test.
- Se corrige automaticamente el test.
- Se calculan aciertos, fallos y no respondidas.
- Se calcula puntuacion basica.
- Se puede consultar resultado.
- Se puede consultar revision con explicaciones.
- No se muestran respuestas correctas antes de enviar.
- No se pueden modificar respuestas despues de enviar.
- Existen errores claros.
- Existen tests automaticos de reglas criticas.
- No se implementan estadisticas avanzadas.
- No se implementa frontend avanzado.
- No se anaden funcionalidades fuera del MVP.

## 14. Relacion con frontend futuro

Esta spec debe dejar operaciones claras para que el frontend pueda construir:

- Pantalla de inicio de test.
- Pantalla de preguntas.
- Seleccion de respuesta.
- Boton de enviar.
- Pantalla de resultado.
- Pantalla de revision con explicaciones.

El frontend no debe tener que calcular la nota.

La correccion debe realizarse en la logica del backend o capa de servicios.

## 15. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del repositorio.

Prioridades:

- Reutilizar tests generados en SPEC 007.
- No duplicar preguntas.
- No exponer respuestas correctas antes de enviar.
- Mantener la correccion en una capa de servicio.
- Mantener modelos simples.
- Anadir tests para reglas criticas.
- No implementar estadisticas avanzadas todavia.
- No sobredisenar usuarios ni autenticacion.

Si todavia no hay usuarios, el intento puede existir sin `user_id`.

La relacion con usuarios podra anadirse en una spec posterior.

## 16. Prompt para Claude

Claude, implementa la SPEC 008 - Test Taking & Results.

Estamos cerrando el flujo minimo del MVP de TESTOPO.

Debes crear el modulo que permite realizar un test generado, guardar respuestas, enviar el test y obtener resultados.

Implementa:

- Modelo de intento de test.
- Modelo de respuesta del usuario.
- Inicio de intento.
- Consulta de test en modo respuesta sin mostrar soluciones.
- Guardado de respuestas.
- Actualizacion de respuestas.
- Borrado de respuestas.
- Envio/finalizacion del test.
- Correccion automatica.
- Calculo de aciertos, fallos y no respondidas.
- Calculo de puntuacion basica.
- Consulta de resultado.
- Consulta de revision con respuesta correcta y explicacion.
- Cancelacion de intento.
- Tests automaticos de reglas criticas.

No implementes todavia:

- Usuarios y autenticacion.
- Estadisticas avanzadas.
- Recomendaciones inteligentes.
- Repaso de fallos.
- Temporizador obligatorio.
- Penalizacion por fallo.
- Simulacros oficiales complejos.
- Ranking.
- Gamificacion.
- Frontend avanzado.
- Pagos.

Regla central:

Antes de enviar el test, nunca debe mostrarse la respuesta correcta ni la explicacion.

Despues de enviar el test, el usuario debe poder ver su resultado, la respuesta correcta y la explicacion de cada pregunta.

Manten la implementacion simple, modular y compatible con SPEC 001 a SPEC 007. No rompas los tests existentes.
