# Prompt para Claude - SPEC 028-C

Implementa la SPEC 028-C - Material Sections & Source References.

Lee primero:

- `docs/specs/028-c-material-sections-source-references.md`
- `docs/specs/028-b-document-classification-inventory.md`
- `docs/setup/migrations-runbook.md`
- `docs/architecture/document-classification.md`
- `docs/architecture/material-ingestion.md`
- `docs/security/rls-policies.md`
- `docs/security/service-role-usage.md`

Objetivo:

La SPEC 028-B clasifica documentos importados. Ahora TESTOPO debe entrar en
materiales utiles y dividirlos en secciones o fragmentos referenciables para que
specs futuras puedan generar indice y preguntas con fuentes concretas.

Implementa solo:

- `material_sections`.
- `source_references`.
- Migracion Supabase:
  `supabase/migrations/028_c_material_sections_source_references.sql`.
- Repositorios Supabase e InMemory.
- Integracion con el factory de repositorios.
- `MaterialSectionService`.
- `SourceReferenceService`.
- Segmentacion basica por pagina, epigrafe simple o chunk.
- Busqueda basica por texto.
- Vista minima de secciones en detalle de documento/inventario.
- Permisos, guards y RLS.
- Tests criticos.
- Documentacion:
  - `docs/architecture/material-sections.md`
  - `docs/architecture/source-references.md`
  - `docs/qa/material-sections-test-plan.md`

Reglas obligatorias:

1. No generes indice de temario en esta spec.
2. No generes preguntas en esta spec.
3. No generes tests en esta spec.
4. No implementes OCR.
5. No implementes RAG avanzado.
6. No implementes embeddings.
7. No implementes base vectorial.
8. No proceses documentos `not_analyzable`.
9. No proceses documentos `irrelevant`.
10. No proceses documentos `ambiguous` salvo correccion humana a categoria util.
11. Student no puede ver secciones internas.
12. Student no puede ver referencias internas.
13. Student no puede buscar secciones internas.
14. Owner/admin si puede revisar secciones.
15. Mantener Supabase, RLS y fallback InMemory.
16. No exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend.

Clasificaciones utiles de entrada:

- `syllabus_material`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`
- `old_exam_or_test`

Clasificaciones excluidas:

- `not_analyzable`
- `irrelevant`
- `ambiguous` sin correccion humana

Secciones recomendadas:

- `page`
- `heading`
- `chunk`
- `exam_question_block`
- `toc_block`
- `unknown`

Clasificacion interna de seccion:

- `study_content`
- `legal_content`
- `summary_content`
- `index_content`
- `old_exam_content`
- `unknown`

Tests minimos:

- Crea secciones para `syllabus_material`, `legal_text`,
  `notes_or_summary`, `index_or_table_of_contents` y `old_exam_or_test`.
- No crea secciones para `not_analyzable`, `irrelevant` ni `ambiguous` no
  corregido.
- Crea secciones para `ambiguous` corregido manualmente a categoria util.
- Si hay paginas, crea secciones por pagina.
- Si hay epigrafes, usa titulos de seccion.
- Si no hay estructura, crea chunks.
- Guarda `order_index`, `content_excerpt` y `content_text`.
- Crea `SourceReference` desde una seccion.
- Lista referencias por material y por seccion.
- Busca secciones por texto/material/oposicion.
- No devuelve secciones de otra oposicion/workspace.
- Reprocesar elimina/reemplaza secciones anteriores.
- Student no ve ni busca secciones internas.
- Document classification sigue funcionando.
- ZIP/PDF upload sigue funcionando.
- No se crea indice.
- No se crean preguntas.
- No hay OCR/RAG/embeddings.

Objetivo final:

Preparar los PDFs y materiales para que, en specs posteriores, el indice y las
preguntas puedan apoyarse en paginas, secciones y fragmentos concretos.

