# Plan de pruebas manuales - Document Classification (SPEC 028-B)

Pruebas manuales para validar la clasificación documental y el inventario contra
staging, tras los tests automáticos (`app/backend/tests/documentClassification.test.ts`).
Usa siempre **datos ficticios** de QA. La revisión visual/Playwright la ejecuta
Codex (ver [`codex-visual-review-runbook.md`](./codex-visual-review-runbook.md)).

## Preparación

- Login como admin/owner de un workspace de QA con una oposición ficticia.
- Tener ZIPs/PDFs/TXT ficticios: un temario, un examen con preguntas A/B/C/D, una
  ley, un resumen, un programa/índice y un PDF escaneado (sin texto).

> **Modo de persistencia:** para validar contra Supabase real, arrancar con
> `npm run dev -- --mode staging` (ver el test plan de SPEC 028).

## Casos

| # | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Clasificación básica | Subir un ZIP mixto → "Revisar documentos" | Inventario agrupado: temario, tests, leyes, etc., con confianza y razón |
| 2 | PDF escaneado | Incluir un PDF sin texto | Queda `No analizable` y `needs_review` |
| 3 | Examen | Incluir un PDF/TXT con preguntas A/B/C/D | Clasificado `Test antiguo / examen`, con nº de preguntas detectadas |
| 4 | Ley | Incluir "Ley 39/2015..." | Clasificado `Texto legal` |
| 5 | Dudoso | Incluir un doc sin señales claras | Clasificado `Dudoso`, `needs_review` |
| 6 | Auto vs manual | Subir con la casilla marcada / desmarcada | Marcada: inventario automático; desmarcada: botón "Revisar documentos" |
| 7 | Corrección | Cambiar la clase de un documento en el inventario | Se guarda; aparece "corregido a mano"; prevalece sobre la IA |
| 8 | Permisos student | Login como alumno | No ve inventario, ni clasificaciones, ni razones; no puede corregir |
| 9 | Visibilidad (§17.1) | Tras clasificar, ver material como alumno | No aparecen los `Test antiguo`, ni dudosos/no analizables/irrelevantes |
| 10 | No cruce | Admin de oposición A intenta ver/clasificar lote de B | Acceso denegado |
| 11 | Regresión | Subir ZIP/PDF normal | La subida (SPEC 028) sigue funcionando; no se crea índice ni preguntas |

## Checklist de seguridad (antes de cerrar)

- [ ] El alumno no ve `document_understanding_runs` ni `document_classifications`.
- [ ] El alumno no ve material `old_exam_or_test`/`irrelevant`/`not_analyzable`/`ambiguous`.
- [ ] Sin `VITE_SUPABASE_SERVICE_ROLE_KEY` en frontend.
- [ ] RLS de solo gestión en las nuevas tablas (alumno sin acceso).
- [ ] El clasificador heurístico no hace llamadas externas (default sin IA).
- [ ] No se genera índice ni preguntas en esta spec.

## Verificación de la migración 028-B

- Aplicar `supabase/migrations/028_b_document_classification_inventory.sql`
  siguiendo [`../setup/migrations-runbook.md`](../setup/migrations-runbook.md).
- Comprobar tablas `document_understanding_runs` y `document_classifications`,
  índices y políticas RLS `*_manage`.
- Re-ejecutar la migración: debe ser idempotente (sin error).
