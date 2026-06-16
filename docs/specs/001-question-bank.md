# SPEC 001 - Question Bank

## 1. Objetivo

Crear el primer modulo funcional del proyecto: el banco de preguntas.

Este modulo debe permitir representar, crear, listar, editar y validar preguntas tipo test de respuesta unica.

El objetivo no es todavia generar preguntas con IA ni crear tests completos. El objetivo es definir una base solida para guardar preguntas fiables, trazables y revisables.

## 2. Contexto

TESTOPO sera una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

El principio central del proyecto es:

> Una pregunta no es valida porque la IA la haya generado.
> Una pregunta solo es valida si tiene fuente, explicacion, una unica respuesta correcta y controles de calidad.

Por tanto, el banco de preguntas debe impedir desde el inicio que una pregunta sea considerada valida si no cumple las reglas minimas de calidad.

## 3. Branch recomendada

```text
feature/question-bank
```

## 4. Alcance

Claude debe implementar el modelo base de preguntas y las operaciones minimas del banco de preguntas.

Debe incluir:

- Modelo de pregunta.
- Modelo de opcion de respuesta.
- Modelo basico de fuente.
- Estados de pregunta.
- Dificultades permitidas.
- Validaciones obligatorias.
- Crear pregunta.
- Listar preguntas.
- Ver una pregunta.
- Editar pregunta.
- Cambiar estado de pregunta.
- Validar si una pregunta puede pasar a `validated`.
- Tests automaticos de las reglas criticas.

## 5. Fuera de alcance

No debe implementarse todavia:

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

Esta spec solo cubre el banco basico de preguntas.

## 6. Modelo de pregunta

Una pregunta debe tener como minimo:

- `id`
- `statement`
- `options`
- `correct_answer`
- `explanation`
- `source`
- `topic`
- `difficulty`
- `status`
- `created_at`
- `updated_at`

Descripcion de campos:

### id

Identificador unico de la pregunta.

### statement

Enunciado de la pregunta.

Debe ser obligatorio.

### options

Lista de opciones de respuesta.

Para el MVP debe haber minimo 2 opciones.

Recomendacion inicial: permitir 2, 3 o 4 opciones, aunque el uso principal sera 4 opciones.

Cada opcion debe tener:

- `id`
- `text`
- `is_correct`
- `order`

### correct_answer

Referencia a la opcion correcta.

Debe existir exactamente una opcion correcta.

### explanation

Explicacion de por que la respuesta correcta es valida.

Debe ser obligatoria para validar una pregunta.

### source

Fuente de la pregunta.

Debe ser obligatoria.

Puede ser inicialmente un objeto simple o una referencia con estos campos minimos:

- `id`
- `title`
- `type`
- `reference`
- `status`

Tipos recomendados de fuente:

- `syllabus`
- `old_test`
- `official_exam`
- `law`
- `notes`
- `other`

Estados recomendados de fuente:

- `active`
- `deprecated`
- `obsolete`
- `needs_review`

Una pregunta no puede validarse si su fuente esta en estado `obsolete`.

### topic

Tema del temario al que pertenece la pregunta.

Debe ser obligatorio.

En esta spec puede ser un campo simple de texto o una referencia basica.

### difficulty

Dificultad estimada.

Valores permitidos:

- `easy`
- `medium`
- `hard`

Debe ser obligatoria para validar una pregunta.

### status

Estado de la pregunta.

Valores permitidos:

- `draft`
- `pending_review`
- `validated`
- `rejected`
- `needs_fix`
- `obsolete`

Estado inicial recomendado:

- `draft`

### created_at

Fecha de creacion.

### updated_at

Fecha de ultima modificacion.

## 7. Reglas de negocio

### 7.1 Regla principal

Una pregunta solo puede pasar a `validated` si cumple todas las reglas de validacion.

### 7.2 Preguntas en tests normales

Aunque la generacion de tests no se implementa en esta spec, debe quedar preparada la regla:

Solo preguntas con estado `validated` podran aparecer en tests normales.

### 7.3 Respuesta unica

Para el MVP solo se permiten preguntas tipo test con una unica respuesta correcta.

No debe permitirse validar una pregunta con:

- Cero respuestas correctas.
- Mas de una respuesta correcta.

### 7.4 Explicacion obligatoria

No se puede validar una pregunta sin explicacion.

### 7.5 Fuente obligatoria

No se puede validar una pregunta sin fuente.

### 7.6 Tema obligatorio

No se puede validar una pregunta sin tema.

### 7.7 Dificultad obligatoria

No se puede validar una pregunta sin dificultad valida.

### 7.8 Fuente obsoleta

No se puede validar una pregunta si su fuente esta marcada como `obsolete`.

### 7.9 Opciones duplicadas

No se puede validar una pregunta si tiene opciones duplicadas.

La comparacion debe ignorar espacios sobrantes y, si es razonable, diferencias simples entre mayusculas y minusculas.

### 7.10 Estado obsoleto

Una pregunta marcada como `obsolete` no debe poder pasar directamente a `validated` sin ser editada o revisada.

## 8. Validaciones minimas

Una pregunta no puede pasar a `validated` si:

- No tiene enunciado.
- No tiene opciones.
- Tiene menos de 2 opciones.
- No tiene exactamente una opcion correcta.
- No tiene explicacion.
- No tiene fuente.
- No tiene tema.
- No tiene dificultad.
- Tiene dificultad invalida.
- Tiene estado invalido.
- Tiene opciones duplicadas.
- La fuente esta marcada como `obsolete`.
- La pregunta esta marcada como `obsolete`.

La validacion debe devolver errores claros, por ejemplo:

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

## 9. Operaciones minimas

Claude debe implementar las operaciones minimas segun el stack existente o la estructura creada en la SPEC 000.

Si todavia no hay stack definido, debe hacerlo de la forma mas simple posible, evitando sobrediseno.

Operaciones necesarias:

### 9.1 Crear pregunta

Debe permitir crear una pregunta en estado `draft`.

Debe guardar:

- Enunciado.
- Opciones.
- Respuesta correcta.
- Explicacion, si existe.
- Fuente, si existe.
- Tema.
- Dificultad.
- Estado.

No es obligatorio que una pregunta en `draft` cumpla todas las reglas de validacion.

### 9.2 Listar preguntas

Debe permitir obtener una lista de preguntas.

Filtros recomendados, si son sencillos de implementar:

- Por estado.
- Por dificultad.
- Por tema.

Si estos filtros complican demasiado la primera implementacion, pueden dejarse preparados pero no desarrollados.

### 9.3 Ver pregunta

Debe permitir consultar una pregunta concreta por ID.

### 9.4 Editar pregunta

Debe permitir editar campos de una pregunta.

Al editar, debe actualizarse `updated_at`.

### 9.5 Cambiar estado

Debe permitir cambiar el estado de una pregunta.

Si el nuevo estado es `validated`, debe ejecutarse la validacion completa.

Si la validacion falla, el cambio de estado debe rechazarse y devolver errores claros.

## 10. Tests automaticos obligatorios

Deben existir tests para comprobar, como minimo:

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

## 11. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe un modelo de pregunta.
- Existe un modelo de opcion de respuesta.
- Existe un modelo basico de fuente.
- Existen estados controlados para preguntas.
- Existen dificultades controladas.
- Se puede crear una pregunta en `draft`.
- Se puede listar preguntas.
- Se puede consultar una pregunta.
- Se puede editar una pregunta.
- Se puede intentar cambiar una pregunta a `validated`.
- La validacion bloquea preguntas incompletas o incorrectas.
- Los errores de validacion son claros.
- Existen tests para las reglas criticas.
- No se ha implementado generacion con IA.
- No se ha implementado generacion de tests.
- No se ha anadido funcionalidad fuera de alcance.

## 12. Notas tecnicas para Claude

Claude debe adaptarse al stack existente del repositorio.

Si todavia no hay framework elegido, debe proponer una implementacion minima y clara antes de crear una arquitectura compleja.

Prioridades:

- Simplicidad.
- Codigo legible.
- Validaciones explicitas.
- Tests de reglas criticas.
- Separacion entre logica de validacion y capa de presentacion.
- Sin dependencias innecesarias.

La logica de validacion de preguntas deberia estar separada para poder reutilizarse mas adelante en:

- Panel de administracion.
- Generador de preguntas con IA.
- Generador de tests.
- Sistema de reportes.

## 13. Prompt para Claude

Claude, implementa la SPEC 001 - Question Bank.

Debes crear el primer modulo funcional del proyecto TESTOPO: el banco de preguntas.

Implementa:

- Modelo de pregunta.
- Modelo de opcion de respuesta.
- Modelo basico de fuente.
- Estados de pregunta.
- Dificultades permitidas.
- Validaciones obligatorias.
- Crear pregunta en estado `draft`.
- Listar preguntas.
- Ver pregunta por ID.
- Editar pregunta.
- Cambiar estado de pregunta.
- Bloquear el paso a `validated` si la pregunta no cumple las reglas.
- Tests automaticos para las reglas criticas.

No implementes todavia:

- IA.
- Generacion automatica de preguntas.
- Subida de documentos.
- Procesamiento de PDFs.
- Generacion de tests.
- Usuarios.
- Autenticacion.
- Panel avanzado.
- Reportes.
- Estadisticas.

Regla central:

Una pregunta no puede considerarse valida si no tiene fuente, explicacion, tema, dificultad y exactamente una respuesta correcta.

Solo las preguntas en estado `validated` podran ser usadas mas adelante en tests normales.

Manten el codigo simple, modular y testeable. No anadas funcionalidades fuera de alcance.
