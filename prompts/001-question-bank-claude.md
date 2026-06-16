# Claude Prompt - SPEC 001 Question Bank

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

La prioridad absoluta del producto es la fiabilidad del banco de preguntas. Una pregunta no es valida porque la IA la haya generado; solo es valida si tiene fuente concreta, explicacion verificable, una unica respuesta correcta, tema, dificultad y controles de calidad.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/001-question-bank.md
```

Branch de trabajo:

```text
feature/question-bank
```

## Scope

Crea el primer modulo funcional del proyecto: el banco basico de preguntas.

Debes implementar:

- Modelo de pregunta.
- Modelo de opcion de respuesta.
- Modelo basico de fuente.
- Estados de pregunta permitidos:
  - `draft`
  - `pending_review`
  - `validated`
  - `rejected`
  - `needs_fix`
  - `obsolete`
- Dificultades permitidas:
  - `easy`
  - `medium`
  - `hard`
- Tipos de fuente recomendados:
  - `syllabus`
  - `old_test`
  - `official_exam`
  - `law`
  - `notes`
  - `other`
- Estados de fuente recomendados:
  - `active`
  - `deprecated`
  - `obsolete`
  - `needs_review`
- Validaciones obligatorias.
- Crear pregunta en estado `draft`.
- Listar preguntas.
- Ver una pregunta por ID.
- Editar una pregunta y actualizar `updated_at`.
- Cambiar estado de pregunta.
- Bloquear el paso a `validated` si la pregunta no cumple todas las reglas.
- Tests automaticos para las reglas criticas.

## Out of Scope

No implementes:

- Generacion de preguntas con IA.
- Subida real de documentos.
- Procesamiento de PDFs.
- Mapa completo del temario.
- Generacion de tests aleatorios.
- Panel visual avanzado.
- Autenticacion.
- Usuarios.
- Estadisticas.
- Reportes de preguntas.
- Simulacros de examen.
- Sistema de pagos.
- Integraciones externas.
- Arquitectura compleja o dependencias innecesarias.

## Business Rules

- Una pregunta solo puede pasar a `validated` si cumple todas las reglas de validacion.
- Solo preguntas con estado `validated` podran aparecer mas adelante en tests normales.
- Para el MVP solo se permiten preguntas tipo test con una unica respuesta correcta.
- No se puede validar una pregunta con cero respuestas correctas.
- No se puede validar una pregunta con mas de una respuesta correcta.
- No se puede validar una pregunta sin enunciado.
- No se puede validar una pregunta sin explicacion.
- No se puede validar una pregunta sin fuente.
- No se puede validar una pregunta sin tema.
- No se puede validar una pregunta sin dificultad valida.
- No se puede validar una pregunta si su fuente esta marcada como `obsolete`.
- No se puede validar una pregunta con opciones duplicadas.
- La comparacion de opciones duplicadas debe ignorar espacios sobrantes y, si es razonable, diferencias simples entre mayusculas y minusculas.
- Una pregunta marcada como `obsolete` no debe poder pasar directamente a `validated` sin ser editada o revisada.
- Una pregunta en estado `draft` puede existir aunque todavia no cumpla todas las reglas de validacion.

## Validation Errors

La validacion debe devolver errores claros. Usa estos codigos como referencia obligatoria:

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
- `QUESTION_SOURCE_OBSOLETE`
- `QUESTION_OBSOLETE_CANNOT_BE_VALIDATED`

## Required Tests

Incluye tests automaticos para comprobar, como minimo:

- Se puede crear una pregunta en estado `draft`.
- Una pregunta valida puede pasar a `validated`.
- Una pregunta sin enunciado no puede pasar a `validated`.
- Una pregunta sin explicacion no puede pasar a `validated`.
- Una pregunta sin fuente no puede pasar a `validated`.
- Una pregunta sin tema no puede pasar a `validated`.
- Una pregunta sin dificultad no puede pasar a `validated`.
- Una pregunta con dificultad invalida no puede pasar a `validated`.
- Una pregunta con cero respuestas correctas no puede pasar a `validated`.
- Una pregunta con mas de una respuesta correcta no puede pasar a `validated`.
- Una pregunta con opciones duplicadas no puede pasar a `validated`.
- Una pregunta con fuente `obsolete` no puede pasar a `validated`.
- Una pregunta en estado `obsolete` no puede pasar directamente a `validated`.
- Al editar una pregunta se actualiza `updated_at`.

## Implementation Notes

Adapta la implementacion al stack existente del repositorio.

Si todavia no hay framework elegido, implementa la solucion minima y mas clara posible. Evita elegir un stack complejo si no es necesario para cumplir la spec.

Prioridades:

- Simplicidad.
- Codigo legible.
- Validaciones explicitas.
- Tests de reglas criticas.
- Separacion entre logica de validacion y cualquier capa de presentacion o transporte.
- Sin dependencias innecesarias.

La logica de validacion debe quedar separada para poder reutilizarse mas adelante en:

- Panel de administracion.
- Generador de preguntas con IA.
- Generador de tests.
- Sistema de reportes.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar los tests.
- Confirmacion explicita de que no has implementado IA, generacion de tests, usuarios, autenticacion, panel avanzado, reportes ni estadisticas.
- Cualquier decision tecnica minima tomada por falta de stack definido.
