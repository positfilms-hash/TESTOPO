# SPEC 017 - Unified Syllabus & Bulk Material Import

## 1. Objetivo

Unificar la gestion de temario y material en una sola experiencia.

Actualmente la app separa demasiado:

- Anadir tema
- Subir material PDF

Pero en una oposicion real cada tema puede tener mucho material asociado. Por eso, el administrador o usuario Premium debe poder construir el temario y subir materiales desde el mismo lugar.

Esta spec tambien anade importacion masiva de material mediante archivos `.zip`, permitiendo que la app cree temas y materiales a partir de una estructura de carpetas.

La beta readiness se movera mas adelante a SPEC 018. Esta SPEC 017 solo cubre temario unificado e importacion masiva.

## 2. Contexto

TESTOPO debe permitir dos grandes modelos:

```text
Organizacion / academia / preparador
Admin crea oposicion
  -> Crea temario
  -> Sube mucho material por tema
  -> Genera preguntas
  -> Revisa preguntas
  -> Crea pool validado
  -> Da acceso a estudiantes
```

```text
Usuario Premium individual
Usuario crea oposicion personal
  -> Sube su propio temario
  -> Genera preguntas
  -> Revisa preguntas
  -> Crea tests para estudiar
```

En ambos casos, el flujo de material debe ser comodo y no obligar a subir documento por documento desde una pestana separada.

## 3. Branch recomendada

```text
feature/unified-syllabus-bulk-import
```

## 4. Principio central

El temario y el material deben gestionarse juntos.

Un tema no es solo un titulo.

Un tema puede contener:

- Subtemas
- PDFs
- Documentos
- Tests antiguos
- Leyes
- Apuntes
- Referencias
- Preguntas asociadas

La interfaz debe ayudar a organizar el contenido, no solo a almacenarlo.

## 5. Alcance

Claude debe implementar:

- Unificacion visual de Temario y Material.
- Vista de temas con materiales asociados.
- Subida de PDF desde un tema concreto.
- Subida de varios archivos a la vez.
- Importacion de archivo `.zip`.
- Desglose del `.zip` por carpetas.
- Creacion automatica de temas desde carpetas.
- Creacion automatica de materiales desde archivos.
- Asociacion automatica material-tema.
- Registro de lote de importacion.
- Vista previa o resumen de importacion.
- Validaciones de seguridad.
- Tests automaticos de reglas criticas.

## 6. Fuera de alcance

No implementar todavia:

- IA avanzada para clasificar documentos.
- Deteccion semantica automatica de temas.
- OCR.
- RAG avanzado.
- Embeddings.
- Indexacion vectorial.
- Correccion automatica de estructura del temario.
- Deteccion automatica de leyes obsoletas.
- Generacion masiva automatica de preguntas sin revision.
- Visor PDF avanzado.
- Drag and drop complejo si no es sencillo.
- Importacion desde Google Drive, Dropbox o OneDrive.
- Pagos o limites comerciales reales.
- Beta readiness.

Esta spec solo mejora organizacion e importacion.

## 7. Nueva experiencia de interfaz

La pestana principal debe ser:

```text
Temario
```

Dentro de Temario, el usuario debe poder:

- Crear tema
- Crear subtema
- Ver materiales del tema
- Subir material al tema
- Importar carpeta o ZIP
- Editar tema
- Marcar tema como obsoleto

No debe existir una experiencia separada y desconectada tipo:

- Material por un lado
- Temario por otro

Puede seguir existiendo una vista global de materiales, pero la gestion principal debe ocurrir desde el temario.

## 8. Diseno recomendado de pantalla

Vista recomendada:

```text
Temario
--------------------------------------------------
[Arbol de temas]              [Detalle del tema]
Tema 1                         Tema 1 - Constitucion
  Apartado 1.1                 Materiales:
  Apartado 1.2                 - Constitucion.pdf
Tema 2                         - Derechos fundamentales.pdf
                                Acciones:
                                [Anadir subtema]
                                [Subir material]
                                [Importar ZIP]
```

Reglas UX:

- Una accion principal visible: Subir material o Importar material.
- No saturar con muchos botones.
- Mostrar materiales como tarjetas simples.
- Mostrar estado de extraccion de texto.
- Mostrar si el material esta activo, obsoleto o necesita revision.

## 9. Subida individual desde tema

Desde un tema, el usuario debe poder subir:

- PDF
- TXT
- MD
- DOCX si ya esta soportado o es sencillo

Para esta spec, PDF es obligatorio.

TXT y MD son recomendables.

DOCX puede quedar preparado si complica demasiado.

Al subir desde un tema, el material queda automaticamente asociado a:

- workspace
- opposition
- topic

No debe requerir que el usuario vuelva a elegir oposicion si ya esta dentro de una oposicion.

## 10. Subida multiple de archivos

Debe permitirse subir varios archivos a la vez dentro de un tema.

Ejemplo:

```text
Tema 1
  subir:
    introduccion.pdf
    derechos-fundamentales.pdf
    test-tema-1.pdf
```

Resultado:

```text
Tema 1
  Material: introduccion.pdf
  Material: derechos-fundamentales.pdf
  Material: test-tema-1.pdf
```

Cada archivo debe crear un `Material`.

## 11. Importacion mediante ZIP

Debe permitirse subir un archivo `.zip`.

El ZIP puede contener carpetas y archivos.

Ejemplo:

```text
Temario Administrativo.zip
Tema 1 - Constitucion/
  01 Introduccion.pdf
  02 Derechos fundamentales.pdf
Tema 2 - Procedimiento Administrativo/
  01 Plazos.pdf
  02 Recursos.pdf
```

La app debe crear:

```text
Tema 1 - Constitucion
  Material: 01 Introduccion.pdf
  Material: 02 Derechos fundamentales.pdf
Tema 2 - Procedimiento Administrativo
  Material: 01 Plazos.pdf
  Material: 02 Recursos.pdf
```

## 12. Importacion de carpeta

Si el stack/frontend lo soporta de forma sencilla, puede anadirse carga de carpeta.

Pero para el MVP, la prioridad es:

```text
ZIP import
```

La carga directa de carpeta puede quedar como mejora opcional.

## 13. Reglas de desglose del ZIP

### 13.1 Carpetas

Cada carpeta principal puede convertirse en tema.

Cada subcarpeta puede convertirse en subtema.

Ejemplo:

```text
Tema 1/
  Apartado 1.1/
    archivo.pdf
```

Resultado:

```text
Tema 1
  Apartado 1.1
    Material: archivo.pdf
```

### 13.2 Archivos en raiz

Si hay archivos en la raiz del ZIP, deben asociarse al tema seleccionado al importar.

Si no hay tema seleccionado, deben ir a un tema automatico:

```text
Material importado sin clasificar
```

### 13.3 Nombres de tema

Los nombres de carpetas deben usarse como titulos de temas.

Ejemplo:

```text
Tema 3 - Union Europea
```

Se crea como:

```text
Tema 3 - Union Europea
```

No intentar limpiar demasiado el nombre en esta spec.

### 13.4 Duplicados

Si ya existe un tema con el mismo titulo bajo el mismo padre, no crear duplicado.

Usar el tema existente.

Si ya existe un material con el mismo nombre dentro del mismo tema, aplicar una estrategia simple:

- Omitir duplicado

o:

- Crear con sufijo

Recomendacion para MVP:

- Omitir duplicado y reportarlo en el resumen de importacion.

## 14. Modelo de lote de importacion

Crear modelo `MaterialImportBatch` o similar.

Campos minimos:

- `id`
- `workspace_id`
- `opposition_id`
- `uploaded_by`
- `status`
- `source_type`
- `original_filename`
- `total_files`
- `imported_files`
- `skipped_files`
- `failed_files`
- `errors`
- `created_at`
- `updated_at`

### source_type

Valores:

- `multi_file`
- `zip`
- `folder`

Para MVP:

- `multi_file`
- `zip`

### status

Valores:

- `pending`
- `processing`
- `completed`
- `completed_with_errors`
- `failed`

## 15. Modelo de archivo importado

Crear modelo `MaterialImportItem` o similar.

Campos minimos:

- `id`
- `batch_id`
- `material_id`
- `topic_id`
- `original_path`
- `original_filename`
- `status`
- `error`
- `created_at`
- `updated_at`

### original_path

Ruta original dentro del ZIP.

Ejemplo:

```text
Tema 1 - Constitucion/01 Introduccion.pdf
```

### status

Valores:

- `imported`
- `skipped`
- `failed`

## 16. Archivos permitidos

Para esta spec permitir:

- `.pdf`
- `.txt`
- `.md`

Opcional si ya esta soportado:

- `.docx`

No permitir:

- `.exe`
- `.bat`
- `.cmd`
- `.sh`
- `.js`
- `.html`
- `.php`
- zip dentro de zip

Para MVP, no procesar ZIPs anidados.

## 17. Seguridad ZIP

La importacion ZIP debe proteger contra:

- Zip Slip.
- Rutas con `../`.
- Rutas absolutas.
- Archivos ocultos peligrosos.
- Archivos demasiado grandes.
- Demasiados archivos.
- Extensiones no permitidas.
- ZIPs anidados.
- Nombres de archivo vacios o corruptos.

Limites recomendados MVP:

- Tamano maximo ZIP: 200 MB
- Maximo archivos por ZIP: 300
- Tamano maximo por archivo: 50 MB

Si el stack requiere limites menores, documentarlo.

## 18. Extraccion de texto

Para cada material importado:

### PDF

Usar la extraccion basica de texto de SPEC 012.

Si no se puede extraer texto:

- `extraction_status = failed`

o:

- `extraction_status = not_supported`

### TXT / MD

Guardar contenido directamente en `content_text`.

### DOCX

Solo si ya existe soporte.

No implementar OCR.

## 19. Relacion con generacion de preguntas

Despues de importar, el material no debe generar preguntas automaticamente sin accion del usuario.

Flujo correcto:

```text
Importar material
  -> Revisar estructura del temario
  -> Comprobar materiales
  -> Elegir tema o material
  -> Generar preguntas
  -> Revisar preguntas
  -> Aprobar
```

## 20. Permisos

Puede importar material:

- `owner`
- `admin`

Tambien usuario Premium en su workspace personal si es `owner`.

No puede importar material:

- `student`

## 21. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 21.1 Ver temario con materiales

Debe devolver arbol de temas con materiales asociados.

### 21.2 Subir archivo a tema

Entrada:

- `opposition_id`
- `topic_id`
- `file`
- `type`
- `reference`

### 21.3 Subir varios archivos a tema

Entrada:

- `opposition_id`
- `topic_id`
- `files[]`
- `type`
- `reference`

### 21.4 Importar ZIP

Entrada:

- `opposition_id`
- `parent_topic_id` opcional
- `zip_file`
- `default_material_type`

Debe:

1. Validar permisos.
2. Validar ZIP.
3. Leer estructura.
4. Crear temas/subtemas.
5. Crear materiales.
6. Asociar materiales a temas.
7. Extraer texto cuando sea posible.
8. Crear resumen de importacion.

### 21.5 Consultar lote de importacion

Debe permitir ver:

- `total_files`
- `imported_files`
- `skipped_files`
- `failed_files`
- `errors`
- `items`

### 21.6 Reintentar elementos fallidos

Opcional para MVP.

Si complica, dejar documentado para futura spec.

## 22. Vista previa de importacion

Recomendado, pero no obligatorio si complica.

Flujo ideal:

```text
Subir ZIP
  -> Vista previa:
      - Temas que se crearan
      - Materiales que se importaran
      - Archivos ignorados
  -> Confirmar importacion
```

Para MVP, se puede hacer importacion directa y mostrar resumen final.

## 23. Mensajes de usuario

Ejemplos:

- ZIP importado correctamente.
- Se han creado 8 temas y 42 materiales.
- 3 archivos se han omitido porque no tenian un formato permitido.
- No se pudo importar el ZIP. El archivo contiene rutas no seguras.
- Algunos PDFs se han subido, pero no se pudo extraer texto de todos.

## 24. Validaciones minimas

Errores recomendados:

- `IMPORT_ACCESS_DENIED`
- `IMPORT_OPPOSITION_REQUIRED`
- `IMPORT_OPPOSITION_NOT_FOUND`
- `IMPORT_TOPIC_NOT_FOUND`
- `IMPORT_TOPIC_OPPOSITION_MISMATCH`
- `IMPORT_FILE_REQUIRED`
- `IMPORT_INVALID_FILE_TYPE`
- `IMPORT_ZIP_REQUIRED`
- `IMPORT_ZIP_TOO_LARGE`
- `IMPORT_ZIP_EMPTY`
- `IMPORT_ZIP_TOO_MANY_FILES`
- `IMPORT_ZIP_UNSAFE_PATH`
- `IMPORT_ZIP_NESTED_NOT_ALLOWED`
- `IMPORT_FILE_TOO_LARGE`
- `IMPORT_FILE_EXTENSION_NOT_ALLOWED`
- `IMPORT_STORAGE_FAILED`
- `IMPORT_EXTRACTION_FAILED`
- `IMPORT_DUPLICATE_SKIPPED`

## 25. Cambios frontend

Modificar la zona de Temario.

Debe incluir:

- Arbol de temas.
- Materiales dentro de cada tema.
- Boton Anadir tema.
- Boton Subir material.
- Boton Importar ZIP.
- Resumen de importacion.
- Estado de extraccion de cada material.
- Eliminar o reducir protagonismo de una pestana separada de "Subir PDF".

La subida de material debe sentirse como parte natural del tema.

## 26. Tests automaticos obligatorios

Deben existir tests para comprobar:

- Admin puede subir archivo a un tema.
- Student no puede subir archivo a un tema.
- Se pueden subir varios archivos a un tema.
- Cada archivo crea un material.
- Cada material queda asociado al tema correcto.
- Se puede importar ZIP valido.
- El ZIP crea temas desde carpetas.
- El ZIP crea subtemas desde subcarpetas.
- El ZIP crea materiales desde archivos permitidos.
- Archivos en raiz se asocian al tema seleccionado o a "sin clasificar".
- No se crean temas duplicados bajo el mismo padre.
- No se importan archivos con extension no permitida.
- No se permite ZIP con rutas `../`.
- No se permite ZIP con rutas absolutas.
- No se permiten ZIPs anidados.
- No se permite ZIP demasiado grande.
- No se permite demasiados archivos.
- Se genera resumen de importacion.
- Los PDFs usan extraccion basica de texto.
- TXT y MD guardan `content_text`.
- No se generan preguntas automaticamente tras importar.
- No se rompen tests existentes.

## 27. Criterios de aceptacion

La tarea se considera completada cuando:

- Temario y material estan integrados en una misma experiencia.
- Desde un tema se puede subir material.
- Desde un tema se pueden subir varios archivos.
- Se puede importar un ZIP.
- El ZIP crea temas y subtemas desde carpetas.
- El ZIP crea materiales desde archivos permitidos.
- Los materiales quedan asociados al tema correcto.
- La importacion genera resumen claro.
- Los archivos peligrosos se rechazan.
- No se implementa OCR.
- No se implementa IA avanzada de clasificacion.
- No se generan preguntas automaticamente tras importar.
- La interfaz es mas intuitiva y menos fragmentada.
- Existen tests de reglas criticas.

## 28. Prompt para Claude

Claude, implementa la SPEC 017 - Unified Syllabus & Bulk Material Import.

Vamos a cambiar el enfoque antes de preparar la beta. La app tiene mucho material por tema, asi que la gestion de Temario y Material debe unificarse.

Debes implementar:

- Vista de temario con materiales asociados.
- Subida de material desde un tema.
- Subida de varios archivos desde un tema.
- Importacion de archivo `.zip`.
- Creacion de temas desde carpetas del ZIP.
- Creacion de subtemas desde subcarpetas.
- Creacion de materiales desde archivos permitidos.
- Asociacion automatica de materiales al tema correspondiente.
- Modelo de lote de importacion.
- Modelo de item importado.
- Resumen de importacion.
- Validaciones de seguridad para ZIP.
- Adaptacion de frontend para que Temario y Material esten unidos.
- Tests automaticos de reglas criticas.

No implementes todavia:

- OCR.
- IA avanzada de clasificacion.
- RAG.
- Embeddings.
- Indexacion vectorial.
- Generacion automatica de preguntas tras importar.
- Visor PDF avanzado.
- Integraciones con Google Drive, Dropbox o OneDrive.
- Pagos.
- Beta readiness.
- Funciones fuera del MVP.

Reglas centrales:

1. El usuario debe poder gestionar materiales desde cada tema.
2. El ZIP debe desglosarse por carpetas y archivos.
3. Las carpetas crean temas/subtemas.
4. Los archivos crean materiales.
5. Cada material queda asociado a una oposicion y a un tema.
6. No se permiten archivos peligrosos.
7. No se generan preguntas automaticamente tras importar.
8. La experiencia debe ser elegante, clara y con pocas acciones.

Manten compatibilidad con las specs anteriores y no rompas tests existentes.
