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
   extraído y cuántos no. Un PDF **escaneado** (imágenes, sin texto seleccionable)
   se detecta automáticamente y queda marcado como **«Escaneo detectado»**: puedes
   leerlo con **OCR** (ver más abajo).
2. **Revisar documentos** (SPEC 028-B): la app clasifica cada archivo y te muestra
   un **inventario** agrupado: temario/material de estudio, tests antiguos/
   exámenes, textos legales, apuntes, índices, y los que necesitan revisión
   (dudosos o no analizables). Cada documento muestra su confianza y el motivo.
   Si la clasificación se equivoca, **corrígela tú**: tu corrección manda sobre la
   IA. Se activa por defecto con la casilla "Clasificar documentos después de
   importar"; si la desmarcas, puedes pulsar **Revisar documentos** en el resumen.
3. La clasificación **no genera índice ni preguntas todavía**. Solo identifica qué
   es cada archivo, para que el índice de temario y las preguntas (más adelante)
   partan de documentos bien entendidos y revisados. El **Crear índice con IA**
   sigue disponible de forma manual en *Temario*.

> Los **tests antiguos** y los documentos no aptos (dudosos, no analizables,
> irrelevantes) son material **interno**: los alumnos nunca los ven en su lista de
> material de estudio.

## PDFs escaneados: leer con OCR (SPEC 030)

Si subes un PDF que en realidad son **imágenes** (un escaneo, sin texto
seleccionable), la app lo detecta y, en la sección *Material*, lo marca con una
etiqueta de estado:

| Etiqueta | Qué significa |
| --- | --- |
| **Texto extraído** | El PDF ya traía texto legible; no necesita OCR. |
| **Escaneo detectado** | Es un escaneo. Pulsa **«Leer escaneo (OCR)»** para extraer el texto. |
| **Leyendo escaneo** | OCR en curso. |
| **Leído con OCR** | Texto recuperado correctamente. |
| **OCR con advertencias** | Texto recuperado pero con páginas de baja calidad: **revísalo**. |
| **No se pudo leer** | El OCR no extrajo texto utilizable. Puedes **«Reintentar OCR»**. |

- El botón **«Leer escaneo (OCR)»** / **«Reintentar OCR»** y el detalle (páginas
  leídas, confianza, advertencias) son **solo para gestores**: los alumnos no ven
  nada de esto.
- Un OCR fallido **no borra** un texto bueno que ya tuviera el material.
- El OCR **solo recupera texto**: no clasifica el documento ni genera preguntas.
  En la demo usa un lector simulado; en producción, un proveedor real a través de
  una función de servidor (la clave nunca está en el navegador).

## Por qué las preguntas no se generan "validadas" automáticamente

Subir un PDF **no** crea preguntas listas para tus alumnos. El proceso fiable es:

```text
Indice aprobado -> Generar preguntas -> IA crea candidatas
  -> Tú las revisas -> quedan "validated"
  -> Solo entonces entran en los tests de los alumnos
```

Así garantizamos que ningún alumno vea una pregunta sin revisar, y que los tests
de estudiante salgan únicamente del banco de preguntas validadas.
