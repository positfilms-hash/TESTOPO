# TESTOPO

TESTOPO es una aplicacion para generar **tests randomizados de oposiciones** a partir de material aportado por el usuario (temario actualizado, tests antiguos, examenes oficiales, normativa, apuntes y documentos complementarios).

## Que problema resuelve

Estudiar oposiciones requiere practicar con preguntas tipo test fiables. Generar preguntas sin control produce material poco confiable. TESTOPO permite **crear, revisar, validar y usar** preguntas tipo test apoyandose en el material real del estudiante, manteniendo la trazabilidad de cada pregunta hasta su fuente.

## Principio central

> Una pregunta no es valida porque la IA la haya generado.
> Una pregunta solo es valida si tiene **fuente**, **explicacion**, una **unica respuesta correcta** y supera los **controles de calidad** (tema, dificultad y estado validado).

## MVP

El MVP prioriza construir un **banco de preguntas fiable, trazable y util** por encima de la cantidad de preguntas. Incluye carga de material, organizacion por temas, banco de preguntas, generacion desde material, validacion basica, revision humana, generacion de tests, resultados con explicacion y reporte de preguntas problematicas.

Quedan fuera del MVP: pagos, suscripciones, app movil nativa, ranking, comunidad, marketplace, gamificacion avanzada y estadisticas complejas.

## Desarrollo guiado por specs

El desarrollo del proyecto se realiza mediante specs versionadas en [`/docs/specs`](docs/specs). Cada funcionalidad se define en una spec antes de implementarse. Los roles y reglas de trabajo estan documentados en [`/docs/constitution`](docs/constitution).

## Estructura del repositorio

```text
/docs           Documentacion: constitucion (roles) y specs
/prompts        Plantillas y prompts de implementacion
/app            Codigo de aplicacion (frontend / backend)
/database       Esquema de base de datos
/tests          Criterios de aceptacion y tests
```
