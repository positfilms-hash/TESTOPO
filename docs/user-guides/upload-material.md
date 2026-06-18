# Guía: Subir material (carga masiva)

El botón **Subir material** (sección *Material*) es la forma de meter contenido en
una oposición de golpe: un ZIP con muchos PDFs, una carpeta entera o varios PDFs a
la vez. Solo tienes que elegir **una de dos categorías**.

> Solo pueden subir material el owner/admin del espacio (y el premium owner en su
> espacio personal). Los alumnos no suben material.

## Las dos categorías

### Material de la oposición
Temario oficial, apuntes, leyes, normativa, esquemas, manuales, PDFs de estudio.
Es la **base de conocimiento**: a partir de aquí la IA puede proponerte un índice
de temario.

### Tests antiguos
Exámenes oficiales anteriores, simulacros, modelos de examen, preguntas de años
previos. Se usan como **referencia de estilo y cobertura**, no como tests para tus
alumnos.

## Formas de subir

- **Subir ZIP** — recomendado para mucho material. Comprime tu carpeta y súbela.
- **Subir carpeta** — si tu navegador lo permite, puedes subir una carpeta entera
  directamente. Si no aparece la opción, comprime la carpeta en ZIP.
- **Subir PDFs** — selecciona varios PDFs (o TXT/MD) a la vez.

### Cómo preparar un ZIP / carpeta

Las carpetas se interpretan como **sugerencias** de temas y subtemas:

```text
Material Administrativo.zip
  Tema 1 - Constitucion/
    01 Constitucion Espanola.pdf
    02 Derechos fundamentales.pdf
  Tema 2 - Procedimiento administrativo/
    01 Plazos.pdf
```

También puedes subir un ZIP **combinado** con dos carpetas principales y elegir la
opción combinada; la app clasifica por carpeta:

```text
Oposicion Administrativo.zip
  Material de la oposicion/
    Tema 1 - Constitucion/ Constitucion.pdf
  Tests antiguos/
    Examen 2021.pdf
```

## Formatos aceptados

`.pdf`, `.zip`, `.txt`, `.md`. Se rechazan ejecutables y otros formatos peligrosos,
ZIP dentro de ZIP, rutas inseguras, archivos sin extensión o corruptos, y archivos
o lotes demasiado grandes (máx. 200 MB por ZIP, 500 archivos por lote, 50 MB por
archivo).

## Qué pasa después de subir

1. Verás un **resumen**: cuántos archivos se importaron, cuántos tienen texto
   extraído y cuántos no (p. ej. un PDF escaneado no tiene texto seleccionable; se
   queda pendiente de revisión, sin OCR por ahora).
2. Para *material de la oposición* puedes pulsar **Crear índice con IA**: la IA
   propone un índice de temario **pendiente de tu revisión**. Lo revisas y lo
   aplicas desde *Temario*.
3. Para *tests antiguos* la IA analiza estilo, dificultad y cobertura y guarda un
   resumen de patrones. No genera preguntas.

## Por qué las preguntas no se generan "validadas" automáticamente

Subir un PDF **no** crea preguntas listas para tus alumnos. El proceso fiable es:

```text
Indice aprobado -> Generar preguntas -> IA crea candidatas
  -> Tú las revisas -> quedan "validated"
  -> Solo entonces entran en los tests de los alumnos
```

Así garantizamos que ningún alumno vea una pregunta sin revisar, y que los tests
de estudiante salgan únicamente del banco de preguntas validadas.
