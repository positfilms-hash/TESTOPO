# CLAUDE.md — Reglas de implementacion del proyecto

## 1. Contexto del proyecto

Este proyecto es una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

El material puede incluir temario actualizado, tests antiguos, examenes oficiales, normativa, apuntes y documentos complementarios.

La app debe permitir crear, revisar, validar y usar preguntas tipo test para estudiar oposiciones.

El objetivo no es generar preguntas sin control, sino construir un banco de preguntas fiable, trazable y util para el estudio.

## 2. Rol estricto de Claude

Claude es el implementador principal del codigo.

Claude recibira specs y prompts tecnicos preparados por Codex.

Su trabajo es:

- Implementar el codigo solicitado.
- Respetar estrictamente la spec.
- Anadir validaciones necesarias.
- Anadir tests cuando se pidan o sean necesarios.
- Mantener el codigo claro y modular.
- No ampliar el alcance sin autorizacion.
- No tomar decisiones grandes de arquitectura por iniciativa propia.

Claude no debe sustituir el rol de Codex.

Codex define, coordina y revisa.
Claude implementa.

## 3. Principio central de implementacion

Ninguna pregunta debe considerarse valida si no tiene:

- Fuente.
- Explicacion.
- Una unica respuesta correcta.
- Tema asignado.
- Dificultad asignada.
- Estado valido.

Este principio debe reflejarse en modelos, validaciones, endpoints, interfaz y tests.

## 4. MVP inicial

El MVP debe incluir:

- Carga de material.
- Organizacion por temas.
- Banco de preguntas.
- Generacion de preguntas desde material.
- Validacion basica.
- Revision humana.
- Generacion de tests.
- Resultados con explicacion.
- Reporte de preguntas problematicas.

Quedan fuera del MVP:

- Pagos.
- Suscripciones.
- App movil nativa.
- Ranking.
- Comunidad.
- Marketplace.
- Gamificacion avanzada.
- Estadisticas complejas.

Claude no debe implementar funcionalidades fuera del MVP salvo instruccion expresa.

## 5. Modelo minimo de pregunta

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

Estados permitidos:

```text
draft
pending_review
validated
rejected
needs_fix
obsolete
```

Dificultades permitidas:

```text
easy
medium
hard
```

Para el MVP, solo existen preguntas tipo test de respuesta unica.

Una pregunta que no este en estado `validated` no debe aparecer en tests normales.

## 6. Reglas obligatorias de validacion

Una pregunta no puede pasar a `validated` si:

- No tiene enunciado.
- No tiene opciones.
- No tiene exactamente una respuesta correcta.
- No tiene explicacion.
- No tiene fuente.
- No tiene tema.
- No tiene dificultad.
- Tiene opciones duplicadas.
- La respuesta correcta no existe entre las opciones.
- Esta marcada como obsoleta.
- Tiene reportes criticos pendientes.

Estas reglas deben estar cubiertas por tests automaticos cuando se implemente el banco de preguntas.

## 7. Fuentes y trazabilidad

Toda pregunta debe estar vinculada a una fuente.

Una fuente puede ser:

- Temario.
- Test antiguo.
- Examen oficial.
- Norma.
- Apunte.
- Fragmento concreto de un documento.

La fuente debe permitir saber de donde salio la pregunta.

No debe validarse una pregunta generada desde una fuente obsoleta.

El material real del usuario no debe guardarse en el repositorio.

## 8. Generacion de tests

El generador de tests debe seleccionar unicamente preguntas validas.

Debe poder filtrar por:

- Numero de preguntas.
- Tema.
- Dificultad.
- Seleccion aleatoria.

Debe excluir:

- Preguntas no validadas.
- Preguntas rechazadas.
- Preguntas obsoletas.
- Preguntas marcadas como problematicas si la spec asi lo indica.

## 9. Resultados

Al terminar un test, el usuario debe ver:

- Puntuacion.
- Preguntas acertadas.
- Preguntas falladas.
- Respuesta correcta.
- Explicacion.
- Tema.
- Dificultad.
- Opcion para reportar la pregunta.

No debe haber preguntas sin explicacion en tests normales.

## 10. Reportes de preguntas

Los usuarios deben poder reportar preguntas problematicas.

Motivos recomendados:

```text
wrong_answer
ambiguous
outdated
bad_explanation
not_in_syllabus
duplicate
other
```

Los reportes deben poder revisarse desde administracion.

Una pregunta con reportes criticos debe poder marcarse como `needs_fix`.

## 11. Estilo de codigo

Claude debe priorizar:

- Codigo claro.
- Simplicidad.
- Modularidad.
- Nombres descriptivos.
- Validaciones explicitas.
- Tests para reglas criticas.
- Separacion entre logica de negocio e interfaz.
- Datos ficticios en ejemplos y pruebas.

Claude debe evitar:

- Sobrediseno.
- Dependencias innecesarias.
- Funcionalidades no pedidas.
- Cambios globales no solicitados.
- Suposiciones no indicadas en la spec.
- Uso de material real o sensible en fixtures, seeds o tests.

## 12. Criterio de finalizacion

Una tarea se considera terminada cuando:

- Cumple la spec.
- Pasa los tests.
- Respeta las reglas de negocio.
- No rompe funcionalidades existentes.
- No anade funcionalidades fuera de alcance.
- Mantiene la trazabilidad de preguntas y fuentes.
- Puede ser revisada por Codex.

## 13. Frase guia

Implementa menos, pero impleméntalo bien.

La prioridad no es generar muchas preguntas.
La prioridad es que cada pregunta sea fiable, revisable y util para estudiar.
