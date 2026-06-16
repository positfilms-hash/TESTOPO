# SPEC 007 - Test Generator

## 1. Objetivo

Crear el modulo basico de generacion de tests para TESTOPO.

Este modulo debe permitir generar tests aleatorios a partir del banco de preguntas validadas.

El objetivo no es todavia crear resultados avanzados, estadisticas completas ni simulacros oficiales complejos. El objetivo es que el usuario pueda recibir un conjunto de preguntas validas para practicar.

## 2. Contexto MVP

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen o deben existir:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.

La SPEC 006 permite aprobar preguntas mediante revision humana.

Esta SPEC 007 usa esas preguntas aprobadas para crear tests.

Principio central:

> Un test normal solo puede contener preguntas validadas.

## 3. Branch recomendada

```text
feature/test-generator
```

## 4. Alcance

Claude debe implementar el generador basico de tests.

Debe incluir:

- Modelo de test.
- Modelo de pregunta incluida en test.
- Creacion de test aleatorio.
- Seleccion de preguntas por numero.
- Filtro por tema.
- Filtro por dificultad.
- Filtro mixto por tema y dificultad.
- Exclusion de preguntas no validadas.
- Exclusion de preguntas obsoletas.
- Orden aleatorio de preguntas.
- Orden aleatorio de opciones, si es sencillo.
- Consulta de test generado.
- Tests automaticos de reglas criticas.

## 5. Fuera de alcance

No debe implementarse todavia:

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

La correccion de respuestas y resultados detallados se implementara en la SPEC 008.

## 6. Modelo de test

Crear un modelo llamado `Test`, `PracticeTest` o similar.

Campos minimos:

- `id`
- `title`
- `mode`
- `status`
- `question_count`
- `filters`
- `created_at`
- `updated_at`

## 7. Descripcion de campos

### id

Identificador unico del test.

### title

Titulo opcional del test.

Ejemplos:

- Test aleatorio
- Test Tema 1
- Test dificil de Procedimiento Administrativo

Si no se proporciona, el sistema puede generar uno basico.

### mode

Modo de test.

Valores permitidos para MVP:

- `random`
- `by_topic`
- `by_difficulty`
- `mixed`

### status

Estado del test.

Valores permitidos para MVP:

- `created`
- `in_progress`
- `completed`
- `cancelled`

Estado inicial recomendado:

- `created`

### question_count

Numero de preguntas solicitadas.

### filters

Objeto o estructura con los filtros usados para generar el test.

Debe poder guardar:

- `topic_id`
- `difficulty`
- `question_count`
- `random_seed`

### created_at

Fecha de creacion.

### updated_at

Fecha de ultima modificacion.

## 8. Modelo de pregunta dentro de test

Crear un modelo llamado `TestQuestion`, `PracticeTestQuestion` o similar.

Campos minimos:

- `id`
- `test_id`
- `question_id`
- `order`
- `options_order`
- `created_at`

### test_id

Referencia al test.

### question_id

Referencia a la pregunta validada.

### order

Orden de aparicion de la pregunta dentro del test.

### options_order

Orden de opciones en el test, si se implementa aleatorizacion de opciones.

Para el MVP, si ordenar opciones complica demasiado, puede dejarse documentado para una futura spec.

## 9. Entrada del generador

El generador debe poder recibir:

- `question_count`
- `topic_id`
- `difficulty`
- `mode`

### question_count

Numero de preguntas a incluir.

Valores recomendados para MVP:

- minimo: 1
- maximo: 100

Si no se indica, valor por defecto:

- 20

### topic_id

Filtro opcional por tema.

Si se proporciona, debe existir y no estar `obsolete`.

### difficulty

Filtro opcional por dificultad.

Valores permitidos:

- `easy`
- `medium`
- `hard`
- `mixed`

Si se usa `mixed`, el sistema debe seleccionar preguntas de varias dificultades.

Distribucion recomendada para MVP:

- `easy`: 40%
- `medium`: 40%
- `hard`: 20%

Si no hay suficientes preguntas de una dificultad, puede completar con otras dificultades disponibles, pero debe dejarlo reflejado en los metadatos del test.

### mode

Modo de generacion.

Valores permitidos:

- `random`
- `by_topic`
- `by_difficulty`
- `mixed`

## 10. Reglas de negocio

### 10.1 Solo preguntas validadas

El generador solo puede seleccionar preguntas con estado:

- `validated`

Debe excluir siempre preguntas con estado:

- `draft`
- `pending_review`
- `needs_fix`
- `rejected`
- `obsolete`

### 10.2 Fuente y tema no obsoletos

Si la pregunta esta vinculada a fuente, material o tema obsoleto, debe excluirse del test.

### 10.3 Numero insuficiente de preguntas

Si no hay suficientes preguntas para cumplir los filtros, el sistema debe actuar de forma clara.

Opcion recomendada para MVP:

- Crear el test solo si puede completar el numero solicitado.
- Si no hay suficientes preguntas, devolver error.

Error recomendado:

- `TEST_NOT_ENOUGH_VALIDATED_QUESTIONS`

En una fase posterior se podra permitir crear tests parciales.

### 10.4 Aleatoriedad

Las preguntas deben seleccionarse aleatoriamente.

Debe evitarse que dos tests consecutivos con los mismos filtros devuelvan siempre las mismas preguntas en el mismo orden.

Si se usa `random_seed`, debe guardarse en `filters`.

### 10.5 No duplicar preguntas en el mismo test

Un test no puede contener la misma pregunta mas de una vez.

Error recomendado:

- `TEST_DUPLICATE_QUESTION_NOT_ALLOWED`

### 10.6 Dificultad mixta

Si se solicita dificultad `mixed`, el sistema debe intentar usar una distribucion simple:

- `easy`: 40%
- `medium`: 40%
- `hard`: 20%

Ejemplo para 10 preguntas:

- 4 `easy`
- 4 `medium`
- 2 `hard`

Si el numero no divide exactamente, el sistema puede redondear de forma sencilla y documentada.

### 10.7 Tema obsoleto

No se puede generar un test filtrando por un tema `obsolete`.

Error recomendado:

- `TEST_TOPIC_OBSOLETE`

## 11. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 11.1 Crear test aleatorio global

Entrada:

- `question_count`

Debe seleccionar preguntas validadas de todo el banco.

### 11.2 Crear test por tema

Entrada:

- `question_count`
- `topic_id`

Debe seleccionar preguntas validadas asociadas a ese tema.

### 11.3 Crear test por dificultad

Entrada:

- `question_count`
- `difficulty`

Debe seleccionar preguntas validadas de esa dificultad.

### 11.4 Crear test mixto

Entrada:

- `question_count`
- `topic_id`
- `difficulty`

Debe permitir combinar filtros.

Ejemplos:

- 20 preguntas del Tema 1
- 30 preguntas dificiles
- 50 preguntas mixtas del Tema 3

### 11.5 Consultar test

Debe permitir recuperar un test por ID con sus preguntas.

Para esta spec, puede mostrar:

- Enunciado.
- Opciones.
- Orden.
- Tema.
- Dificultad.

Importante:

Para un test en curso, no deberia exponerse la respuesta correcta si la arquitectura ya distingue entre modo alumno y modo revision.

Si todavia no existe esa separacion, al menos debe quedar documentado que la respuesta correcta no debe mostrarse al usuario durante la realizacion del test.

### 11.6 Cancelar test

Debe permitir marcar un test como:

- `cancelled`

No debe borrar las preguntas ni el banco.

## 12. Validaciones minimas

No se puede crear un test si:

- `question_count` es menor que 1.
- `question_count` supera el maximo permitido.
- `topic_id` no existe.
- `topic_id` esta obsoleto.
- `difficulty` es invalida.
- `mode` es invalido.
- No hay suficientes preguntas validadas.
- El resultado contiene preguntas duplicadas.
- El resultado contiene preguntas no validadas.

Errores recomendados:

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

## 13. Tests automaticos obligatorios

Deben existir tests para comprobar:

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

## 14. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe un modelo de test.
- Existe un modelo de relacion entre test y preguntas.
- Se puede crear un test aleatorio global.
- Se puede crear un test por tema.
- Se puede crear un test por dificultad.
- Se puede crear un test mixto.
- Solo se usan preguntas `validated`.
- Se excluyen preguntas obsoletas o problematicas.
- Se rechaza la creacion si no hay suficientes preguntas validas.
- No hay preguntas duplicadas dentro del mismo test.
- Se puede consultar un test.
- Se puede cancelar un test.
- Existen errores claros.
- Existen tests automaticos de reglas criticas.
- No se implementa todavia correccion de respuestas.
- No se implementan estadisticas avanzadas.
- No se implementa frontend avanzado.
- No se anaden funcionalidades fuera del MVP.

## 15. Relacion con frontend futuro

Esta spec debe dejar operaciones claras para que despues el frontend pueda:

- Pedir un test aleatorio.
- Pedir un test por tema.
- Pedir un test por dificultad.
- Mostrar las preguntas al usuario.
- Enviar respuestas en la SPEC 008.

No implementar todavia interfaz visual avanzada.

## 16. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del repositorio.

Prioridades:

- Reutilizar el modelo de preguntas de SPEC 001.
- Respetar el estado `validated`.
- Reutilizar temas de SPEC 003.
- No duplicar preguntas en test.
- Mantener logica de seleccion separada.
- Escribir tests para las reglas criticas.
- No implementar resultados todavia.
- No mostrar respuestas correctas en modo alumno si se puede evitar.
- No sobredisenar.

## 17. Prompt para Claude

Claude, implementa la SPEC 007 - Test Generator.

Estamos construyendo el MVP de TESTOPO.

Debes crear el modulo basico de generacion de tests.

Implementa:

- Modelo de test.
- Modelo de preguntas dentro de test.
- Creacion de test aleatorio global.
- Creacion de test por tema.
- Creacion de test por dificultad.
- Creacion de test mixto.
- Seleccion aleatoria de preguntas.
- Exclusion de preguntas no validadas.
- Exclusion de preguntas obsoletas.
- Validacion de numero de preguntas.
- Validacion de tema y dificultad.
- Consulta de test generado.
- Cancelacion de test.
- Tests automaticos de reglas criticas.

No implementes todavia:

- Correccion de respuestas.
- Resultados avanzados.
- Estadisticas de usuario.
- Simulacros oficiales complejos.
- Temporizador.
- Ranking.
- Recomendaciones inteligentes.
- Frontend avanzado.
- Pagos.
- Gamificacion.

Regla central:

Un test normal solo puede contener preguntas en estado `validated`.

Nunca incluyas preguntas `draft`, `pending_review`, `needs_fix`, `rejected` u `obsolete`.

Manten la implementacion simple, modular y compatible con SPEC 001, SPEC 002, SPEC 003, SPEC 004, SPEC 005 y SPEC 006. No rompas los tests existentes.
