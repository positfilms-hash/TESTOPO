# Prompt para Claude - SPEC 028-B

Implementa la SPEC 028-B - Document Classification & Import Inventory.

Lee primero:

- `docs/specs/028-b-document-classification-inventory.md`
- `docs/setup/migrations-runbook.md`
- `docs/architecture/material-ingestion.md`
- `docs/security/rls-policies.md`
- `docs/security/service-role-usage.md`

Objetivo:

La app ya permite subir ZIPs, carpetas y PDFs. Ahora debe entender que es cada
archivo importado y mostrar un inventario revisable por admin/owner.

Implementa solo:

- `DocumentUnderstandingRun`.
- `DocumentClassification`.
- Migracion Supabase:
  `supabase/migrations/028_b_document_classification_inventory.sql`.
- Prompt de clasificador:
  `prompts/document-classifier.md`.
- Servicio de clasificacion documental.
- Clasificacion IA con OpenAI si esta configurado.
- Clasificacion heuristica si no hay IA configurada.
- Mock provider para tests.
- Inventario documental agrupado por clasificacion.
- Correccion humana de clasificacion.
- Permisos, guards y RLS.
- Tests criticos.
- Documentacion:
  - `docs/architecture/document-classification.md`
  - `docs/user-guides/upload-material.md`
  - `docs/qa/document-classification-test-plan.md`

Clasificaciones:

- `syllabus_material`
- `old_exam_or_test`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`
- `irrelevant`
- `not_analyzable`
- `ambiguous`

Reglas obligatorias:

1. No generes indice de temario en esta spec.
2. No generes preguntas en esta spec.
3. No generes tests en esta spec.
4. No implementes OCR.
5. No implementes RAG.
6. No implementes embeddings.
7. Student no puede ver inventario interno.
8. Student no puede ver clasificaciones internas.
9. Student no puede corregir clasificaciones.
10. Student no debe ver documentos internos `old_exam_or_test`, `irrelevant`,
    `not_analyzable` ni `ambiguous`.
11. La correccion humana prevalece sobre la IA.
12. Los documentos dudosos quedan `needs_review`.
13. Los PDFs sin texto quedan `not_analyzable`.
14. Mantener Supabase, RLS y fallback InMemory.
15. No exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend.

Notas de revision Codex:

- SPEC 028 dejo dos riesgos que esta spec debe cerrar:
  - `old_test`/`official_exam` activos podian quedar visibles a Student si la
    lista de materiales solo filtraba por `status = active`.
  - El flujo de `Tests antiguos` no debe lanzar indice; aqui solo debe crear
    inventario/clasificacion revisable.
- Cualquier analisis posterior de indice queda para una futura SPEC 028-C.
- Cualquier generacion de preguntas queda fuera.

Tests minimos:

- PDF con preguntas -> `old_exam_or_test`.
- PDF teorico -> `syllabus_material`.
- PDF legal -> `legal_text`.
- Apuntes/resumen -> `notes_or_summary`.
- Indice/programa -> `index_or_table_of_contents`.
- PDF sin texto -> `not_analyzable`.
- Documento dudoso -> `ambiguous`.
- Baja confianza -> `needs_review`.
- Se crea run.
- Se crea classification por material.
- Inventario agrupa por clasificacion.
- Admin corrige clasificacion.
- Correccion humana marca `manually_corrected`.
- Correccion humana prevalece.
- Student no ve inventario ni clasificaciones.
- Owner/admin no cruza workspaces/oposiciones.
- ZIP/PDF upload sigue funcionando.
- No se crea indice.
- No se crean preguntas.
- No hay llamadas externas en tests.

