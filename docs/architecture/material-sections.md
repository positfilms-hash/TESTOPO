# Secciones de material (SPEC 028-C)

Tras clasificar los documentos (SPEC 028-B), TESTOPO **entra en cada material útil
y lo divide en secciones/fragmentos referenciables** (`material_sections`). Estas
secciones son la base para que specs futuras (índice de temario, generación de
preguntas) puedan citar una **fuente concreta**. No genera índice ni preguntas;
sin OCR/RAG/embeddings.

## Qué es una sección

Una `MaterialSection` representa una parte útil de un material: un epígrafe, un
fragmento (chunk) o un bloque de preguntas. Campos clave: `section_title`,
`section_type`, `content_text`, `content_excerpt`, `order_index`, `classification`
(de sección), `source_path`, `status`, y el `material_id` de origen.

- **`section_type`**: `page` · `heading` · `chunk` · `exam_question_block` ·
  `toc_block` · `unknown`.
- **`classification`** (de sección, heredada de la documental): `study_content` ·
  `legal_content` · `summary_content` · `index_content` · `old_exam_content` ·
  `unknown`.

## Qué materiales se procesan

Solo materiales con `extraction_status = completed`, `content_text` disponible y
**clasificación útil** (SPEC 028-B): `syllabus_material`, `legal_text`,
`notes_or_summary`, `index_or_table_of_contents`, `old_exam_or_test`.

**No** se procesan `not_analyzable`, `irrelevant` ni `ambiguous` — salvo que un
`ambiguous` se haya **corregido a mano** a una clase útil (la clasificación
vigente manda; la corrección humana lo deja elegible).

## Cómo se crean (bajo demanda)

Desde el inventario documental, cada documento útil ofrece **"Ver secciones"** y
**"Reprocesar"**. El facade `PlatformService.createMaterialSections(materialId)`:
1. valida material + texto + clasificación útil,
2. segmenta el texto (`segmentText`),
3. **borra y reemplaza** las secciones anteriores del material (reprocesado),
4. crea las nuevas y, de paso, una `SourceReference` `material_section` por sección.

## Estrategia de segmentación (`sections/segmentText.ts`)

Determinista, simple y robusta (sin OCR/embeddings). Orden de preferencia:

1. **Tests antiguos** → bloques de preguntas numeradas (`exam_question_block`,
   "Preguntas 1-10").
2. **Resto** → epígrafes inline (`TEMA N` / `Artículo N` / `Capítulo` / `Título`)
   si hay ≥ 2 → secciones `heading` (o `toc_block` para índices).
3. **Fallback** → chunks de 1.500–3.000 chars con solape (`chunk`/`toc_block`).

> **Limitación de páginas**: el extractor PDF (`NaivePdfTextExtractor`) devuelve el
> texto **concatenado** (colapsa saltos de línea) + `page_count`, pero **no** texto
> por página. Por eso **no hay segmentación real por página** y `page_start`/
> `page_end` quedan `null`. La spec lo permite (las páginas son condicionales). Un
> extractor que conserve páginas en el futuro habilitaría secciones `page`.

## Reprocesamiento

Reprocesar (corregir clasificación, mejorar extracción, re-subir, cambiar
estrategia) **reemplaza** las secciones previas del material por las nuevas.

## Búsqueda básica

`searchMaterialSections({ opposition_id, query, classification?, material_ids?,
limit? })`: coincidencia de palabras sobre título/texto/clasificación, **scope por
oposición** (no cruza oposición ni workspace). Sin ranking semántico (no RAG).

## Permisos y visibilidad

Crean/ven/buscan secciones: `owner`, `admin`, manager autorizado, premium owner en
workspace personal. **No**: `student`, sin acceso, eliminado. Guard
`requireManageOpposition` en el facade; RLS de solo gestión (`can_manage_workspace`)
en `material_sections` como defensa adicional. El alumno **nunca** ve la estructura
interna de ingestión.

## Relación con specs futuras

Las secciones y sus [referencias de fuente](./source-references.md) preparan el
terreno para **028-D (índice IA desde documentos clasificados)** y **028-E
(generación de preguntas con fuente concreta)**. Esta spec no implementa esos
flujos.

## Mapa de código

| Capa | Archivo |
| --- | --- |
| Modelo | `app/backend/src/models/materialSection.ts` |
| Segmentación | `app/backend/src/sections/segmentText.ts` (+ `segmentConfig.ts`, `sectionErrors.ts`) |
| Servicio | `app/backend/src/service/materialSectionService.ts` |
| Repos | `app/backend/src/repository/{inMemory,supabase}Sections*` |
| Facade | `app/backend/src/service/platformService.ts` (`createMaterialSections`, `listMaterialSections`, `reprocessMaterialSections`, `searchMaterialSections`) |
| Migración | `supabase/migrations/028_c_material_sections_source_references.sql` |
| UI | `app/frontend/src/pages/DocumentInventory.tsx` |
| Tests | `app/backend/tests/materialSections.test.ts` |
