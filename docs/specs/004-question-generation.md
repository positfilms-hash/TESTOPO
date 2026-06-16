# SPEC 004 - Question Generation Drafts

## 1. Objetivo

Crear el modulo basico de generacion de borradores de preguntas para TESTOPO.

Este modulo debe permitir generar preguntas tipo test a partir de material registrado en el sistema.

El objetivo no es crear preguntas validadas automaticamente. El objetivo es crear candidatos de preguntas que despues puedan ser revisados, editados y validados mediante el banco de preguntas.

## 2. Contexto MVP

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen o deben existir:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.

La SPEC 001 define el modelo de pregunta y sus reglas de validacion.

La SPEC 002 define el material como fuente trazable.

La SPEC 003 define el mapa de temas.

Esta SPEC 004 conecta esos modulos para generar borradores de preguntas desde material.

Principio central:

> La IA puede proponer preguntas, pero no puede convertirlas automaticamente en preguntas validas.

## 3. Branch recomendada

```text
feature/question-generation
```

## 4. Alcance

Claude debe implementar un modulo basico para generar candidatos de preguntas.

Debe incluir:

- Servicio o modulo de generacion de preguntas.
- Entrada basada en material existente.
- Entrada basada en tema existente.
- Seleccion de numero de preguntas a generar.
- Seleccion de dificultad estimada.
- Generacion de preguntas tipo test de respuesta unica.
- Creacion de preguntas en estado `draft` o `pending_review`.
- Vinculacion obligatoria con fuente.
- Vinculacion obligatoria con tema, si existe.
- Explicacion obligatoria.
- Registro del fragmento o referencia usada.
- Validacion formal basica antes de guardar.
- Tests automaticos de reglas criticas.
- Prompt base para generacion de preguntas, si el proyecto ya incluye carpeta `/prompts`.

## 5. Fuera de alcance

No debe implementarse todavia:

- Validacion automatica avanzada de verdad juridica.
- Revision humana visual avanzada.
- Panel complejo de administracion.
- Simulacros de examen.
- Generacion de tests finales.
- Estadisticas de dificultad real.
- Recomendaciones de estudio.
- OCR.
- Extraccion avanzada de PDF o DOCX.
- Comparacion automatica entre normas.
- Correccion automatica de temario obsoleto.
- Publicacion automatica de preguntas validadas.
- Multiples tipos de pregunta.
- Preguntas multirrespuesta.

Para el MVP, solo se generan preguntas tipo test de respuesta unica.

## 6. Regla principal

Toda pregunta generada por este modulo debe quedar en uno de estos estados:

- `draft`
- `pending_review`

Nunca debe crearse directamente como:

- `validated`

La validacion final pertenece al flujo de revision del banco de preguntas.

## 7. Entrada del generador

El generador debe poder recibir:

- `material_id`
- `topic_id`
- `difficulty`
- `question_count`
- `reference`
- `generation_mode`

### material_id

Material registrado en la SPEC 002.

Debe existir y no estar en estado `obsolete`.

### topic_id

Tema registrado en la SPEC 003.

Debe existir y no estar en estado `obsolete`, si se proporciona.

### difficulty

Dificultad estimada de las preguntas a generar.

Valores permitidos:

- `easy`
- `medium`
- `hard`
- `mixed`

Si se usa `mixed`, el sistema puede generar una distribucion simple.

Ejemplo:

- `easy`: 40%
- `medium`: 40%
- `hard`: 20%

Para el MVP, esta distribucion puede ser sencilla y documentada.

### question_count

Numero de preguntas a generar.

Debe tener limites para evitar abuso.

Valores recomendados para MVP:

- minimo: 1
- maximo: 20

### reference

Referencia opcional dentro del material.

Ejemplos:

- Tema 1
- Pagina 4
- Articulo 14
- Apartado 2.1
- Fragmento sobre recursos administrativos

### generation_mode

Modo de generacion.

Valores recomendados:

- `from_material_text`
- `from_material_excerpt`
- `manual_seed`

Para el MVP:

- `from_material_text`: genera desde `content_text` del material.
- `from_material_excerpt`: genera desde un fragmento concreto dado por el usuario.
- `manual_seed`: genera desde un texto pegado manualmente.

## 8. Salida del generador

El generador debe devolver una lista de candidatos de pregunta.

Cada candidato debe incluir:

- `statement`
- `options`
- `correct_answer`
- `explanation`
- `source`
- `topic`
- `difficulty`
- `status`
- `generation_metadata`

### statement

Enunciado de la pregunta.

### options

Opciones de respuesta.

Para el MVP, cada pregunta debe tener preferentemente 4 opciones.

Minimo permitido por SPEC 001:

- 2 opciones

Recomendacion de generacion:

- 4 opciones

### correct_answer

Debe haber exactamente una opcion correcta.

### explanation

Debe explicar por que la respuesta correcta es valida.

Debe intentar explicar tambien por que las demas opciones son incorrectas, si el generador puede hacerlo.

### source

Debe estar vinculada al material.

Debe incluir:

- `material_id`
- `title`
- `type`
- `reference`
- `excerpt`
- `status`

### topic

Debe vincularse al tema indicado si existe.

### difficulty

Debe asignarse segun la dificultad solicitada.

### status

Debe ser siempre:

- `draft`

o:

- `pending_review`

Estado recomendado para preguntas generadas automaticamente:

- `pending_review`

### generation_metadata

Debe guardar informacion util para trazabilidad.

Campos recomendados:

- `generator_version`
- `generation_mode`
- `created_from_material_id`
- `created_from_topic_id`
- `requested_difficulty`
- `requested_question_count`
- `created_at`

No guardar claves privadas, tokens ni datos sensibles.

## 9. Reglas de negocio

### 9.1 No validacion automatica

Una pregunta generada no puede pasar automaticamente a `validated`.

Aunque parezca correcta, debe pasar por revision o validacion posterior.

### 9.2 Fuente obligatoria

No se puede guardar una pregunta generada sin fuente.

La fuente debe apuntar a un material existente y no obsoleto.

### 9.3 Explicacion obligatoria

No se puede guardar una pregunta generada sin explicacion.

### 9.4 Tema recomendado

Si se proporciona `topic_id`, la pregunta debe quedar vinculada a ese tema.

Si no se proporciona tema, la pregunta puede generarse solo si existe al menos un topic textual o una referencia clara, pero debe quedar en `draft`, no en `pending_review`.

### 9.5 Material obsoleto

No se pueden generar preguntas desde material con estado:

- `obsolete`

### 9.6 Material sin texto

Si el material no tiene `content_text` y no se proporciona fragmento manual, el generador debe rechazar la operacion con error claro.

Ejemplo:

- `MATERIAL_CONTENT_REQUIRED_FOR_GENERATION`

### 9.7 Numero maximo de preguntas

No se deben generar mas de 20 preguntas por solicitud en el MVP.

### 9.8 Preguntas duplicadas

El sistema debe intentar evitar duplicados exactos de enunciado.

Para el MVP basta con comprobar si ya existe una pregunta con el mismo `statement` normalizado.

No hace falta deteccion semantica avanzada todavia.

### 9.9 Formato obligatorio

Antes de guardar una pregunta generada, debe pasar una validacion formal basica:

- Tiene enunciado.
- Tiene opciones.
- Tiene al menos 2 opciones.
- Tiene exactamente una respuesta correcta.
- Tiene explicacion.
- Tiene fuente.
- Tiene dificultad valida.
- Tiene estado permitido.

Si no cumple esto, no debe guardarse.

### 9.10 Trazabilidad

Cada pregunta generada debe poder responder a estas preguntas:

- De que material salio.
- De que fragmento o referencia salio.
- A que tema pertenece.
- Que dificultad se pidio.
- Cuando se genero.
- En que estado quedo.

## 10. Integracion con IA

Si el proyecto ya tiene una forma definida de llamar a un modelo de IA, Claude puede conectarla de forma simple y controlada.

Si todavia no existe integracion IA, Claude debe crear una interfaz o servicio desacoplado, por ejemplo:

- `QuestionGenerationProvider`

o equivalente segun el stack.

Debe permitir que en el futuro se conecte un proveedor real de IA sin reescribir toda la logica.

Para el MVP, es aceptable usar:

- Un mock provider.
- Una funcion de generacion simulada.
- Una interfaz preparada.
- Un prompt base documentado.

Lo importante es que el flujo de generacion, validacion formal y guardado quede preparado.

## 11. Prompt base de generacion

Crear o actualizar un archivo:

```text
/prompts/question-generator.md
```

Contenido minimo recomendado:

```markdown
# Question Generator Prompt

You are generating multiple-choice exam questions for a public exam study app.

Rules:

1. Generate only questions based on the provided material.
2. Do not use external knowledge.
3. Each question must have exactly one correct answer.
4. Each question must include a clear explanation.
5. Each question must cite the provided source reference or excerpt.
6. Avoid ambiguous wording.
7. Avoid trick questions that depend on interpretation.
8. Avoid duplicate or near-duplicate questions.
9. Use the requested difficulty.
10. Output must be structured and machine-readable.

The generated questions are drafts. They are not validated automatically.
```

Si el proyecto usa espanol como idioma principal, el prompt puede estar en espanol.

## 12. Validaciones minimas

Errores recomendados:

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

## 13. Operaciones minimas

Claude debe implementar estas operaciones segun el stack existente.

### 13.1 Generar preguntas desde material

Entrada:

- `material_id`
- `topic_id`
- `difficulty`
- `question_count`

Debe usar `content_text` del material.

Si no hay `content_text`, debe devolver error.

### 13.2 Generar preguntas desde fragmento

Entrada:

- `material_id`
- `topic_id`
- `excerpt`
- `difficulty`
- `question_count`

Debe usar el fragmento como base.

El fragmento debe guardarse en la fuente de la pregunta como `excerpt`.

### 13.3 Generar preguntas desde texto manual

Entrada:

- `manual_text`
- `topic_id`
- `difficulty`
- `question_count`
- `reference`

Debe crear preguntas en `draft`, salvo que haya un material asociado.

Si no hay material asociado, la fuente debe marcarse claramente como manual o temporal.

### 13.4 Guardar preguntas generadas

Las preguntas generadas deben guardarse usando el modelo del banco de preguntas de la SPEC 001.

No debe crearse un segundo modelo paralelo de preguntas.

### 13.5 Listar resultados de generacion

Si es sencillo, debe quedar registrado un historial basico de generacion.

Modelo opcional:

- `QuestionGenerationRun`

Campos recomendados:

- `id`
- `material_id`
- `topic_id`
- `mode`
- `requested_count`
- `created_count`
- `status`
- `errors`
- `created_at`

Este historial es util, pero no debe complicar excesivamente el MVP.

## 14. Tests automaticos obligatorios

Deben existir tests para comprobar:

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

## 15. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe un modulo o servicio de generacion de preguntas.
- Se pueden generar candidatos desde material con texto.
- Se pueden generar candidatos desde un fragmento.
- Las preguntas generadas usan el modelo de SPEC 001.
- Las preguntas generadas se vinculan a material de SPEC 002.
- Las preguntas generadas pueden vincularse a tema de SPEC 003.
- Las preguntas generadas tienen fuente, explicacion y dificultad.
- Las preguntas generadas quedan en `draft` o `pending_review`.
- Ninguna pregunta generada queda directamente en `validated`.
- Existe validacion formal antes de guardar.
- Existen errores claros.
- Existen tests de reglas criticas.
- Existe o se actualiza `/prompts/question-generator.md`.
- No se implementa revision avanzada.
- No se implementa generacion de tests finales.
- No se implementan estadisticas avanzadas.
- No se anaden funcionalidades fuera del MVP.

## 16. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del repositorio.

Prioridades:

- Mantener compatibilidad con SPEC 001, SPEC 002 y SPEC 003.
- No duplicar modelos de pregunta.
- Separar logica de generacion de logica de validacion.
- Mantener el proveedor de IA desacoplado.
- Usar mocks o interfaces si no hay integracion real de IA.
- No guardar tokens, claves ni secretos.
- No sobredisenar.
- No validar automaticamente preguntas generadas.

La generacion debe verse como creacion de borradores, no como creacion de verdad final.

## 17. Prompt para Claude

Claude, implementa la SPEC 004 - Question Generation Drafts.

Estamos construyendo el MVP de TESTOPO.

Debes crear el modulo basico para generar borradores de preguntas tipo test desde material registrado, fragmentos o texto manual.

Implementa:

- Servicio o modulo de generacion de preguntas.
- Entrada por `material_id`.
- Entrada por fragmento.
- Entrada por texto manual, si encaja con el stack actual.
- Seleccion de dificultad.
- Limite de numero de preguntas.
- Validacion formal antes de guardar.
- Guardado de preguntas generadas en el banco de preguntas existente.
- Vinculacion con material como fuente.
- Vinculacion con tema si existe.
- Explicacion obligatoria.
- Estado `draft` o `pending_review`.
- Prompt base en `/prompts/question-generator.md`.
- Tests automaticos de reglas criticas.

No implementes todavia:

- Validacion automatica avanzada.
- Revision humana avanzada.
- Generacion de tests finales.
- Simulacros.
- Estadisticas avanzadas.
- OCR.
- Procesamiento avanzado de PDF o DOCX.
- Preguntas multirrespuesta.
- Publicacion automatica de preguntas validadas.

Regla central:

La IA o el generador solo puede crear candidatos. Ninguna pregunta generada puede quedar directamente como `validated`.

Manten la implementacion simple, modular y compatible con SPEC 001, SPEC 002 y SPEC 003. No rompas los tests existentes.
