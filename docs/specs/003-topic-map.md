# SPEC 003 - Topic Map

## 1. Objetivo

Crear el modulo basico de mapa del temario para TESTOPO.

Este modulo debe permitir organizar el contenido de la oposicion en temas, apartados y subapartados.

El objetivo no es todavia analizar documentos automaticamente ni generar preguntas. El objetivo es tener una estructura clara para clasificar materiales y preguntas.

## 2. Contexto MVP

TESTOPO es una app para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

Ya existen:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.

La SPEC 001 definio que toda pregunta debe tener un tema.

La SPEC 002 definio que todo material debe poder servir como fuente.

Esta SPEC 003 crea el mapa de temas que permitira ordenar el banco de preguntas y medir la cobertura del temario.

Principio central:

> No basta con tener muchas preguntas. El sistema debe saber a que parte del temario pertenece cada pregunta.

## 3. Branch recomendada

```text
feature/topic-map
```

## 4. Alcance

Claude debe implementar un modulo basico para gestionar temas del temario.

Debe incluir:

- Modelo de tema.
- Jerarquia basica de temas y subtemas.
- Creacion manual de temas.
- Listado de temas.
- Vista en arbol o estructura jerarquica.
- Consulta de un tema por ID.
- Edicion de temas.
- Cambio de estado de temas.
- Relacion basica entre tema y material.
- Relacion basica entre tema y preguntas.
- Conteo basico de preguntas por tema, si el stack lo permite de forma sencilla.
- Tests automaticos de reglas criticas.

## 5. Fuera de alcance

No debe implementarse todavia:

- IA para detectar temas automaticamente.
- Extraccion automatica de indice desde PDF o DOCX.
- Procesamiento avanzado de documentos.
- OCR.
- Generacion automatica de preguntas.
- Simulacros de examen.
- Estadisticas avanzadas.
- Recomendaciones de estudio.
- Reordenacion automatica del temario.
- Comparacion entre convocatorias.
- Sistema de usuarios.
- Panel visual complejo.

Esta spec solo cubre la estructura basica del temario.

## 6. Modelo de tema

Crear un modelo llamado `Topic`, `SyllabusTopic` o similar.

Campos minimos:

- `id`
- `title`
- `description`
- `code`
- `parent_id`
- `order`
- `status`
- `created_at`
- `updated_at`

## 7. Descripcion de campos

### id

Identificador unico del tema.

### title

Nombre del tema o apartado.

Ejemplos:

- Tema 1 - Constitucion Espanola
- Derechos fundamentales
- Articulo 14
- Procedimiento administrativo
- Recursos administrativos

Debe ser obligatorio.

### description

Descripcion opcional del tema.

### code

Codigo opcional para ordenar o identificar el tema.

Ejemplos:

- `T1`
- `T1.1`
- `T1.1.1`
- `B2-T4`

Debe poder estar vacio, pero si existe debe poder usarse para ordenar o localizar temas.

### parent_id

Referencia opcional a otro tema padre.

Permite crear jerarquia:

```text
Bloque 1
  Tema 1
    Apartado 1.1
    Apartado 1.2
```

Un tema raiz tendra `parent_id` vacio o nulo.

### order

Numero de orden dentro del mismo nivel.

Sirve para mostrar los temas en orden logico.

### status

Estado del tema.

Valores permitidos:

- `active`
- `needs_review`
- `deprecated`
- `obsolete`

Estado inicial recomendado:

- `active`

### created_at

Fecha de creacion.

### updated_at

Fecha de ultima modificacion.

## 8. Relacion con materiales

Debe poder vincularse un material de la SPEC 002 con uno o varios temas.

Ejemplos:

- Material: `Tema 1 Constitucion.pdf`
- Tema vinculado: `Tema 1 - Constitucion Espanola`

Otro ejemplo:

- Material: `Ley 39/2015.pdf`
- Temas vinculados:
  - Procedimiento administrativo
  - Recursos administrativos
  - Silencio administrativo

Modelo recomendado de relacion:

- `material_id`
- `topic_id`
- `reference`
- `created_at`

Donde `reference` puede indicar una pagina, articulo, capitulo o fragmento.

Ejemplos:

- Pagina 12
- Articulo 14
- Capitulo II
- Apartado 3.1

## 9. Relacion con preguntas

La SPEC 001 ya definio que cada pregunta debe tener un `topic`.

Con esta spec, `Question.topic` debe poder vincularse a un `Topic` real.

Si en la implementacion actual `topic` es un texto simple, Claude debe adaptar el modelo de la forma menos invasiva posible.

Opciones aceptables para el MVP:

1. Mantener `topic` como texto y anadir `topic_id` opcional.
2. Sustituir `topic` por una relacion directa a `Topic`, solo si no rompe la SPEC 001.
3. Permitir ambos temporalmente: `topic` como texto visible y `topic_id` como relacion interna.

La prioridad es no romper el banco de preguntas ya implementado.

## 10. Reglas de negocio

### 10.1 Tema obligatorio para preguntas validadas

Una pregunta validada debe estar asociada a un tema.

Con esta spec, lo ideal es que este asociada a un `Topic` activo.

### 10.2 Tema obsoleto

Una pregunta no deberia validarse si esta asociada unicamente a un tema `obsolete`.

Si esta regla requiere demasiados cambios en la SPEC 001, puede dejarse preparada y documentada para una integracion posterior.

### 10.3 Jerarquia valida

No debe permitirse que un tema sea padre de si mismo.

No debe permitirse crear ciclos en la jerarquia.

Ejemplo invalido:

```text
Tema A es padre de Tema B
Tema B es padre de Tema C
Tema C es padre de Tema A
```

### 10.4 Titulo obligatorio

No se puede crear un tema sin titulo.

### 10.5 Estado valido

No se puede crear o actualizar un tema con un estado no permitido.

### 10.6 Orden

Si existe campo `order`, debe poder usarse para mostrar temas en orden dentro del mismo padre.

No hace falta implementar reordenacion avanzada en esta spec.

### 10.7 Borrado de temas

Para el MVP es preferible no borrar temas fisicamente.

Recomendacion:

- Permitir marcar un tema como `obsolete`.
- Evitar borrado fisico si el tema tiene preguntas o materiales vinculados.

## 11. Operaciones minimas

Claude debe implementar estas operaciones segun el stack existente.

### 11.1 Crear tema

Debe permitir crear un tema con:

- Titulo.
- Descripcion opcional.
- Codigo opcional.
- Padre opcional.
- Orden opcional.
- Estado.

Por defecto, el estado debe ser `active`.

### 11.2 Listar temas

Debe permitir listar temas.

Filtros recomendados:

- Por estado.
- Por padre.
- Por texto de busqueda, si es sencillo.

### 11.3 Ver arbol de temas

Debe permitir obtener los temas en estructura jerarquica.

Ejemplo:

```json
[
  {
    "title": "Bloque 1",
    "children": [
      {
        "title": "Tema 1",
        "children": [
          {
            "title": "Apartado 1.1"
          }
        ]
      }
    ]
  }
]
```

### 11.4 Consultar tema por ID

Debe permitir ver un tema concreto.

### 11.5 Editar tema

Debe permitir editar:

- Titulo.
- Descripcion.
- Codigo.
- Padre.
- Orden.
- Estado.

Debe actualizar `updated_at`.

### 11.6 Cambiar estado

Debe permitir marcar un tema como:

- `active`
- `needs_review`
- `deprecated`
- `obsolete`

### 11.7 Vincular material a tema

Debe permitir vincular un material existente a un tema existente.

Debe poder guardar una referencia opcional.

### 11.8 Desvincular material de tema

Debe permitir quitar la relacion entre material y tema.

No debe borrar ni el material ni el tema.

### 11.9 Vincular pregunta a tema

Debe permitir asociar una pregunta existente a un tema existente, si el modelo de la SPEC 001 lo permite.

Si la integracion directa complica demasiado la implementacion, debe dejarse preparada de forma clara y documentada.

## 12. Cobertura basica del temario

Para el MVP seria util tener un conteo basico por tema.

Si el stack lo permite de forma sencilla, anadir una operacion o funcion que devuelva:

- `topic_id`
- `topic_title`
- `total_questions`
- `validated_questions`
- `draft_questions`
- `needs_fix_questions`
- `linked_materials`

Esto servira mas adelante para detectar:

- Temas sin preguntas.
- Temas con pocas preguntas.
- Temas con muchas preguntas pendientes de revision.
- Temas con material cargado pero sin preguntas.

No implementar estadisticas avanzadas todavia.

## 13. Validaciones minimas

No se puede crear o actualizar un tema si:

- Falta titulo.
- El estado es invalido.
- El padre indicado no existe.
- El tema intenta ser padre de si mismo.
- El cambio de padre genera un ciclo en la jerarquia.

Errores recomendados:

- `TOPIC_TITLE_REQUIRED`
- `TOPIC_INVALID_STATUS`
- `TOPIC_PARENT_NOT_FOUND`
- `TOPIC_CANNOT_BE_OWN_PARENT`
- `TOPIC_HIERARCHY_CYCLE_DETECTED`
- `TOPIC_NOT_FOUND`
- `MATERIAL_NOT_FOUND`
- `QUESTION_NOT_FOUND`
- `TOPIC_MATERIAL_LINK_ALREADY_EXISTS`

## 14. Tests automaticos obligatorios

Deben existir tests para comprobar:

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

Si se implementa vinculacion de preguntas a temas, anadir tests para:

- Se puede vincular una pregunta a un tema.
- No se puede vincular una pregunta a un tema inexistente.
- Una pregunta validada mantiene tema asociado.

## 15. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe un modelo de tema.
- Existen estados controlados para temas.
- Se puede crear un tema.
- Se puede crear jerarquia de temas.
- Se puede listar temas.
- Se puede obtener arbol de temas.
- Se puede consultar un tema concreto.
- Se puede editar un tema.
- Se puede marcar un tema como obsoleto.
- Se puede vincular material a tema.
- Se puede desvincular material de tema.
- La relacion con preguntas queda implementada o preparada sin romper SPEC 001.
- Existen validaciones contra jerarquias invalidas.
- Existen tests de reglas criticas.
- No se implementa IA.
- No se implementa generacion de preguntas.
- No se implementa procesamiento avanzado de documentos.
- No se anaden funcionalidades fuera del MVP.

## 16. Notas tecnicas para Claude

Claude debe adaptarse al stack actual del repositorio.

Prioridades:

- Simplicidad.
- Compatibilidad con SPEC 001 y SPEC 002.
- Modelo jerarquico claro.
- Validaciones explicitas.
- Tests automaticos.
- No romper funcionalidades existentes.
- No sobredisenar.

La logica de temas debe quedar preparada para futuras specs:

- Generacion de preguntas por tema.
- Cobertura del temario.
- Simulacros por bloques.
- Repaso de temas debiles.
- Estadisticas de aciertos por tema.

Pero esta spec no debe implementar esas funcionalidades todavia.

## 17. Prompt para Claude

Claude, implementa la SPEC 003 - Topic Map.

Estamos construyendo el MVP de TESTOPO.

Debes crear el modulo basico de mapa del temario para que el sistema pueda organizar materiales y preguntas por temas, apartados y subapartados.

Implementa:

- Modelo de tema.
- Estados permitidos de tema.
- Jerarquia mediante `parent_id`.
- Creacion de temas.
- Listado de temas.
- Consulta de tema por ID.
- Edicion de temas.
- Cambio de estado.
- Vista o funcion de arbol de temas.
- Vinculacion de materiales a temas.
- Desvinculacion de materiales de temas.
- Relacion basica o preparacion de relacion entre preguntas y temas.
- Validaciones obligatorias.
- Tests automaticos.

No implementes todavia:

- IA.
- Generacion automatica de preguntas.
- Extraccion automatica de indices.
- Procesamiento avanzado de PDFs o DOCX.
- OCR.
- Generacion de tests.
- Estadisticas avanzadas.
- Usuarios.
- Autenticacion.
- Panel visual complejo.

Regla central:

El mapa de temas debe servir para clasificar el material y las preguntas. El sistema debe evitar jerarquias invalidas y debe mantener compatibilidad con el banco de preguntas y el registro de materiales ya implementados.

Manten la implementacion simple, modular y compatible con SPEC 001 y SPEC 002. No rompas los tests existentes.
