# SPEC 028-B - Document Classification & Import Inventory

## 1. Objetivo

Mejorar la ingestion documental de TESTOPO para que, despues de subir ZIPs,
carpetas o varios PDFs, la app entienda claramente que es cada archivo.

Esta spec responde a una unica pregunta:

> Que es cada archivo que se ha subido?

La app debe clasificar los documentos importados y mostrar un inventario
revisable por admin/owner antes de cualquier paso posterior.

## 2. Alcance exacto

Esta spec implementa solo:

- Clasificacion documental.
- Inventario de documentos importados.
- Revision humana de clasificacion.
- Estados claros para documentos dudosos, no analizables o irrelevantes.
- Persistencia en Supabase con fallback InMemory.
- RLS/guards para que Student no vea inventario interno.

Esta spec no implementa:

- Indice de temario.
- Generacion de preguntas.
- Generacion o modificacion de tests.
- Busqueda avanzada dentro de PDFs.
- OCR.
- RAG.
- Embeddings.
- Fine-tuning.
- Base vectorial.

## 3. Branch

Usar o crear:

```text
feature/document-classification-inventory
```

## 4. Contexto

Specs relacionadas:

- SPEC 012 - PDF Material Upload & Basic Text Extraction.
- SPEC 017 - Unified Syllabus & Bulk Material Import.
- SPEC 019 - AI Syllabus Index Builder.
- SPEC 020-024 - migracion principal a Supabase.
- SPEC 025 - Supabase RLS Hardening.
- SPEC 026 - Account Deletion Edge Function.
- SPEC 027 - Pre-Beta QA & Data Consistency.
- SPEC 028 - Smart Bulk Upload: Materials & Old Exams.

SPEC 028 permite subir ZIPs, carpetas y PDFs. SPEC 028-B se centra en entender
lo subido antes de construir indices o generar preguntas.

## 5. Principio central

Flujo correcto:

```text
Usuario sube ZIP/PDFs
-> App extrae texto
-> App clasifica documentos
-> Admin revisa inventario
-> Admin corrige si hace falta
-> Documentos quedan clasificados
```

Flujo incorrecto:

```text
Usuario sube ZIP/PDFs
-> IA genera indice o preguntas sin saber que es cada documento
```

## 6. Categorias documentales

Cada material importado debe tener una clasificacion documental.

Valores internos:

- `syllabus_material`
- `old_exam_or_test`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`
- `irrelevant`
- `not_analyzable`
- `ambiguous`

Valores visibles:

- Temario / material de estudio
- Test antiguo / examen
- Texto legal
- Apuntes o resumen
- Indice o tabla de contenidos
- Irrelevante
- No analizable
- Dudoso

## 7. Definicion de categorias

### 7.1 `syllabus_material`

Documento que contiene desarrollo teorico, temario oficial, manual o contenido
de estudio.

Ejemplos:

- `Tema 1 Constitucion.pdf`
- `Tema 4 Procedimiento administrativo.pdf`
- `Manual Administrativo Bloque I.pdf`

### 7.2 `old_exam_or_test`

Documento que contiene preguntas de examen, simulacros, tests antiguos o
modelos de examen.

Senales:

- Preguntas numeradas.
- Opciones A/B/C/D.
- Plantilla de respuestas.
- Palabras como "examen oficial", "simulacro" o "test".

### 7.3 `legal_text`

Documento principalmente normativo.

Ejemplos:

- `Ley 39/2015.pdf`
- `Constitucion Espanola.pdf`
- `Estatuto Basico del Empleado Publico.pdf`

### 7.4 `notes_or_summary`

Apuntes, esquemas o resumenes.

Ejemplos:

- `Resumen Tema 2.pdf`
- `Esquema plazos.pdf`
- `Cuadro comparativo recursos.pdf`

### 7.5 `index_or_table_of_contents`

Documento que contiene principalmente un indice, programa o lista de temas.

Ejemplos:

- `Programa oficial.pdf`
- `Indice temario.pdf`
- `Distribucion temas.pdf`

### 7.6 `irrelevant`

Documento que no sirve para generar temario ni preguntas.

Ejemplos:

- Publicidad.
- Portadas sueltas.
- Instrucciones comerciales.
- Documento ajeno a la oposicion.

### 7.7 `not_analyzable`

Documento que no puede analizarse porque no tiene texto extraible o esta
corrupto.

Ejemplos:

- PDF escaneado sin OCR.
- Archivo danado.
- PDF vacio.

### 7.8 `ambiguous`

Documento dudoso que la IA o la heuristica no puede clasificar con seguridad.
Debe requerir revision humana.

## 8. Modelo `DocumentUnderstandingRun`

Crear o adaptar una entidad para registrar cada ejecucion de clasificacion
documental.

Campos recomendados:

- `id`
- `workspace_id`
- `opposition_id`
- `batch_id`
- `created_by`
- `status`
- `provider`
- `model`
- `total_materials`
- `classified_materials`
- `needs_review_count`
- `not_analyzable_count`
- `warnings`
- `errors`
- `created_at`
- `updated_at`

Estados:

- `pending`
- `processing`
- `completed`
- `completed_with_warnings`
- `failed`

## 9. Modelo `DocumentClassification`

Crear o adaptar una entidad para guardar la clasificacion por material.

Campos recomendados:

- `id`
- `workspace_id`
- `opposition_id`
- `material_id`
- `run_id`
- `classification`
- `confidence`
- `reason`
- `detected_title`
- `detected_document_date`
- `detected_question_count`
- `detected_page_count`
- `needs_review`
- `manually_corrected`
- `corrected_by`
- `corrected_at`
- `warnings`
- `created_at`
- `updated_at`

## 10. Reglas de clasificacion

La clasificacion debe usar:

- Nombre del archivo.
- Ruta dentro del ZIP/carpeta.
- Categoria elegida por el usuario al subir.
- Texto extraido.
- Primeras paginas o fragmentos representativos.
- Senales de preguntas tipo test.
- Senales de desarrollo teorico.

La IA o proveedor de clasificacion debe devolver:

- `classification`
- `confidence`
- `reason`
- `warnings`
- `detected_question_count`, si aplica.
- `detected_title`, si puede.

## 11. Confianza

`confidence` debe ser un valor entre `0` y `1`.

Reglas recomendadas:

- `confidence >= 0.75` - clasificacion aceptable.
- `confidence < 0.75` - `needs_review = true`.
- `not_analyzable` - `needs_review = true`.
- `ambiguous` - `needs_review = true`.
- `irrelevant` - `needs_review = true` en MVP.

El umbral puede ser configurable.

## 12. Estado del material segun clasificacion

Documento claro y util:

- `material.status = active`
- `needs_review = false`

Documento dudoso:

- `material.status = needs_review`
- `classification = ambiguous`
- `needs_review = true`

Documento no analizable:

- `material.status = needs_review`
- `classification = not_analyzable`
- `needs_review = true`

Documento irrelevante:

- `material.status = needs_review`
- `classification = irrelevant`
- `needs_review = true`

No marcar automaticamente como `obsolete` sin revision humana.

## 13. Prompt de clasificador documental

Crear:

```text
prompts/document-classifier.md
```

Contenido base recomendado:

```text
# TESTOPO Document Classifier Prompt

Eres un clasificador documental para una app de oposiciones.
Tu tarea es analizar el texto extraido de un documento y clasificarlo.

Clasificaciones posibles:
- syllabus_material
- old_exam_or_test
- legal_text
- notes_or_summary
- index_or_table_of_contents
- irrelevant
- not_analyzable
- ambiguous

Reglas obligatorias:
1. Usa solo el texto proporcionado.
2. Ten en cuenta el nombre del archivo y la ruta original si existen.
3. Distingue claramente temario de tests antiguos.
4. Si el documento contiene preguntas con opciones A/B/C/D, probablemente es old_exam_or_test.
5. Si contiene desarrollo teorico, probablemente es syllabus_material, legal_text o notes_or_summary.
6. Si es una ley o norma, marca legal_text.
7. Si es solo un indice o programa, marca index_or_table_of_contents.
8. Si no hay texto suficiente, marca not_analyzable.
9. Si no estas seguro, marca ambiguous.
10. No generes preguntas.
11. No generes temario.
12. No generes indice.
13. Devuelve salida estructurada.

Devuelve:
- classification
- confidence
- reason
- detected_title
- detected_question_count
- warnings
```

## 14. Proveedor IA y fallback heuristico

Usar la arquitectura existente de proveedores IA.

- OpenAI puede ser proveedor principal si ya esta configurado.
- Tests unitarios no deben llamar a OpenAI.
- Debe existir mock provider para resultados previsibles.
- Si no hay IA configurada, debe existir clasificacion heuristica basica.

Heuristicas minimas:

- Nombre o texto contiene "test", "examen", "simulacro" o preguntas con opciones
  A/B/C/D - `old_exam_or_test` probable.
- Nombre o texto contiene "ley", "constitucion", "real decreto" - `legal_text`
  probable.
- Nombre contiene "tema" o hay desarrollo teorico - `syllabus_material`
  probable.
- Nombre contiene "resumen", "esquema" o "cuadro" - `notes_or_summary`
  probable.
- Nombre contiene "indice", "programa" o "temario oficial" con lista de temas -
  `index_or_table_of_contents` probable.
- Sin texto extraido - `not_analyzable`.
- Baja confianza - `ambiguous` y `needs_review = true`.

## 15. Inventario documental

Despues de una importacion debe existir una pantalla o seccion de inventario.

Ejemplo:

```text
Documentos importados

Temario / material de estudio
- Tema 1 Constitucion.pdf - confianza alta
- Procedimiento Administrativo.pdf - confianza media

Tests antiguos / examenes
- Examen 2021.pdf - 80 preguntas detectadas
- Simulacro 2022.pdf - 60 preguntas detectadas

Dudosos
- Documento sin titulo.pdf - revisar

No analizables
- Escaneo Tema 4.pdf - sin texto extraible
```

## 16. Acciones del inventario

El admin/owner debe poder:

- Ver clasificacion.
- Ver confianza.
- Ver razon.
- Ver warnings.
- Corregir clasificacion.
- Marcar como temario.
- Marcar como test antiguo.
- Marcar como texto legal.
- Marcar como apuntes/resumen.
- Marcar como indice/tabla de contenidos.
- Marcar como irrelevante.
- Marcar como necesita revision.

La correccion humana debe prevalecer sobre la clasificacion IA.

Al corregir:

- `manually_corrected = true`
- `corrected_by = current_user.id`
- `corrected_at = now()`

## 17. Permisos

Puede ver y corregir inventario:

- `owner`
- `admin`
- manager autorizado, si existe en el modelo.
- premium owner en workspace personal.

No puede ver ni corregir inventario:

- `student`
- usuario sin acceso.
- usuario eliminado.

Student no debe ver:

- `DocumentUnderstandingRun`
- `DocumentClassification`
- inventario interno
- warnings internos
- razones de clasificacion

Student solo ve materiales activos permitidos segun reglas previas.

### 17.1 Correccion de bloqueo heredado de SPEC 028

SPEC 028 dejo un riesgo: los materiales `old_test`/`official_exam` activos
pueden aparecer en la lista de materiales del estudiante si solo se filtra por
`status = active`.

Esta spec debe cerrar ese riesgo:

- Student no debe ver documentos clasificados como `old_exam_or_test`.
- Student no debe ver documentos clasificados como `irrelevant`,
  `not_analyzable` o `ambiguous`.
- Student no debe ver clasificaciones ni metadatos internos.
- La lista de materiales para Student debe limitarse a material de estudio activo
  y permitido.

## 18. Relacion con Supabase

Guardar en Supabase:

- `document_understanding_runs`
- `document_classifications`

O nombres equivalentes si el proyecto ya tiene una convencion distinta.

Aplicar RLS:

- Owner/admin/manager puede leer y gestionar clasificaciones de su oposicion.
- Student no puede leer clasificaciones internas.
- No cruzar workspaces.
- No cruzar oposiciones.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend.

## 19. Migracion Supabase

Crear migracion:

```text
supabase/migrations/028_b_document_classification_inventory.sql
```

Debe crear:

- `document_understanding_runs`
- `document_classifications`

Indices recomendados:

- `workspace_id`
- `opposition_id`
- `batch_id`
- `material_id`
- `classification`
- `needs_review`
- `created_by`

## 20. Relacion con indice de temario

Esta spec no genera indice.

Deja preparado el terreno para una futura SPEC 028-C - AI Syllabus Index From
Classified Documents.

Condicion futura:

El indice solo podra usar documentos clasificados como:

- `syllabus_material`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`

Y no debera usar como fuente principal:

- `old_exam_or_test`
- `irrelevant`
- `not_analyzable`
- `ambiguous`

## 21. Relacion con generacion de preguntas

Esta spec no genera preguntas.

Regla preparada para futuras specs:

No se deben generar preguntas desde documentos:

- `not_analyzable`
- `irrelevant`
- `ambiguous` sin revision humana.

## 22. Mensajes visibles

Ejemplos:

- `Documentos analizados correctamente.`
- `La app ha detectado 38 documentos de temario y 12 tests antiguos.`
- `Hay 4 documentos que necesitan revision.`
- `Este PDF no contiene texto extraible. Revisalo manualmente.`
- `Clasificacion corregida correctamente.`

## 23. Errores recomendados

- `DOCUMENT_CLASSIFICATION_ACCESS_DENIED`
- `DOCUMENT_CLASSIFICATION_MATERIAL_REQUIRED`
- `DOCUMENT_CLASSIFICATION_MATERIAL_NOT_FOUND`
- `DOCUMENT_CLASSIFICATION_TEXT_REQUIRED`
- `DOCUMENT_CLASSIFICATION_PROVIDER_NOT_CONFIGURED`
- `DOCUMENT_CLASSIFICATION_FAILED`
- `DOCUMENT_CLASSIFICATION_INVALID_OUTPUT`
- `DOCUMENT_CLASSIFICATION_LOW_CONFIDENCE`
- `DOCUMENT_CLASSIFICATION_NOT_ANALYZABLE`
- `DOCUMENT_CLASSIFICATION_UPDATE_FAILED`
- `DOCUMENT_UNDERSTANDING_RUN_NOT_FOUND`

## 24. Tests obligatorios

### Clasificacion

- PDF con preguntas se clasifica como `old_exam_or_test`.
- PDF con desarrollo teorico se clasifica como `syllabus_material`.
- PDF legal se clasifica como `legal_text`.
- PDF de apuntes se clasifica como `notes_or_summary`.
- Documento indice se clasifica como `index_or_table_of_contents`.
- PDF sin texto se clasifica como `not_analyzable`.
- Documento dudoso queda como `ambiguous`.
- Clasificacion con baja confianza marca `needs_review`.

### Inventario

- Se crea `DocumentUnderstandingRun`.
- Se crea `DocumentClassification` por material.
- El inventario agrupa documentos por clasificacion.
- El inventario muestra documentos `needs_review`.
- El inventario muestra razon y confianza.

### Correccion humana

- Admin puede corregir clasificacion.
- Student no puede corregir clasificacion.
- Correccion humana marca `manually_corrected`.
- Correccion humana prevalece sobre IA.

### Permisos

- Student no ve inventario interno.
- Student no ve clasificaciones internas.
- Owner/admin ve inventario de su oposicion.
- Owner/admin no ve inventario de oposicion ajena.
- No se cruzan workspaces.

### Regresion

- ZIP upload sigue funcionando.
- PDF upload sigue funcionando.
- Import batches siguen funcionando.
- No se genera indice en esta spec.
- No se generan preguntas en esta spec.
- No se rompe Supabase/RLS.
- Mock provider funciona sin llamadas externas.

## 25. Documentacion

Crear o actualizar:

- `docs/architecture/document-classification.md`
- `docs/user-guides/upload-material.md`
- `docs/qa/document-classification-test-plan.md`

## 26. Criterios de aceptacion

La tarea se considera completada cuando:

- La app clasifica documentos importados.
- Distingue temario de tests antiguos.
- Detecta PDFs no analizables.
- Detecta documentos dudosos.
- Crea inventario documental.
- Permite correccion humana.
- La correccion humana prevalece sobre la IA.
- Student no ve inventario interno.
- Student no ve tests antiguos internos ni documentos no aptos.
- Los datos se guardan en Supabase con RLS.
- ZIP/PDF upload sigue funcionando.
- No se genera indice todavia.
- No se generan preguntas todavia.
- No se implementa OCR, RAG ni embeddings.
- Tests criticos pasan.
- Existe documentacion.

## 27. Instrucciones para Claude

Claude debe implementar esta spec usando el tooling/runbook existente:

- Seguir `docs/setup/migrations-runbook.md`.
- No crear un proceso paralelo de migracion.
- Mantener fallback InMemory.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` fuera del frontend.
- No implementar indice, preguntas, tests, OCR, RAG ni embeddings.
- Priorizar guards de aplicacion y RLS.
- Anadir tests de backend/frontend proporcionales al riesgo.
- Documentar cambios en arquitectura, guia de usuario y QA.

