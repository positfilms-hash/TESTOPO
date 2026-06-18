# Plan de pruebas manuales - Smart Bulk Upload (SPEC 028)

Pruebas manuales para validar la carga masiva contra staging (Supabase real) tras
los tests automáticos (`app/backend/tests/smartUpload.test.ts` +
`app/frontend/tests/smoke.test.tsx`). Usa siempre **datos ficticios** de QA.

> La revisión visual/Playwright la ejecuta Codex (ver
> [`codex-visual-review-runbook.md`](./codex-visual-review-runbook.md)). Este plan
> es el guion funcional de referencia.

## Preparación

- Iniciar sesión como admin/owner de un workspace de QA con una oposición ficticia.
- Tener a mano ZIPs/PDFs ficticios (sin datos reales): material de oposición, tests
  antiguos, y un ZIP combinado.

> **Importante (modo de persistencia):** los tests unitarios corren en modo
> `memory`. Para validar contra **Supabase real** arrancar el dev server con el
> modo staging explícito: `npm run dev -- --mode staging` (Vite solo carga
> `.env.staging.local` con ese `--mode`; el arranque normal usa el modo demo en
> memoria). Si la app cae a `memory` sin avisar, las pruebas de RLS/Supabase no
> son representativas.

## Casos

| # | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | ZIP solo material | Material → Subir material → *Material de la oposición* → Subir ZIP con carpetas Tema 1/Tema 2 | Resumen con N importados; materiales `syllabus`; sin temas creados aún |
| 2 | ZIP solo tests antiguos | Categoría *Tests antiguos* → Subir ZIP de exámenes | Materiales `old_test`; mensaje de análisis de estilo/cobertura; sin preguntas |
| 3 | ZIP combinado | Categoría combinada → ZIP con `Material de la oposicion/` y `Tests antiguos/` | Cada archivo con `detected_category` correcta por carpeta |
| 4 | Carpeta (si soportado) | Subir carpeta vía botón *Subir carpeta* | Se desglosa igual que el ZIP; si no hay soporte, aparece la recomendación de ZIP |
| 5 | PDFs sueltos | Subir 3-4 PDFs | Un material por PDF; resumen correcto |
| 6 | ZIP con archivos inválidos | ZIP con un `.exe` y un PDF | `.exe` omitido (skipped); PDF importado; resumen muestra omitidos |
| 7 | PDF escaneado | Subir PDF sin texto seleccionable | `extraction_status = not_supported`; material `needs_review` |
| 8 | Rutas inseguras | ZIP con `../` o ruta absoluta | Rechazado con error (no se importa nada) |
| 9 | ZIP anidado | ZIP que contiene otro `.zip` | Rechazado |
| 10 | Lote demasiado grande | > 500 archivos | Rechazado con error de límite |
| 11 | Índice IA | Tras caso 1, pulsar *Crear índice con IA* | Propuesta `pending_review`; carpetas → temas, subcarpetas → subtemas; NO aplicada |
| 12 | Aplicar índice | En Temario, revisar y aplicar la propuesta aprobada | Se crean temas y se asocian materiales; sin aplicar si no está aprobada |
| 13 | Análisis tests antiguos | Tras caso 2 (o con el checkbox marcado, automático) lanzar análisis | Resumen de patrones (estilo/dificultad/cobertura); sin preguntas validadas |
| 14 | Permisos student | Login como alumno con acceso, tras subir material + tests antiguos | No ve *Subir material*; no ve lotes ni errores internos; ve material de estudio `active` pero **NO** los `old_test`/`official_exam` (fuente interna) |
| 15 | No generación directa | Confirmar | Ningún PDF produce preguntas `validated` ni tests de estudiante automáticamente |

## Checklist de seguridad (antes de cerrar)

- [ ] No hay service role en frontend ni `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Los archivos subidos no se guardan en el repo.
- [ ] No se exponen rutas internas (`storage_path`) al alumno.
- [ ] ZIP traversal / ZIP anidado / extensiones peligrosas bloqueados.
- [ ] El alumno no puede subir ni ver lotes/errores internos.
- [ ] RLS (022/025) intacta tras aplicar `028_smart_upload_categories.sql`.

## Verificación de la migración 026

- Aplicar `supabase/migrations/028_smart_upload_categories.sql` siguiendo
  [`../setup/migrations-runbook.md`](../setup/migrations-runbook.md).
- Comprobar columnas nuevas en `material_import_batches`
  (`upload_category`, `analyzed_files`, `warnings`) y `material_import_items`
  (`upload_category`, `detected_category`, `ai_classification_confidence`).
- Re-ejecutar la migración: debe ser idempotente (sin error).
