# Claude Prompt - SPEC 003 Topic Map

## Context

TESTOPO es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.

La SPEC 001 define que toda pregunta validada debe tener un tema. La SPEC 002 define que todo material puede actuar como fuente trazable. Esta SPEC 003 debe crear el mapa basico del temario para clasificar materiales y preguntas por temas, apartados y subapartados.

Codex coordina y revisa. Claude implementa el codigo.

## Spec

Implementa estrictamente:

```text
/docs/specs/003-topic-map.md
```

Branch de trabajo:

```text
feature/topic-map
```

## Scope

Crea el modulo basico de mapa del temario.

Debes implementar:

- Modelo de tema, llamado `Topic`, `SyllabusTopic` o similar segun el estilo actual.
- Estados permitidos de tema:
  - `active`
  - `needs_review`
  - `deprecated`
  - `obsolete`
- Jerarquia mediante `parent_id`.
- Creacion manual de temas.
- Listado de temas.
- Consulta de tema por ID.
- Edicion de temas.
- Cambio de estado.
- Vista o funcion de arbol de temas.
- Vinculacion de materiales a temas.
- Desvinculacion de materiales de temas.
- Relacion basica o preparacion clara de relacion entre preguntas y temas.
- Conteo basico de preguntas por tema, solo si encaja de forma sencilla con el stack actual.
- Validaciones obligatorias.
- Tests automaticos de reglas criticas.

## Topic Model

El modelo debe tener, como minimo:

- `id`
- `title`
- `description`
- `code`
- `parent_id`
- `order`
- `status`
- `created_at`
- `updated_at`

## Relationship With Material

Debe poder vincularse un material de la SPEC 002 con uno o varios temas.

Modelo recomendado de relacion:

- `material_id`
- `topic_id`
- `reference`
- `created_at`

Reglas:

- `material_id` debe apuntar a un material existente.
- `topic_id` debe apuntar a un tema existente.
- `reference` puede indicar pagina, articulo, capitulo, apartado o fragmento.
- Debe poder desvincularse material y tema sin borrar ninguno de los dos.
- No debe permitirse vincular un material inexistente.

## Relationship With Questions

La SPEC 001 ya tiene `Question.topic`.

Con esta spec, `Question.topic` debe poder vincularse a un `Topic` real o quedar preparado de forma clara.

Opciones aceptables para el MVP:

- Mantener `topic` como texto y anadir `topic_id` opcional.
- Sustituir `topic` por relacion directa a `Topic` solo si no rompe SPEC 001.
- Permitir ambos temporalmente: `topic` como texto visible y `topic_id` como relacion interna.

Prioridad absoluta:

- No romper el banco de preguntas ya implementado.
- No romper tests de SPEC 001.
- No romper tests de SPEC 002.

## Out of Scope

No implementes:

- IA para detectar temas automaticamente.
- Generacion automatica de preguntas.
- Extraccion automatica de indices desde PDF o DOCX.
- Procesamiento avanzado de PDFs o DOCX.
- OCR.
- Simulacros de examen.
- Generacion de tests.
- Estadisticas avanzadas.
- Recomendaciones de estudio.
- Reordenacion automatica del temario.
- Comparacion entre convocatorias.
- Usuarios.
- Autenticacion.
- Panel visual complejo.
- Dependencias innecesarias.
- Arquitectura compleja.

## Business Rules

- No basta con tener muchas preguntas: el sistema debe saber a que parte del temario pertenece cada pregunta.
- Una pregunta validada debe estar asociada a un tema.
- Idealmente, una pregunta validada debe asociarse a un `Topic` activo.
- Una pregunta no deberia validarse si esta asociada unicamente a un tema `obsolete`; si esto requiere demasiado cambio en SPEC 001, deja la regla preparada y documentada.
- No debe permitirse que un tema sea padre de si mismo.
- No deben permitirse ciclos en la jerarquia.
- No se puede crear un tema sin titulo.
- No se puede crear o actualizar un tema con estado invalido.
- El campo `order`, si existe, debe poder usarse para mostrar temas en orden dentro del mismo padre.
- Para el MVP, evita borrado fisico de temas; marca como `obsolete`.

## Validation Errors

La validacion debe devolver errores claros. Usa estos codigos como referencia:

- `TOPIC_TITLE_REQUIRED`
- `TOPIC_INVALID_STATUS`
- `TOPIC_PARENT_NOT_FOUND`
- `TOPIC_CANNOT_BE_OWN_PARENT`
- `TOPIC_HIERARCHY_CYCLE_DETECTED`
- `TOPIC_NOT_FOUND`
- `MATERIAL_NOT_FOUND`
- `QUESTION_NOT_FOUND`
- `TOPIC_MATERIAL_LINK_ALREADY_EXISTS`

## Required Operations

Implementa:

- Crear tema raiz.
- Crear subtema con padre.
- Listar temas con filtros sencillos si encajan:
  - Por estado.
  - Por padre.
  - Por texto de busqueda.
- Obtener arbol de temas.
- Consultar tema por ID.
- Editar tema y actualizar `updated_at`.
- Cambiar estado.
- Vincular material existente a tema existente.
- Desvincular material de tema.
- Vincular pregunta a tema, si encaja con el modelo actual sin romper SPEC 001.

## Basic Coverage

Si encaja de forma sencilla, anade una funcion u operacion de cobertura basica por tema con:

- `topic_id`
- `topic_title`
- `total_questions`
- `validated_questions`
- `draft_questions`
- `needs_fix_questions`
- `linked_materials`

No implementes estadisticas avanzadas.

## Required Tests

Incluye tests automaticos para comprobar, como minimo:

- Se puede crear un tema raiz.
- Se puede crear un subtema con padre.
- No se puede crear un tema sin titulo.
- No se puede crear un tema con estado invalido.
- No se puede asignar un tema como padre de si mismo.
- No se pueden crear ciclos en la jerarquia.
- Se pueden listar temas.
- Se puede obtener arbol de temas.
- Se puede consultar un tema por ID.
- Se puede editar un tema.
- Al editar un tema se actualiza `updated_at`.
- Se puede marcar un tema como `obsolete`.
- Se puede vincular material a tema.
- Se puede desvincular material de tema.
- No se puede vincular un material inexistente.
- No se rompen los tests existentes de SPEC 001 y SPEC 002.

Si implementas vinculacion de preguntas a temas, anade tests para:

- Se puede vincular una pregunta a un tema.
- No se puede vincular una pregunta a un tema inexistente.
- Una pregunta validada mantiene tema asociado.

## Implementation Notes

Adapta la implementacion al stack actual del repositorio.

Prioridades:

- Simplicidad.
- Compatibilidad con SPEC 001 y SPEC 002.
- Modelo jerarquico claro.
- Validaciones explicitas.
- Tests automaticos.
- No romper funcionalidades existentes.
- No sobredisenar.

La logica de temas debe quedar preparada para futuras specs como generacion de preguntas por tema, cobertura del temario, simulacros por bloques, repaso de temas debiles y estadisticas de aciertos por tema, pero no debes implementar esas funcionalidades ahora.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Explicacion breve de como ejecutar los tests.
- Confirmacion explicita de que no has implementado IA, generacion de preguntas, extraccion automatica de indices, procesamiento avanzado de documentos, OCR, usuarios, autenticacion, panel complejo, generacion de tests ni estadisticas avanzadas.
- Confirmacion de como conectaste `Topic` con `Material`.
- Confirmacion de como conectaste o preparaste `Topic` con `Question.topic`.
- Confirmacion de que no se rompen los tests de SPEC 001 y SPEC 002.
