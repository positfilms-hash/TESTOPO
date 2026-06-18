# SPEC 028 - Smart Bulk Upload: Materials & Old Exams

## 1. Objetivo

Redisenar y reforzar el boton `Subir material` para que sea el punto principal de entrada de contenido en TESTOPO.

El usuario debe poder subir grandes cantidades de documentos de una oposicion de forma comoda:

- ZIPs con muchos PDFs.
- Carpetas con muchos PDFs, si el navegador/stack lo permite.
- Varios PDFs a la vez.

La app debe distinguir unicamente entre dos grandes tipos de carga:

1. Material de la oposicion.
2. Tests antiguos / examenes anteriores.

A partir de esos documentos, TESTOPO debe:

```text
Desglosar archivos
  -> Registrar materiales
  -> Extraer texto
  -> Separar material de estudio y tests antiguos
  -> Proponer indice de temario con IA
  -> Analizar estilo de tests antiguos
  -> Preparar generacion futura de preguntas
  -> Mantener revision humana
```

## 2. Cambio De Planificacion

La SPEC prevista como Beta Readiness se retrasa.

Nuevo orden:

- SPEC 028 - Smart Bulk Upload: Materials & Old Exams.
- SPEC 029 - Beta Readiness.

## 3. Contexto

Piezas relacionadas existentes:

- SPEC 012 - PDF Material Upload & Basic Text Extraction.
- SPEC 017 - Unified Syllabus & Bulk Material Import.
- SPEC 019 - AI Syllabus Index Builder.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.
- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
- SPEC 025 - Supabase RLS Hardening.
- SPEC 027 - Pre-Beta QA & Data Consistency.

Esta spec no sustituye esas piezas. Las une en un flujo mas claro y usable.

## 4. Branch

```text
feature/smart-bulk-material-upload
```

## 5. Principio Central

El usuario no debe tener que organizar todo manualmente antes de empezar.

Correcto:

```text
Usuario sube ZIP/carpeta
  -> App desglosa archivos
  -> IA propone temario
  -> IA detecta tests antiguos
  -> Admin revisa
  -> Se aplica el temario
  -> Se generan preguntas candidatas
  -> Admin revisa preguntas
  -> Solo preguntas validadas entran en tests
```

Incorrecto:

```text
Usuario sube documentos
  -> IA genera tests directamente para estudiantes
```

## 6. Alcance

Claude debe implementar o reforzar:

- Boton unico y claro `Subir material`.
- Modal/pantalla de carga masiva.
- Soporte obligatorio para ZIP.
- Soporte obligatorio para multiples PDFs.
- Soporte para carpeta si el stack/navegador lo permite de forma estable.
- Dos categorias principales de carga:
  - `Material de la oposicion`.
  - `Tests antiguos`.
- Desglose de ZIP/carpeta.
- Creacion de materiales por archivo.
- Extraccion de texto de PDFs.
- Registro de lote de importacion.
- Clasificacion de materiales segun categoria elegida.
- Analisis IA del material de oposicion para proponer temario.
- Analisis IA de tests antiguos para detectar estilo, dificultad y cobertura.
- Flujo de revision humana antes de aplicar temario.
- Compatibilidad con Supabase.
- Compatibilidad con RLS.
- Tests criticos.
- Documentacion de uso.

## 7. Fuera De Alcance

No implementar todavia:

- OCR.
- RAG avanzado.
- Embeddings.
- Fine-tuning.
- Base vectorial.
- Copia automatica de preguntas de examenes antiguos como validadas.
- Generacion directa de tests para estudiantes sin revision.
- Sustitucion de revision humana.
- Integraciones con Google Drive, Dropbox o OneDrive.
- App movil.
- Marketplace.
- Pagos.
- Beta Readiness.

## 8. Nueva Experiencia De Usuario

En la pantalla de Temario o dentro de una oposicion debe existir un boton principal:

```text
Subir material
```

Al pulsarlo, se abre una pantalla/modal con dos opciones claras:

```text
Que vas a subir?

[ Material de la oposicion ]
Temario, apuntes, leyes, esquemas, PDFs de estudio.

[ Tests antiguos ]
Examenes oficiales, simulacros antiguos, preguntas de otros anos.
```

Despues debe permitir:

- Subir ZIP.
- Subir carpeta, si esta soportado.
- Subir PDFs.

## 9. Tipos De Carga

### 9.1 Material De La Oposicion

Corresponde a:

- Temario oficial.
- Apuntes.
- Leyes.
- Normativa.
- Esquemas.
- Manuales.
- PDFs de estudio.

UX principal:

```text
Material de la oposicion
```

Internamente puede registrarse como:

- `syllabus` por defecto.
- `notes`.
- `law`.
- `other`.

La app puede permitir ajuste avanzado posterior, pero no debe complicar la primera carga.

### 9.2 Tests Antiguos

Corresponde a:

- Examenes oficiales anteriores.
- Tests antiguos.
- Simulacros.
- Preguntas de anos anteriores.
- Modelos de examen.

UX principal:

```text
Tests antiguos
```

Internamente puede registrarse como:

- `old_test` por defecto.
- `official_exam` si se marca despues o se detecta con confianza.

## 10. Formatos Permitidos

Permitir:

- `.pdf`
- `.zip`
- `.txt`
- `.md`

Opcional si ya existe soporte:

- `.docx`

Prioridad real:

1. PDF.
2. ZIP.
3. Carpeta con PDFs.

No permitir:

- `.exe`
- `.bat`
- `.cmd`
- `.sh`
- `.js`
- `.html`
- `.php`
- ZIP dentro de ZIP.
- Archivos sin extension.
- Archivos corruptos.

## 11. Subida De Carpeta

Si el stack/frontend lo permite, implementar subida de carpeta mediante input de directorio o equivalente.

Regla MVP:

- ZIP es obligatorio.
- Carpeta directa es recomendable si puede implementarse de forma estable.

Si la subida de carpeta directa no es estable, la UI debe indicar:

```text
Tambien puedes comprimir la carpeta en ZIP y subirla aqui.
```

## 12. Estructura Esperada Del ZIP O Carpeta

### 12.1 ZIP Solo De Material De Oposicion

Ejemplo:

```text
Material Administrativo.zip
Tema 1 - Constitucion/
  01 Constitucion Espanola.pdf
  02 Derechos fundamentales.pdf
Tema 2 - Procedimiento administrativo/
  01 Plazos.pdf
  02 Recursos.pdf
```

Si el usuario marca `Material de la oposicion`:

- Se crean materiales de estudio.
- La IA propone temas/subtemas.
- Los archivos se asocian a temas sugeridos.

### 12.2 ZIP Solo De Tests Antiguos

Ejemplo:

```text
Tests antiguos Administrativo.zip
Examen 2021.pdf
Examen 2022.pdf
Simulacro academia 01.pdf
Simulacro academia 02.pdf
```

Si el usuario marca `Tests antiguos`:

- Se crean materiales tipo `old_test`/`official_exam`.
- La IA analiza estilo, dificultad y cobertura.
- No se crean preguntas validadas automaticamente.

### 12.3 ZIP Combinado

Tambien puede aceptarse una estructura combinada:

```text
Oposicion Administrativo.zip
Material de la oposicion/
  Tema 1 - Constitucion/
    Constitucion.pdf
  Tema 2 - Procedimiento/
    Plazos.pdf
Tests antiguos/
  Examen 2021.pdf
  Examen 2022.pdf
```

La app puede detectar carpetas principales:

- `Material de la oposicion`
- `Tests antiguos`

Si no esta claro, debe pedir confirmacion o mostrar warning.

## 13. Solo Dos Categorias Principales

La UX debe evitar una lista larga de tipos.

El usuario solo debe elegir:

- `Material de la oposicion`
- `Tests antiguos`

Internamente pueden seguir existiendo tipos como:

- `syllabus`
- `notes`
- `law`
- `old_test`
- `official_exam`
- `other`

Pero esos detalles no deben complicar la primera carga.

## 14. Modelo De Lote De Subida

Reutilizar o adaptar `material_import_batches`.

Asegurar o anadir:

```text
upload_category
```

Valores:

- `opposition_material`
- `old_tests`
- `mixed`

Campos recomendados:

- `id`
- `workspace_id`
- `opposition_id`
- `uploaded_by`
- `status`
- `source_type`
- `upload_category`
- `original_filename`
- `total_files`
- `imported_files`
- `skipped_files`
- `failed_files`
- `analyzed_files`
- `errors`
- `warnings`
- `created_at`
- `updated_at`

`source_type`:

- `zip`
- `folder`
- `multi_file`

`status`:

- `pending`
- `processing`
- `completed`
- `completed_with_errors`
- `failed`

## 15. Modelo De Item Importado

Reutilizar o adaptar `material_import_items`.

Asegurar o anadir:

- `upload_category`
- `detected_category`
- `ai_classification_confidence`

Campos recomendados:

- `id`
- `batch_id`
- `workspace_id`
- `opposition_id`
- `material_id`
- `topic_id`
- `original_path`
- `original_filename`
- `upload_category`
- `detected_category`
- `status`
- `error`
- `created_at`
- `updated_at`

`detected_category`:

- `opposition_material`
- `old_tests`
- `unknown`

## 16. Reglas De Clasificacion

La clasificacion principal viene de la eleccion del usuario.

- Si el usuario elige `Material de la oposicion`, todos los archivos se tratan como material de estudio, salvo evidencia clara de que son tests.
- Si el usuario elige `Tests antiguos`, todos los archivos se tratan como tests antiguos.
- Si sube un ZIP combinado con carpetas principales, la app puede clasificar por carpeta.
- La IA puede sugerir reclasificacion, pero no debe cambiar de forma silenciosa sin mostrarlo.

## 17. Desglose Por Carpetas

Para material de oposicion:

- Carpeta principal = tema sugerido.
- Subcarpeta = subtema sugerido.
- PDF = material asociado.

Para tests antiguos:

- Carpeta = grupo o ano.
- PDF = test antiguo / examen.

Los tests antiguos no deben crear temas de estudio definitivos automaticamente. Pueden aportar cobertura tematica como analisis, no como temario aplicado.

## 18. Extraccion De Texto

Cada PDF debe pasar por extraccion basica de texto.

Estados:

- `not_started`
- `processing`
- `completed`
- `failed`
- `not_supported`

Si un PDF es escaneado y no tiene texto:

```text
extraction_status = not_supported
```

No implementar OCR.

La UI debe mostrar:

- Texto extraido.
- No se pudo extraer texto.
- PDF escaneado/no compatible.

## 19. Flujo Para Material De Oposicion

Flujo esperado:

```text
Usuario pulsa Subir material
  -> Elige Material de la oposicion
  -> Sube ZIP/carpeta/PDFs
  -> App desglosa archivos
  -> Crea materiales
  -> Extrae texto
  -> IA propone indice de temario
  -> Admin revisa indice
  -> Admin aplica indice
  -> Materiales quedan asociados a temas
```

Regla:

- No se generan preguntas automaticamente en esta spec, salvo que ya exista un boton posterior explicito de generar preguntas.

## 20. Flujo Para Tests Antiguos

Flujo esperado:

```text
Usuario pulsa Subir material
  -> Elige Tests antiguos
  -> Sube ZIP/carpeta/PDFs
  -> App desglosa archivos
  -> Crea materiales tipo old_test/official_exam
  -> Extrae texto
  -> IA analiza estilo, dificultad y cobertura
  -> Guarda resumen de patrones
  -> Ese resumen se usa como contexto futuro para generar preguntas
```

Los tests antiguos sirven para:

- Entender estilo de examen.
- Detectar temas frecuentes.
- Detectar dificultad.
- Detectar forma de redactar opciones.
- Detectar cobertura aproximada.

No sirven para:

- Crear preguntas validadas automaticamente.
- Copiar preguntas sin revision.
- Crear tests directos para estudiantes sin banco validado.

## 21. Analisis IA Combinado

Cuando existan ambos tipos de material:

- Material de oposicion = base de conocimiento y temario.
- Tests antiguos = estilo, dificultad y frecuencia.

Resultado deseado:

- Indice de temario propuesto.
- Materiales asociados a cada tema.
- Resumen de temas frecuentes en tests antiguos.
- Notas de estilo de examen.
- Recomendaciones para generacion futura de preguntas.

## 22. Modelo De Resumen De Tests Antiguos

Crear o reutilizar modelo similar a `ExamPatternSummary`.

Campos recomendados:

- `id`
- `workspace_id`
- `opposition_id`
- `batch_id`
- `material_id`
- `detected_question_count`
- `detected_topics`
- `difficulty_notes`
- `style_notes`
- `coverage_notes`
- `warnings`
- `created_at`
- `updated_at`

Este resumen no es banco de preguntas. Es contexto.

## 23. Relacion Con AI Syllabus Index Builder

Esta spec debe conectar directamente con la SPEC 019.

Despues de importar material de oposicion, la app debe poder lanzar:

```text
Crear indice con IA
```

Idealmente, despues de la carga, mostrar:

```text
Se han subido 57 documentos.
Quieres que la IA proponga un indice de temario?
[Crear indice con IA]
```

Si tambien hay tests antiguos:

```text
Tambien se han detectado 12 tests antiguos.
La IA los usara para analizar estilo y cobertura.
```

## 24. Relacion Con Generacion De Preguntas

Flujo correcto:

```text
Indice aprobado
  -> Materiales asociados
  -> Admin pulsa Generar preguntas
  -> IA genera preguntas candidatas
  -> Preguntas quedan pending_review o needs_fix
  -> Admin revisa
  -> Preguntas validated
  -> Tests para estudiantes
```

No hacer:

```text
Carga de ZIP
  -> Preguntas validated automaticas
```

## 25. Relacion Con Generacion De Tests

Los tests para estudiantes deben seguir generandose solo desde preguntas validadas.

Los tests antiguos subidos no son tests activos para estudiantes por defecto.

Correcto:

```text
Tests antiguos -> contexto de estilo
Banco validado -> tests de estudiantes
```

Incorrecto:

```text
Tests antiguos PDF -> test directo para estudiante sin revision
```

## 26. Pantalla De Resumen De Importacion

Despues de subir, mostrar resumen:

```text
Importacion completada

Material de la oposicion:
- 42 archivos importados
- 38 con texto extraido
- 4 sin texto extraible

Tests antiguos:
- 12 archivos importados
- 11 con texto extraido
- 1 sin texto extraible

Siguiente paso recomendado:
[Crear indice con IA]
```

Si hay errores:

```text
5 archivos omitidos por formato no permitido.
2 PDFs no tenian texto extraible.
```

## 27. Seguridad ZIP/Carpeta

Mantener y reforzar validaciones:

- No rutas `../`.
- No rutas absolutas.
- No ZIPs anidados.
- No extensiones peligrosas.
- No archivos demasiado grandes.
- No demasiados archivos.
- No nombres vacios.
- No sobrescribir archivos existentes.
- No guardar archivos en repo.
- No exponer rutas internas.

Limites recomendados:

- Tamano maximo ZIP: 200 MB.
- Maximo archivos por lote: 500.
- Tamano maximo por archivo: 50 MB.

Si el stack necesita otros limites, documentarlo.

## 28. Supabase Y Almacenamiento

Esta spec debe ser compatible con Supabase.

Si ya existe Supabase Storage configurado, puede usarse.

Si no existe, mantener el almacenamiento actual, pero:

- Metadata en Supabase.
- `storage_path` interno.
- Archivos fuera del repo.
- Sin URLs publicas inseguras.

No implementar una migracion grande a Supabase Storage si complica la spec.

Si se detecta que Supabase Storage es necesario, documentar una spec futura:

```text
SPEC 030 - Supabase Storage for Private Materials
```

## 29. Permisos

Puede subir material:

- `owner`
- `admin`
- `manager` autorizado
- `premium owner` en workspace personal

No puede subir material:

- `student`
- Usuario sin acceso.
- Usuario eliminado.

Student puede ver solo:

- `material active`
- `topic active`
- `opposition_access active`

Student no debe ver:

- Import batches.
- Errores internos de importacion.
- Material obsolete.
- Material needs_review.
- Tests antiguos internos como fuente de generacion.

## 30. Estados De Material Tras Subida

Para material de oposicion:

- `status = active`
- `type = syllabus` por defecto

Para tests antiguos:

- `status = active`
- `type = old_test` por defecto

Si la IA o extraccion detecta problema:

- `status = needs_review`

Ejemplos:

- PDF sin texto.
- Archivo ambiguo.
- Archivo posiblemente mal clasificado.

## 31. UI Recomendada

Pantalla/modal:

```text
Subir material

Que vas a subir?

( ) Material de la oposicion
    Temario, apuntes, leyes, PDFs de estudio.

( ) Tests antiguos
    Examenes anteriores, simulacros, modelos de examen.

[Subir ZIP]
[Subir carpeta]
[Subir PDFs]

Opciones:
[ ] Crear indice con IA despues de importar
[ ] Analizar tests antiguos para estilo y cobertura
```

Recomendacion MVP:

- Activar por defecto `Crear indice con IA despues de importar` para material de oposicion.
- Activar por defecto `Analizar tests antiguos` para tests antiguos.
- No generar preguntas automaticamente por defecto.

## 32. Mensajes Visibles

Ejemplos:

- Material subido correctamente.
- La IA ha propuesto un indice de temario pendiente de revision.
- Se han analizado los tests antiguos como referencia de estilo y dificultad.
- Algunos PDFs no tenian texto extraible. Puedes revisarlos manualmente.
- No se han generado preguntas todavia. Primero revisa el temario propuesto.

## 33. Errores Recomendados

- `SMART_UPLOAD_ACCESS_DENIED`
- `SMART_UPLOAD_OPPOSITION_REQUIRED`
- `SMART_UPLOAD_FILE_REQUIRED`
- `SMART_UPLOAD_INVALID_CATEGORY`
- `SMART_UPLOAD_INVALID_FILE_TYPE`
- `SMART_UPLOAD_ZIP_TOO_LARGE`
- `SMART_UPLOAD_TOO_MANY_FILES`
- `SMART_UPLOAD_UNSAFE_PATH`
- `SMART_UPLOAD_NESTED_ZIP_NOT_ALLOWED`
- `SMART_UPLOAD_STORAGE_FAILED`
- `SMART_UPLOAD_EXTRACTION_FAILED`
- `SMART_UPLOAD_AI_INDEX_FAILED`
- `SMART_UPLOAD_OLD_TEST_ANALYSIS_FAILED`
- `SMART_UPLOAD_NO_ANALYZABLE_TEXT`
- `SMART_UPLOAD_FOLDER_NOT_SUPPORTED`

## 34. Tests Obligatorios

Debe haber tests para:

### Upload Basico

- Owner puede subir material.
- Student no puede subir material.
- Usuario sin acceso no puede subir material.
- Se puede subir ZIP.
- Se pueden subir multiples PDFs.
- Carpeta se acepta si esta soportada.
- Si carpeta no esta soportada, la UI recomienda ZIP.

### Categorias

- Material de oposicion crea materiales tipo `syllabus`.
- Tests antiguos crean materiales tipo `old_test`.
- ZIP combinado detecta carpeta `Material de la oposicion`.
- ZIP combinado detecta carpeta `Tests antiguos`.
- Clasificacion ambigua queda con warning.

### Desglose

- Carpetas de material crean sugerencias de temas.
- Subcarpetas crean sugerencias de subtemas.
- PDFs se asocian a tema sugerido.
- Tests antiguos no crean temas definitivos automaticamente.
- Tests antiguos crean resumen de patrones.

### Extraccion

- PDF con texto queda `completed`.
- PDF sin texto queda `not_supported`.
- TXT/MD se guarda como `content_text`.
- Error de extraccion queda registrado.

### Seguridad

- ZIP con `../` se rechaza.
- ZIP con ruta absoluta se rechaza.
- ZIP anidado se rechaza.
- Extension peligrosa se rechaza.
- Archivo demasiado grande se rechaza.
- Lote demasiado grande se rechaza.

### IA

- Material de oposicion puede lanzar indice IA.
- Indice IA queda pendiente de revision.
- Indice IA no se aplica sin aprobacion.
- Tests antiguos generan resumen de estilo/cobertura.
- Tests antiguos no generan preguntas validadas.
- No se generan tests directos para estudiantes.

### Supabase/Permisos

- Materials se guardan en Supabase.
- Import batch se guarda en Supabase.
- Import items se guardan en Supabase.
- Student no ve batches internos.
- Student solo ve material active autorizado.
- RLS no se rompe.

## 35. Documentacion

Crear o actualizar:

```text
docs/user-guides/upload-material.md
docs/qa/smart-bulk-upload-test-plan.md
docs/architecture/material-ingestion.md
```

`docs/user-guides/upload-material.md` debe explicar:

- Que es Material de la oposicion.
- Que es Tests antiguos.
- Como preparar un ZIP.
- Como preparar carpetas.
- Que formatos se aceptan.
- Que pasa despues de subir.
- Por que las preguntas no se generan validadas automaticamente.

`docs/qa/smart-bulk-upload-test-plan.md` debe incluir pruebas manuales:

- Subir ZIP solo de material.
- Subir ZIP solo de tests antiguos.
- Subir ZIP combinado.
- Subir carpeta si esta soportado.
- Subir PDFs sueltos.
- Subir ZIP con archivos invalidos.
- Subir PDF escaneado.
- Comprobar indice IA.
- Comprobar analisis de tests antiguos.
- Comprobar permisos student.

`docs/architecture/material-ingestion.md` debe explicar:

- Upload.
- Batch.
- Items.
- Materials.
- Text extraction.
- AI syllabus index.
- Old exam pattern analysis.
- Question generation later.
- Human review.
- Validated pool.
- Student tests.

## 36. Criterios De Aceptacion

La tarea se considera completada cuando:

- El boton `Subir material` permite iniciar carga masiva.
- El usuario puede elegir entre `Material de la oposicion` y `Tests antiguos`.
- Se pueden subir ZIPs.
- Se pueden subir multiples PDFs.
- Se pueden subir carpetas si el stack lo permite.
- El ZIP/carpeta se desglosa correctamente.
- Cada PDF crea un material.
- Cada material queda asociado a workspace/opposition.
- Los materiales de oposicion pueden alimentar el indice IA.
- Los tests antiguos alimentan analisis de estilo/cobertura.
- La IA propone temario pero no lo aplica sin revision.
- No se generan preguntas validadas automaticamente.
- No se generan tests directos para estudiantes desde PDFs.
- Student no puede subir material.
- Student solo ve material activo autorizado.
- Supabase sigue funcionando.
- RLS no se rompe.
- Tests criticos pasan.
- Existe documentacion.

## 37. Prompt Para Claude

Claude, implementa la SPEC 028 - Smart Bulk Upload: Materials & Old Exams.

Antes de Beta Readiness necesitamos mejorar a fondo el boton `Subir material`.

El usuario debe poder subir:

- ZIPs con muchos PDFs.
- Carpetas con muchos PDFs, si el stack/navegador lo permite.
- Varios PDFs a la vez.

Solo habra dos categorias principales de carga:

1. Material de la oposicion.
2. Tests antiguos.

Debes implementar:

- UI clara para `Subir material`.
- Seleccion de categoria.
- Subida ZIP.
- Subida multiple de PDFs.
- Subida de carpeta si es viable.
- Desglose de carpetas.
- Creacion de materials.
- Creacion de import batches/items.
- Extraccion de texto.
- Clasificacion por categoria.
- Conexion con AI Syllabus Index Builder.
- Analisis de tests antiguos como estilo/cobertura.
- Resumen de importacion.
- Tests criticos.
- Documentacion.

Reglas obligatorias:

- La IA propone temario, pero no lo aplica sin revision humana.
- Tests antiguos son contexto, no preguntas validadas automaticas.
- No se generan tests directos para estudiantes desde PDFs.
- No se generan preguntas `validated` automaticamente.
- Los tests de estudiantes siguen usando solo preguntas `validated`.
- Student no puede subir material.
- Student solo ve material activo autorizado.
- Mantener Supabase y RLS.
- No exponer rutas internas ni service role.
- No implementar OCR, RAG avanzado, embeddings ni fine-tuning.

Objetivo:

```text
Que el usuario pueda subir una carpeta o ZIP con todo el material de la oposicion y tests antiguos, y que TESTOPO lo desglose y lo convierta en una base organizada para generar temario y preguntas fiables.
```
