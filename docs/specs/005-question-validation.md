# SPEC 005 - Question Validation & Quality Gate

## 1. Objetivo

Crear el modulo de validacion y control de calidad de preguntas para TESTOPO.

Este modulo debe revisar preguntas existentes o generadas automaticamente y determinar si cumplen las reglas minimas de calidad.

El objetivo no es validar preguntas automaticamente como definitivas. El objetivo es detectar problemas, generar informes claros y ayudar a que las preguntas puedan ser revisadas antes de usarse en tests normales.

## 2. Contexto MVP

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen o deben existir:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.

La SPEC 001 define el modelo de pregunta.

La SPEC 002 define las fuentes y materiales.

La SPEC 003 define los temas.

La SPEC 004 genera preguntas como `draft` o `pending_review`.

Esta SPEC 005 anade una capa de control para evitar que preguntas malas, ambiguas o incompletas avancen sin revision.

Principio central:

> Una pregunta no es valida porque exista. Una pregunta debe demostrar que tiene estructura correcta, fuente activa, explicacion clara y una unica respuesta correcta.

## 3. Branch recomendada

```text
feature/question-validation
```

## 4. Alcance

Claude debe implementar un modulo de validacion de preguntas.

Debe incluir:

- Servicio de validacion de preguntas.
- Validacion formal.
- Validacion basica de fuente.
- Validacion basica de tema.
- Deteccion de opciones duplicadas.
- Deteccion de respuesta correcta invalida.
- Deteccion de explicacion ausente o debil.
- Deteccion basica de enunciados problematicos.
- Deteccion de duplicados exactos.
- Informe de validacion por pregunta.
- Validacion individual.
- Validacion por lote.
- Actualizacion controlada del estado de una pregunta segun resultado.
- Prompt base para validacion critica, si aplica.
- Tests automaticos de reglas criticas.

## 5. Fuera de alcance

No debe implementarse todavia:

- Validacion juridica perfecta.
- Comparacion automatica avanzada contra leyes.
- Razonamiento legal profundo.
- OCR.
- Extraccion avanzada de documentos.
- Correccion automatica completa de preguntas.
- Validacion automatica como `validated`.
- Panel visual avanzado.
- Sistema de reportes de usuarios.
- Estadisticas avanzadas.
- Generacion de tests finales.
- Recomendaciones de estudio.
- Sistema de usuarios.
- Autenticacion.

Esta spec solo crea la compuerta de calidad del MVP.

## 6. Regla principal

El modulo de validacion puede decir que una pregunta pasa los controles, pero no debe convertirla automaticamente en `validated`.

Estados permitidos tras una validacion automatica:

- `draft`
- `pending_review`
- `needs_fix`

Regla recomendada:

- Si la pregunta tiene errores criticos, marcar como `needs_fix`.
- Si la pregunta pasa los controles automaticos, marcar como `pending_review`.
- Solo una revision humana o una accion explicita posterior podra pasarla a `validated`.

## 7. Tipos de validacion

El sistema debe dividir la validacion en capas.

### 7.1 Validacion formal

Comprueba estructura minima.

Debe revisar:

- Existe enunciado.
- Existen opciones.
- Hay al menos 2 opciones.
- Hay exactamente una opcion correcta.
- Existe explicacion.
- Existe fuente.
- Existe tema o `topic_id`.
- Existe dificultad valida.
- Existe estado valido.
- No hay opciones duplicadas.
- La respuesta correcta existe entre las opciones.

Errores recomendados:

- `QUESTION_STATEMENT_REQUIRED`
- `QUESTION_OPTIONS_REQUIRED`
- `QUESTION_MIN_OPTIONS_NOT_MET`
- `QUESTION_SINGLE_CORRECT_OPTION_REQUIRED`
- `QUESTION_EXPLANATION_REQUIRED`
- `QUESTION_SOURCE_REQUIRED`
- `QUESTION_TOPIC_REQUIRED`
- `QUESTION_DIFFICULTY_REQUIRED`
- `QUESTION_INVALID_DIFFICULTY`
- `QUESTION_INVALID_STATUS`
- `QUESTION_DUPLICATE_OPTIONS`
- `QUESTION_CORRECT_OPTION_NOT_FOUND`

### 7.2 Validacion de fuente

Comprueba que la pregunta es trazable.

Debe revisar:

- La fuente existe.
- La fuente esta vinculada a material, si existe `material_id`.
- El material no esta `obsolete`.
- La fuente no esta `obsolete`.
- Existe `reference` o `excerpt` cuando sea posible.
- La pregunta no se basa en material marcado como obsoleto.

Errores recomendados:

- `QUESTION_SOURCE_NOT_FOUND`
- `QUESTION_SOURCE_MATERIAL_NOT_FOUND`
- `QUESTION_SOURCE_OBSOLETE`
- `QUESTION_SOURCE_MATERIAL_OBSOLETE`
- `QUESTION_SOURCE_REFERENCE_MISSING`
- `QUESTION_SOURCE_EXCERPT_MISSING`

Para el MVP, `reference` o `excerpt` pueden generar advertencia en lugar de error critico si todavia no todos los materiales tienen fragmentos procesados.

### 7.3 Validacion de tema

Comprueba que la pregunta esta asociada a una parte del temario.

Debe revisar:

- Existe `topic` textual o `topic_id`.
- Si hay `topic_id`, el tema existe.
- El tema no esta `obsolete`.

Errores recomendados:

- `QUESTION_TOPIC_NOT_FOUND`
- `QUESTION_TOPIC_OBSOLETE`

### 7.4 Validacion de dificultad

Comprueba que la dificultad esta dentro de los valores permitidos.

Valores permitidos:

- `easy`
- `medium`
- `hard`

La dificultad `mixed` solo puede usarse como entrada de generacion, no como dificultad final de una pregunta.

Error recomendado:

- `QUESTION_INVALID_DIFFICULTY`

### 7.5 Validacion de duplicados

Para el MVP, debe detectarse duplicado exacto de enunciado.

Normalizacion recomendada:

- Quitar espacios sobrantes.
- Ignorar mayusculas y minusculas.
- Ignorar saltos de linea repetidos.

Error recomendado:

- `QUESTION_DUPLICATE_STATEMENT`

No implementar todavia deteccion semantica avanzada de preguntas parecidas.

### 7.6 Validacion basica de ambiguedad

El sistema debe detectar senales simples de posible ambiguedad.

Puede hacerlo mediante reglas basicas y/o mediante un proveedor desacoplado de IA.

Senales recomendadas:

- Enunciado demasiado corto.
- Enunciado sin contexto suficiente.
- Uso de expresiones vagas.
- Opciones como "todas las anteriores" o "ninguna de las anteriores", salvo que se permita expresamente.
- Opciones demasiado parecidas entre si.
- Explicacion demasiado corta.
- Pregunta formulada en negativo de forma confusa.

Advertencias recomendadas:

- `QUESTION_STATEMENT_TOO_SHORT`
- `QUESTION_STATEMENT_POSSIBLY_AMBIGUOUS`
- `QUESTION_EXPLANATION_TOO_SHORT`
- `QUESTION_OPTIONS_TOO_SIMILAR`
- `QUESTION_NEGATIVE_WORDING_REVIEW`
- `QUESTION_ALL_OR_NONE_OPTION_REVIEW`

Estas senales no siempre deben bloquear la pregunta, pero si deben aparecer en el informe de validacion.

## 8. Niveles de severidad

Cada resultado de validacion debe tener severidad.

Valores recomendados:

- `error`
- `warning`
- `info`

### error

Bloquea que la pregunta avance a `pending_review` o `validated`.

Ejemplos:

- Sin respuesta correcta.
- Sin fuente.
- Sin explicacion.
- Fuente obsoleta.
- Tema obsoleto.
- Mas de una respuesta correcta.

### warning

No bloquea necesariamente, pero exige revision.

Ejemplos:

- Explicacion muy corta.
- Enunciado posiblemente ambiguo.
- Falta de fragmento exacto.
- Redaccion negativa.

### info

Informacion util para revision.

Ejemplos:

- Pregunta generada automaticamente.
- Dificultad estimada.
- Fuente vinculada correctamente.

## 9. Resultado de validacion

Cada validacion debe devolver un informe estructurado.

Modelo recomendado:

- `QuestionValidationResult`

Campos minimos:

- `id`
- `question_id`
- `status`
- `passed`
- `errors`
- `warnings`
- `info`
- `validated_at`
- `validator_version`
- `recommended_status`

### status

Estado del resultado de validacion.

Valores recomendados:

- `passed`
- `failed`
- `passed_with_warnings`

### passed

Booleano.

Debe ser `true` solo si no hay errores criticos.

### errors

Lista de errores criticos.

### warnings

Lista de advertencias.

### info

Lista de informacion adicional.

### recommended_status

Estado recomendado para la pregunta.

Valores posibles:

- `pending_review`
- `needs_fix`

No debe recomendar automaticamente `validated` en esta spec.

## 10. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 10.1 Validar una pregunta

Entrada:

- `question_id`

Salida:

- `QuestionValidationResult`

Debe ejecutar todas las validaciones disponibles.

### 10.2 Validar varias preguntas

Entrada:

- `question_ids`

Salida:

- `QuestionValidationResult[]`

Debe poder validar un lote de preguntas sin detener todo el proceso por un unico fallo.

### 10.3 Validar preguntas pendientes

Si es sencillo, anadir una operacion para validar todas las preguntas en estado:

- `draft`
- `pending_review`
- `needs_fix`

No debe tocar preguntas `validated` salvo que se pida expresamente.

### 10.4 Aplicar resultado de validacion

Debe existir una operacion para aplicar el resultado recomendado:

- Si hay errores criticos: pasar a `needs_fix`.
- Si no hay errores criticos: pasar a `pending_review`.

Nunca pasar automaticamente a `validated`.

### 10.5 Consultar ultimo informe de validacion

Si se guarda historial, debe poder consultarse el ultimo informe asociado a una pregunta.

Para el MVP, el historial completo es opcional, pero recomendable si no complica el diseno.

## 11. Integracion con preguntas generadas

Las preguntas creadas por SPEC 004 deben poder pasar por este validador.

Flujo recomendado:

1. Se genera pregunta desde material.
2. Se guarda como `draft` o `pending_review`.
3. Se ejecuta validacion automatica.
4. Si falla, queda como `needs_fix`.
5. Si pasa, queda como `pending_review`.
6. Una persona revisa y decide si pasa a `validated`.

## 12. Integracion con IA

Si el proyecto ya tiene proveedor de IA o mock provider, puede anadirse una interfaz desacoplada para validacion critica.

Nombre sugerido:

- `QuestionValidationProvider`

Para el MVP, es aceptable:

- Implementar solo validaciones deterministas.
- Crear un mock provider.
- Crear un prompt base sin conectarlo todavia a una IA real.

No se deben guardar claves, tokens ni secretos.

## 13. Prompt base de validacion

Crear o actualizar:

```text
/prompts/question-validator.md
```

Contenido minimo recomendado:

```markdown
# Question Validator Prompt

You are reviewing multiple-choice exam questions for a public exam study app.

Your job is not to approve questions automatically. Your job is to detect risks.

Review the question using only the provided source, excerpt and metadata.

Check:

1. Is the question clear?
2. Is there exactly one correct answer?
3. Are any options duplicated or too similar?
4. Is the explanation sufficient?
5. Is the answer supported by the provided source?
6. Could another option be defensible?
7. Is the wording ambiguous?
8. Is the question too easy, too vague or too dependent on interpretation?
9. Does the question rely on obsolete material?
10. Should this question be reviewed by a human?

Return a structured validation report with errors, warnings and suggested status.

Never mark a question as finally validated.
```

Si el proyecto esta principalmente en espanol, este prompt puede estar en espanol.

## 14. Validaciones minimas obligatorias

La validacion debe fallar con error critico si:

- Falta enunciado.
- Faltan opciones.
- Hay menos de 2 opciones.
- Hay cero respuestas correctas.
- Hay mas de una respuesta correcta.
- Falta explicacion.
- Falta fuente.
- La fuente esta obsoleta.
- El material vinculado esta obsoleto.
- Falta tema.
- El tema esta obsoleto.
- Falta dificultad.
- La dificultad es invalida.
- Hay opciones duplicadas.
- Existe otra pregunta con el mismo enunciado normalizado.

## 15. Tests automaticos obligatorios

Deben existir tests para comprobar:

- Una pregunta correcta pasa la validacion sin errores criticos.
- Una pregunta sin enunciado falla.
- Una pregunta sin opciones falla.
- Una pregunta con menos de 2 opciones falla.
- Una pregunta con cero respuestas correctas falla.
- Una pregunta con mas de una respuesta correcta falla.
- Una pregunta sin explicacion falla.
- Una pregunta sin fuente falla.
- Una pregunta con fuente obsoleta falla.
- Una pregunta con material obsoleto falla, si existe relacion con material.
- Una pregunta sin tema falla.
- Una pregunta con tema obsoleto falla, si existe `topic_id`.
- Una pregunta sin dificultad falla.
- Una pregunta con dificultad invalida falla.
- Una pregunta con opciones duplicadas falla.
- Una pregunta con enunciado duplicado exacto falla.
- Una pregunta con explicacion muy corta genera warning.
- Una pregunta con enunciado muy corto genera warning.
- Aplicar resultado con errores cambia la pregunta a `needs_fix`.
- Aplicar resultado sin errores cambia la pregunta a `pending_review`.
- Aplicar resultado nunca cambia la pregunta a `validated`.
- No se rompen los tests existentes de SPEC 001, SPEC 002, SPEC 003 y SPEC 004.

## 16. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe un modulo o servicio de validacion de preguntas.
- Se puede validar una pregunta individual.
- Se puede validar un lote de preguntas.
- La validacion devuelve errores, advertencias e informacion.
- Los errores tienen codigos claros.
- Las advertencias tienen codigos claros.
- Existe severidad por resultado.
- Existe recomendacion de estado.
- Las preguntas defectuosas pueden pasar a `needs_fix`.
- Las preguntas que pasan controles pueden pasar a `pending_review`.
- Ninguna validacion automatica pasa preguntas a `validated`.
- Existe prompt base `/prompts/question-validator.md`.
- Existen tests de reglas criticas.
- No se implementa validacion juridica avanzada.
- No se implementa revision visual compleja.
- No se implementa generacion de tests.
- No se anaden funcionalidades fuera del MVP.

## 17. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del repositorio.

Prioridades:

- Mantener compatibilidad con SPEC 001, SPEC 002, SPEC 003 y SPEC 004.
- No duplicar modelos de pregunta.
- Separar validacion formal de validacion critica.
- Mantener la validacion reutilizable.
- No convertir preguntas automaticamente en `validated`.
- Usar errores estructurados.
- Anadir tests.
- No sobredisenar.

La validacion debe poder reutilizarse despues en:

- Panel de revision.
- Generador de preguntas.
- Sistema de reportes.
- Generador de tests.
- Cobertura del temario.

## 18. Prompt para Claude

Claude, implementa la SPEC 005 - Question Validation & Quality Gate.

Estamos construyendo el MVP de TESTOPO.

Debes crear un modulo de validacion y control de calidad para preguntas.

Implementa:

- Servicio de validacion de preguntas.
- Validacion formal.
- Validacion basica de fuente.
- Validacion basica de tema.
- Validacion de dificultad.
- Deteccion de opciones duplicadas.
- Deteccion de enunciados duplicados exactos.
- Advertencias basicas de ambiguedad o baja calidad.
- Resultado estructurado de validacion.
- Validacion individual.
- Validacion por lote.
- Aplicacion controlada del resultado.
- Prompt base en `/prompts/question-validator.md`.
- Tests automaticos de reglas criticas.

No implementes todavia:

- Validacion juridica avanzada.
- Comparacion legal profunda.
- Correccion automatica completa.
- Revision visual avanzada.
- Generacion de tests finales.
- Estadisticas avanzadas.
- Sistema de reportes de usuarios.
- Usuarios.
- Autenticacion.

Regla central:

El validador puede detectar errores y recomendar estados, pero nunca debe convertir automaticamente una pregunta en `validated`.

Si una pregunta tiene errores criticos, debe poder pasar a `needs_fix`.

Si una pregunta no tiene errores criticos, debe poder pasar a `pending_review`.

La validacion definitiva sigue dependiendo de revision humana o accion explicita posterior.

Manten la implementacion simple, modular y compatible con SPEC 001, SPEC 002, SPEC 003 y SPEC 004. No rompas los tests existentes.
