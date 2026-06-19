# SPEC 028-C - Material Sections & Source References

## 1. Objetivo

Crear una capa de secciones y referencias de fuente para los materiales
importados en TESTOPO.

La app ya puede:

- Subir ZIPs/PDFs.
- Extraer texto.
- Clasificar documentos.
- Crear inventario documental.

Ahora debe poder:

```text
Entrar en cada documento
-> Dividirlo en partes utiles
-> Guardar paginas, fragmentos y referencias
-> Preparar fuentes concretas para indice y preguntas futuras
```

Esta spec no genera indice ni preguntas.

## 2. Alcance exacto

Esta spec implementa:

- `MaterialSection`.
- `SourceReference`.
- Fragmentacion basica de texto.
- Referencias de pagina o rango.
- Extractos utiles.
- Asociacion de secciones al material original.
- Busqueda basica por texto.
- Preparacion para indice futuro.
- Preparacion para generacion futura con fuente concreta.
- Permisos, RLS y fallback InMemory.

No implementa:

- Indice de temario con IA.
- Generacion de preguntas.
- Generacion de tests.
- RAG avanzado.
- Embeddings.
- Base vectorial.
- OCR.
- Fine-tuning.
- Resumen automatico largo de documentos.

## 3. Branch

Usar o crear:

```text
feature/material-sections-source-references
```

## 4. Contexto

Specs relacionadas:

- SPEC 012 - PDF Material Upload & Basic Text Extraction.
- SPEC 017 - Unified Syllabus & Bulk Material Import.
- SPEC 028 - Smart Bulk Upload: Materials & Old Exams.
- SPEC 028-B - Document Classification & Import Inventory.

SPEC 028-B clasifica documentos como:

- `syllabus_material`
- `old_exam_or_test`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`
- `irrelevant`
- `not_analyzable`
- `ambiguous`

SPEC 028-C divide documentos utiles en unidades consultables y referenciables.

## 5. Principio central

Una pregunta fiable necesita una fuente concreta.

Antes de generar indice o preguntas, el material debe estar dividido en partes
referenciables.

Flujo correcto:

```text
PDF clasificado
-> Texto extraido
-> Secciones/fragmentos guardados
-> Indice futuro usa esas secciones
-> Pregunta futura cita seccion/pagina/fragmento concreto
```

Flujo incorrecto:

```text
PDF entero
-> IA genera pregunta sin saber de que pagina o fragmento sale
```

## 6. Que es una seccion

Una `MaterialSection` representa una parte util de un material.

Puede ser:

- Una pagina.
- Un rango de paginas.
- Un epigrafe detectado.
- Un fragmento de texto.
- Un bloque logico de contenido.

Para MVP no hace falta detectar perfectamente todos los epigrafes. La prioridad
es guardar fragmentos utiles con referencia al documento original.

## 7. Materiales elegibles

Crear secciones solo para materiales con:

- `extraction_status = completed`
- `content_text` disponible
- clasificacion util

Clasificaciones utiles:

- `syllabus_material`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`
- `old_exam_or_test`

No crear secciones para:

- `not_analyzable`
- `irrelevant`
- `ambiguous` sin revision/correccion humana

Si un documento `ambiguous` fue corregido manualmente a una clasificacion util,
si puede procesarse.

## 8. Modelo `MaterialSection`

Crear tabla/modelo:

```text
material_sections
```

Campos recomendados:

- `id`
- `workspace_id`
- `opposition_id`
- `material_id`
- `section_title`
- `section_type`
- `page_start`
- `page_end`
- `content_excerpt`
- `content_text`
- `order_index`
- `classification`
- `source_path`
- `status`, opcional pero recomendado
- `created_at`
- `updated_at`

## 9. Campos de `MaterialSection`

`material_id`: referencia al material original.

`section_title`: titulo detectado o generado.

Ejemplos:

- `Pagina 1`
- `Articulo 14`
- `Tema 2 - Procedimiento Administrativo`
- `Fragmento 3`

Si no puede detectarse titulo, usar uno automatico:

- `Fragmento 1`
- `Fragmento 2`
- `Pagina 1`
- `Pagina 2`

`section_type`: valores recomendados:

- `page`
- `heading`
- `chunk`
- `exam_question_block`
- `toc_block`
- `unknown`

`page_start` / `page_end`: si se conocen paginas, guardarlas. Si no se conocen,
pueden quedar `null`.

`content_excerpt`: fragmento corto para mostrar en UI o usar como referencia.

`content_text`: texto completo de la seccion.

`classification`: clasificacion heredada o refinada:

- `study_content`
- `legal_content`
- `summary_content`
- `index_content`
- `old_exam_content`
- `unknown`

`source_path`: referencia legible al origen.

Ejemplo:

```text
Tema 1 Constitucion.pdf - paginas 3-4
```

`status`, si se anade:

- `active`
- `needs_review`
- `obsolete`

## 10. Modelo `SourceReference`

Crear tabla/modelo:

```text
source_references
```

Campos recomendados:

- `id`
- `workspace_id`
- `opposition_id`
- `material_id`
- `material_section_id`
- `reference_type`
- `label`
- `page_start`
- `page_end`
- `source_excerpt`
- `confidence`
- `created_at`
- `updated_at`

## 11. Para que sirve `SourceReference`

`SourceReference` sera la pieza que usen specs posteriores para decir:

- Este tema sale de este material y de esta pagina.
- Esta pregunta sale de este fragmento.
- Esta explicacion se apoya en esta fuente.

En esta spec no se asocian todavia a preguntas ni a indice definitivo.
Solo se preparan.

## 12. `reference_type`

Valores recomendados:

- `material_section`
- `page_range`
- `excerpt`
- `manual`
- `ai_suggested`

Para esta spec bastan:

- `material_section`
- `page_range`
- `excerpt`

## 13. Estrategia de segmentacion

Para MVP, usar una estrategia simple y robusta.

Orden de preferencia:

1. Si el extractor conserva paginas, crear una seccion por pagina o grupo de
   paginas.
2. Si hay titulos/epigrafes detectables, crear secciones por epigrafe.
3. Si no hay estructura clara, dividir por chunks de tamano razonable.

No buscar perfeccion.

## 14. Segmentacion por paginas

Si el extractor PDF devuelve texto por pagina:

```text
Pagina 1 -> MaterialSection page 1
Pagina 2 -> MaterialSection page 2
Pagina 3 -> MaterialSection page 3
```

Para paginas muy cortas, se pueden agrupar.

Para paginas muy largas, se pueden dividir en chunks.

## 15. Segmentacion por epigrafes

Detectar epigrafes basicos si es sencillo.

Senales:

- `TEMA 1`
- `Tema 1`
- `1.`
- `1.1`
- `Articulo 1`
- `CAPITULO I`
- `TITULO I`

Si se detecta un epigrafe, usarlo como `section_title`.

No implementar un parser juridico complejo.

## 16. Segmentacion por chunks

Si no hay paginas ni epigrafes claros:

- Dividir cada material en bloques de texto.
- Tamano recomendado: 1.500 a 3.000 caracteres.
- Solapamiento opcional: 200 a 400 caracteres.

No implementar embeddings.

## 17. Secciones para tests antiguos

Si un documento esta clasificado como `old_exam_or_test`, crear secciones de
tipo:

- `old_exam_content`
- `exam_question_block`

Si se detectan preguntas numeradas, se pueden agrupar por bloques:

- `Preguntas 1-10`
- `Preguntas 11-20`
- `Preguntas 21-30`

No extraer ni guardar preguntas como banco validado en esta spec. Los tests
antiguos siguen siendo contexto.

## 18. Secciones para textos legales

Si el documento esta clasificado como `legal_text`, intentar detectar:

- Articulo.
- Disposicion.
- Titulo.
- Capitulo.

Solo si es sencillo. Si no, usar paginas o chunks.

## 19. Secciones para indices o programas

Si el documento esta clasificado como `index_or_table_of_contents`, crear
secciones para bloques de indice.

Estos documentos serviran mas adelante como apoyo para proponer indice de
temario. No convertirlos todavia en Topic Map.

## 20. Servicio `MaterialSectionService`

Crear o adaptar un servicio:

```text
MaterialSectionService
```

Responsabilidades:

- Crear secciones para un material.
- Crear secciones para un batch.
- Listar secciones por material.
- Reprocesar secciones de un material.
- Eliminar/reemplazar secciones al reprocesar.

Metodos conceptuales:

- `createSectionsForMaterial(materialId): Promise<MaterialSection[]>`
- `createSectionsForBatch(batchId): Promise<MaterialSection[]>`
- `listByMaterial(materialId): Promise<MaterialSection[]>`
- `reprocessMaterial(materialId): Promise<MaterialSection[]>`

## 21. Servicio `SourceReferenceService`

Crear o adaptar:

```text
SourceReferenceService
```

Responsabilidades:

- Crear referencias de fuente desde secciones.
- Listar referencias por material.
- Listar referencias por seccion.
- Buscar referencias basicas.

Metodos conceptuales:

- `createFromSection(sectionId): Promise<SourceReference>`
- `listByMaterial(materialId): Promise<SourceReference[]>`
- `listBySection(sectionId): Promise<SourceReference[]>`

## 22. Busqueda basica

Crear busqueda simple, no RAG.

La busqueda puede usar:

- Texto plano.
- Coincidencia de palabras.
- Titulo de seccion.
- Titulo de material.
- Clasificacion.

Metodo conceptual:

```ts
searchSections(input): Promise<MaterialSection[]>
```

Entrada:

```ts
{
  oppositionId: string;
  query: string;
  classification?: string;
  materialIds?: string[];
  limit?: number;
}
```

Salida:

- Secciones ordenadas por coincidencia basica.
- No implementar ranking semantico avanzado.

## 23. Uso futuro

Esta spec debe dejar preparado el terreno para:

- SPEC 028-D - AI Syllabus Index From Classified Documents.
- SPEC 028-E - Source-Grounded Question Generation.

Pero no debe implementar esos flujos todavia.

## 24. Relacion con clasificacion documental

Las secciones dependen de la clasificacion de SPEC 028-B.

Reglas:

- `not_analyzable` -> no crear secciones.
- `irrelevant` -> no crear secciones.
- `ambiguous` -> no crear secciones salvo correccion humana.
- `syllabus_material` -> crear secciones.
- `legal_text` -> crear secciones.
- `notes_or_summary` -> crear secciones.
- `index_or_table_of_contents` -> crear secciones.
- `old_exam_or_test` -> crear secciones de contexto.

## 25. Reprocesamiento

Debe permitirse reprocesar secciones si:

- Se corrige una clasificacion.
- Se mejora extraccion de texto.
- Se vuelve a subir un archivo.
- Se cambia estrategia de segmentacion.

Reprocesar debe:

- Eliminar o marcar obsoletas secciones anteriores.
- Crear nuevas secciones.
- Mantener trazabilidad si es sencillo.

Para MVP se puede reemplazar secciones anteriores del mismo material.

## 26. UI minima

Anadir en el inventario documental una vista de detalle:

```text
Documento: Tema 1 Constitucion.pdf
Clasificacion: Temario / material de estudio
Texto extraido: Si

Secciones detectadas:
- Pagina 1
- Pagina 2
- Articulo 1
- Articulo 2
- Fragmento 5

Acciones:
- Ver fragmento
- Reprocesar secciones
```

No mostrar esta vista a Student.

## 27. Permisos

Puede ver secciones internas:

- `owner`
- `admin`
- manager autorizado, si existe en el modelo.
- premium owner en workspace personal.

No puede ver secciones internas:

- `student`
- usuario sin acceso.
- usuario eliminado.

Student solo vera material activo permitido en sus pantallas normales, no la
estructura interna de ingestion.

## 28. Relacion con Supabase

Guardar en Supabase:

- `material_sections`
- `source_references`

Aplicar RLS:

- Owner/admin/manager puede leer y gestionar secciones de su oposicion.
- Student no puede leer secciones internas.
- No cruzar workspaces.
- No cruzar oposiciones.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend.

## 29. Migracion Supabase

Crear migracion:

```text
supabase/migrations/028_c_material_sections_source_references.sql
```

Debe crear:

- `material_sections`
- `source_references`

Indices recomendados:

- `workspace_id`
- `opposition_id`
- `material_id`
- `material_section_id`
- `classification`
- `section_type`
- `order_index`

## 30. Repositorios

Crear repositorios Supabase e InMemory:

- `MaterialSectionRepository`
- `SourceReferenceRepository`

Metodos minimos de `MaterialSectionRepository`:

- `create(input): Promise<MaterialSection>`
- `createMany(input): Promise<MaterialSection[]>`
- `listByMaterial(materialId): Promise<MaterialSection[]>`
- `deleteByMaterial(materialId): Promise<void>`
- `search(input): Promise<MaterialSection[]>`

Metodos minimos de `SourceReferenceRepository`:

- `create(input): Promise<SourceReference>`
- `createMany(input): Promise<SourceReference[]>`
- `listByMaterial(materialId): Promise<SourceReference[]>`
- `listBySection(sectionId): Promise<SourceReference[]>`

## 31. Integracion con factory

Actualizar el factory de repositorios.

En modo Supabase:

- `material_sections` -> Supabase.
- `source_references` -> Supabase.

En modo memory:

- `material_sections` -> InMemory.
- `source_references` -> InMemory.

## 32. Errores recomendados

- `MATERIAL_SECTION_ACCESS_DENIED`
- `MATERIAL_SECTION_MATERIAL_REQUIRED`
- `MATERIAL_SECTION_MATERIAL_NOT_FOUND`
- `MATERIAL_SECTION_TEXT_REQUIRED`
- `MATERIAL_SECTION_NOT_ANALYZABLE`
- `MATERIAL_SECTION_CLASSIFICATION_NOT_ALLOWED`
- `MATERIAL_SECTION_CREATE_FAILED`
- `MATERIAL_SECTION_REPROCESS_FAILED`
- `MATERIAL_SECTION_SEARCH_FAILED`
- `SOURCE_REFERENCE_NOT_FOUND`
- `SOURCE_REFERENCE_CREATE_FAILED`
- `SOURCE_REFERENCE_ACCESS_DENIED`
- `SOURCE_REFERENCE_SECTION_REQUIRED`
- `SOURCE_REFERENCE_MATERIAL_REQUIRED`

## 33. Tests obligatorios

### Creacion de secciones

- Crear secciones para material clasificado como `syllabus_material`.
- Crear secciones para material clasificado como `legal_text`.
- Crear secciones para material clasificado como `notes_or_summary`.
- Crear secciones para material clasificado como `index_or_table_of_contents`.
- Crear secciones para material clasificado como `old_exam_or_test`.
- No crear secciones para `not_analyzable`.
- No crear secciones para `irrelevant`.
- No crear secciones para `ambiguous` no corregido.
- Crear secciones para `ambiguous` corregido manualmente a categoria util.

### Segmentacion

- Si hay paginas, crea secciones por pagina.
- Si hay epigrafes sencillos, usa titulos de seccion.
- Si no hay estructura, crea chunks.
- Mantiene `order_index`.
- Guarda `content_excerpt`.
- Guarda `content_text`.

### Source references

- Crear source reference desde section.
- Listar references por material.
- Listar references por section.
- Reference contiene material, seccion y excerpt.
- No crea reference sin material.

### Busqueda basica

- Buscar secciones por texto.
- Buscar secciones por material.
- Buscar secciones por oposicion.
- No devuelve secciones de otra oposicion.
- No devuelve secciones de otro workspace.

### Reprocesamiento

- Reprocesar material elimina/reemplaza secciones anteriores.
- Reprocesar material crea nuevas secciones.
- Reprocesar falla si material no tiene texto.

### Permisos

- Owner/admin puede ver secciones.
- Student no puede ver secciones internas.
- Student no puede buscar secciones internas.
- Owner/admin no cruza workspace.
- RLS sigue funcionando.

### Regresion

- Document classification sigue funcionando.
- ZIP/PDF upload sigue funcionando.
- No se genera indice en esta spec.
- No se generan preguntas en esta spec.
- No se implementa OCR/RAG/embeddings.
- Supabase y fallback InMemory siguen funcionando.

## 34. Documentacion

Crear o actualizar:

- `docs/architecture/material-sections.md`
- `docs/architecture/source-references.md`
- `docs/qa/material-sections-test-plan.md`

`docs/architecture/material-sections.md` debe explicar:

- Que es una seccion.
- Como se crean secciones.
- Que materiales se procesan.
- Que materiales se excluyen.
- Como se reprocesan.
- Como se relacionan con futuras specs.

`docs/architecture/source-references.md` debe explicar:

- Que es una fuente.
- Que es una referencia.
- Como se usa `page_start`/`page_end`.
- Como se usa `content_excerpt`.
- Como servira para indice y preguntas futuras.

## 35. Criterios de aceptacion

La tarea se considera completada cuando:

- Existen `material_sections`.
- Existen `source_references`.
- Se pueden crear secciones desde materiales utiles.
- No se crean secciones desde documentos no analizables o irrelevantes.
- Las secciones guardan texto, excerpt, orden y referencia al material.
- Se pueden listar secciones por material.
- Se pueden buscar secciones de forma basica.
- Se pueden crear referencias de fuente desde secciones.
- Student no ve secciones internas.
- Owner/admin puede revisarlas.
- Supabase y RLS siguen funcionando.
- Fallback InMemory sigue funcionando.
- No se genera indice todavia.
- No se generan preguntas todavia.
- No se implementa OCR/RAG/embeddings.
- Tests criticos pasan.
- Existe documentacion.

## 36. Instrucciones para Claude

Claude debe implementar esta spec usando el tooling/runbook existente:

- Seguir `docs/setup/migrations-runbook.md`.
- No crear un proceso paralelo de migracion.
- Mantener fallback InMemory.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` fuera del frontend.
- No implementar indice IA, generacion de preguntas, generacion de tests, OCR,
  RAG ni embeddings.
- Reusar la clasificacion documental de SPEC 028-B.
- Mantener Student fuera de secciones/referencias internas.
- Anadir tests de backend/frontend proporcionales al riesgo.
- Documentar arquitectura y plan QA.

