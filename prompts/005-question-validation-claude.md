# Claude Prompt - SPEC 005 Question Validation & Quality Gate

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.

La SPEC 001 define preguntas, estados y validacion formal base. La SPEC 002 define materiales y fuentes trazables. La SPEC 003 define temas. La SPEC 004 genera preguntas como `draft` o `pending_review`.

Esta SPEC 005 debe crear una compuerta de calidad para detectar preguntas incompletas, ambiguas, duplicadas, mal estructuradas o no trazables antes de que lleguen al usuario.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/005-question-validation.md
```

Branch de trabajo:

```text
feature/question-validation
```

## Critical Rule

El validador puede detectar errores y recomendar estados, pero nunca debe convertir automaticamente una pregunta en `validated`.

Estados permitidos tras aplicar una validacion automatica:

- `draft`
- `pending_review`
- `needs_fix`

Reglas:

- Si hay errores criticos, el resultado recomendado debe ser `needs_fix`.
- Si no hay errores criticos, el resultado recomendado debe ser `pending_review`.
- Nunca recomendar ni aplicar `validated`.
- La validacion definitiva queda para revision humana o accion explicita posterior.

## Scope

Implementa:

- Servicio de validacion de preguntas.
- Validacion formal.
- Validacion basica de fuente.
- Validacion basica de tema.
- Validacion de dificultad.
- Deteccion de opciones duplicadas.
- Deteccion de respuesta correcta invalida.
- Deteccion de explicacion ausente o debil.
- Deteccion basica de enunciados problematicos.
- Deteccion de enunciados duplicados exactos.
- Informe estructurado por pregunta.
- Validacion individual.
- Validacion por lote.
- Validacion de preguntas pendientes, si encaja de forma simple.
- Aplicacion controlada del resultado.
- Consulta del ultimo informe, si se guarda historial sin complicar el MVP.
- Prompt base en `/prompts/question-validator.md`.
- Tests automaticos de reglas criticas.

## Existing Integration Requirements

Conecta con:

- SPEC 001: usa el modelo `Question`, `QuestionService`, estados existentes y validaciones formales existentes cuando encaje.
- SPEC 002: valida fuentes y materiales vinculados; material `obsolete` debe ser error critico.
- SPEC 003: valida `topic` y `topic_id`; tema `obsolete` debe ser error critico.
- SPEC 004: las preguntas generadas deben poder pasar por este validador.

No dupliques modelos de pregunta.

No crees un segundo banco de preguntas.

No rompas tests existentes de SPEC 001, SPEC 002, SPEC 003 y SPEC 004.

## Validation Layers

### Formal Validation

Debe revisar:

- Existe enunciado.
- Existen opciones.
- Hay al menos 2 opciones.
- Hay exactamente una opcion correcta.
- La respuesta correcta existe entre las opciones.
- Existe explicacion.
- Existe fuente.
- Existe `topic` o `topic_id`.
- Existe dificultad valida.
- Existe estado valido.
- No hay opciones duplicadas.

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

### Source Validation

Debe revisar:

- La fuente existe.
- La fuente no esta `obsolete`.
- Si existe `source.material_id`, el material existe.
- El material vinculado no esta `obsolete`.
- Existe `reference` o `excerpt` cuando sea posible.

Errores recomendados:

- `QUESTION_SOURCE_NOT_FOUND`
- `QUESTION_SOURCE_MATERIAL_NOT_FOUND`
- `QUESTION_SOURCE_OBSOLETE`
- `QUESTION_SOURCE_MATERIAL_OBSOLETE`
- `QUESTION_SOURCE_REFERENCE_MISSING`
- `QUESTION_SOURCE_EXCERPT_MISSING`

Para MVP, falta de `reference` o `excerpt` puede ser warning en vez de error critico.

### Topic Validation

Debe revisar:

- Existe `topic` textual o `topic_id`.
- Si hay `topic_id`, el tema existe.
- El tema no esta `obsolete`.

Errores recomendados:

- `QUESTION_TOPIC_NOT_FOUND`
- `QUESTION_TOPIC_OBSOLETE`

### Difficulty Validation

Valores finales permitidos en preguntas:

- `easy`
- `medium`
- `hard`

`mixed` solo puede usarse como entrada de SPEC 004, no como dificultad final de pregunta.

### Duplicate Validation

Detecta duplicado exacto de enunciado.

Normalizacion recomendada:

- Quitar espacios sobrantes.
- Ignorar mayusculas y minusculas.
- Ignorar saltos de linea repetidos.

Error recomendado:

- `QUESTION_DUPLICATE_STATEMENT`

No implementes deteccion semantica avanzada.

### Basic Ambiguity / Quality Warnings

Detecta senales simples:

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

Estas senales no tienen por que bloquear, pero deben aparecer en el informe.

## Severity

Cada hallazgo debe tener severidad:

- `error`
- `warning`
- `info`

`error` bloquea avance automatico a `pending_review`.

`warning` exige revision, pero no bloquea necesariamente.

`info` da contexto util.

## Result Model

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

Valores recomendados de `status`:

- `passed`
- `failed`
- `passed_with_warnings`

`passed` debe ser `true` solo si no hay errores criticos.

`recommended_status` solo puede ser:

- `pending_review`
- `needs_fix`

No recomendar `validated`.

## Required Operations

Implementa:

### Validate One Question

Entrada:

- `question_id`

Salida:

- `QuestionValidationResult`

### Validate Many Questions

Entrada:

- `question_ids`

Salida:

- `QuestionValidationResult[]`

Debe poder validar lote sin detener todo el proceso por un unico fallo.

### Validate Pending Questions

Si es sencillo, valida preguntas con estado:

- `draft`
- `pending_review`
- `needs_fix`

No tocar preguntas `validated` salvo peticion explicita.

### Apply Validation Result

Debe aplicar solo:

- Con errores criticos: `needs_fix`.
- Sin errores criticos: `pending_review`.

Nunca aplicar `validated`.

### Last Validation Report

Si se guarda historial, permitir consultar el ultimo informe asociado a una pregunta.

## Prompt File

Crea o actualiza:

```text
/prompts/question-validator.md
```

Debe dejar claro:

- El objetivo es detectar riesgos, no aprobar automaticamente.
- Revisar solo con fuente, excerpt y metadatos proporcionados.
- Comprobar claridad, respuesta unica, duplicados, explicacion, soporte en fuente, ambiguedad, material obsoleto y necesidad de revision humana.
- Devolver informe estructurado con errores, warnings y estado sugerido.
- Nunca marcar una pregunta como finalmente validada.

## Out of Scope

No implementes:

- Validacion juridica avanzada.
- Comparacion automatica avanzada contra leyes.
- Razonamiento legal profundo.
- OCR.
- Extraccion avanzada de documentos.
- Correccion automatica completa de preguntas.
- Validacion automatica como `validated`.
- Revision visual avanzada.
- Panel visual avanzado.
- Sistema de reportes de usuarios.
- Estadisticas avanzadas.
- Generacion de tests finales.
- Recomendaciones de estudio.
- Usuarios.
- Autenticacion.
- Integracion real con IA externa si no existe infraestructura ya definida.

## Required Tests

Incluye tests automaticos para comprobar:

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

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar tests.
- Confirmacion de que no se implemento validacion juridica avanzada, revision visual compleja, generacion de tests, usuarios, autenticacion, reportes de usuarios ni estadisticas avanzadas.
- Confirmacion de que el validador genera informes claros con errores, warnings e info.
- Confirmacion de que aplicar resultados nunca pasa una pregunta a `validated`.
- Confirmacion de conexion con SPEC 001, SPEC 002, SPEC 003 y SPEC 004.
- Confirmacion de que no se rompen tests existentes.
