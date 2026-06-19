# Plan de pruebas manuales - Material Sections (SPEC 028-C)

Pruebas manuales para validar las secciones de material y las referencias de
fuente contra staging, tras los tests automáticos
(`app/backend/tests/materialSections.test.ts`). Usa siempre **datos ficticios** de
QA. La revisión visual/Playwright la ejecuta Codex
([`codex-visual-review-runbook.md`](./codex-visual-review-runbook.md)).

## Preparación

- Login como admin/owner con una oposición ficticia.
- Tener documentos ficticios ya subidos y **clasificados** (SPEC 028-B): un
  temario (con "Tema 1/Tema 2"), una ley (con "Artículo N"), un resumen, un
  programa/índice, un examen con preguntas, y un PDF escaneado (no analizable).

> **Modo de persistencia:** para validar contra Supabase real, arrancar con
> `npm run dev -- --mode staging`.

## Casos

| # | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Secciones de temario | Inventario → documento temario → "Ver secciones" | Secciones `heading`/`chunk` con título, tipo y excerpt |
| 2 | Secciones de ley | Documento legal → "Ver secciones" | Secciones por "Artículo N" si se detectan, si no chunks |
| 3 | Secciones de índice | Documento índice → "Ver secciones" | Secciones `toc_block` |
| 4 | Secciones de examen | Documento test antiguo → "Ver secciones" | Bloques `exam_question_block` ("Preguntas 1-10") |
| 5 | No analizable | PDF escaneado → "Ver secciones" no disponible / error | No se crean secciones |
| 6 | Irrelevante/dudoso | Documento irrelevante o dudoso sin corregir | No ofrece secciones; al forzar, error |
| 7 | Dudoso corregido | Corregir un dudoso a "Temario" → "Ver secciones" | Ahora sí crea secciones |
| 8 | Reprocesar | "Reprocesar" en un documento con secciones | Se reemplazan (no se acumulan) |
| 9 | Permisos student | Login como alumno | No ve ni puede crear/buscar secciones internas |
| 10 | No cruce | Buscar/listar secciones de otra oposición | No devuelve secciones ajenas |
| 11 | Regresión | Subir y clasificar como siempre | SPEC 028/028-B siguen; no se crea índice ni preguntas |

## Checklist de seguridad

- [ ] El alumno no ve `material_sections` ni `source_references`.
- [ ] Sin `VITE_SUPABASE_SERVICE_ROLE_KEY` en frontend.
- [ ] RLS de solo gestión en las nuevas tablas (alumno sin acceso).
- [ ] La búsqueda no cruza oposición ni workspace.
- [ ] No se genera índice ni preguntas; sin OCR/RAG/embeddings.

## Verificación de la migración 028-C

- Aplicar `supabase/migrations/028_c_material_sections_source_references.sql`
  siguiendo [`../setup/migrations-runbook.md`](../setup/migrations-runbook.md).
- Comprobar tablas `material_sections` y `source_references`, índices y políticas
  RLS `*_manage`.
- Re-ejecutar: debe ser idempotente (sin error).
