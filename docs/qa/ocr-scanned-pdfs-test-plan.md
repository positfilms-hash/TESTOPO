# Plan de pruebas manuales - OCR de PDFs escaneados (SPEC 030)

Pruebas manuales para validar el camino OCR contra staging, tras los tests
automáticos (`app/backend/tests/materialOcr.test.ts`,
`materialOcrPlatform.test.ts`, `edgeFunctionOcrProvider.test.ts` y
`app/frontend/tests/labels.test.ts`). Usa siempre **datos ficticios** de QA. La
revisión visual/Playwright la ejecuta Codex
([`codex-visual-review-runbook.md`](./codex-visual-review-runbook.md)).

> Arquitectura y contratos: [`../architecture/ocr-scanned-pdfs.md`](../architecture/ocr-scanned-pdfs.md).
> Edge Function y despliegue: [`../setup/supabase-edge-functions.md`](../setup/supabase-edge-functions.md).

## Preparación

- Login como admin/owner con una oposición ficticia.
- Tener a mano PDFs ficticios: (a) un PDF con **texto nativo** legible, (b) un PDF
  **escaneado** (sin capa de texto), (c) un PDF **dañado**.
- **Demo/memoria**: el OCR usa el proveedor **mock** determinista (sin red); sirve
  para validar todos los estados de UI. Para el proveedor real, ver la sección de
  Edge Function al final.

> **Modo de persistencia:** para validar contra Supabase real, arrancar con
> `npm run dev -- --mode staging`.

## Casos funcionales

| # | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Texto nativo no usa OCR | Subir PDF con texto (a) | Badge **Texto extraído**; **no** aparece botón OCR |
| 2 | Detección de escaneo | Subir PDF escaneado (b) | Badge **Escaneo detectado** + botón **«Leer escaneo (OCR)»** |
| 3 | OCR correcto | Pulsar «Leer escaneo (OCR)» (mock confianza alta) | Badge **Leído con OCR**; detalle con páginas leídas y confianza; aviso de éxito |
| 4 | OCR con advertencias | Escaneo con páginas de confianza media | Badge **OCR con advertencias**; material queda **Por revisar**; nº de advertencias en el detalle |
| 5 | OCR fallido | Escaneo con confianza baja en todas las páginas | Badge **No se pudo leer**; texto de error; **no** se borra texto previo |
| 6 | Reintentar | En estado advertencias/fallo, pulsar **«Reintentar OCR»** | Se limpia el run anterior y se reejecuta; nuevo estado coherente |
| 7 | Abrir original | Pulsar **Abrir** en un escaneo | Abre por URL firmada/object URL; **nunca** muestra `storage_path` |
| 8 | PDF dañado | Subir PDF dañado (c) | No se ofrece OCR (no es escaneo recuperable) |
| 9 | Orden de páginas | Tras OCR correcto, abrir/inspeccionar `content_text` | Texto agregado en **orden ascendente** de página |
| 10 | Permisos student | Login como alumno | No ve badge OCR, ni botón, ni detalle; la API de OCR le deniega (AccessError) |
| 11 | No cruce | OCR sobre material de otra oposición | Denegado (gestión por oposición) |
| 12 | Regresión | Subir/clasificar como siempre | SPEC 028/028-B/028-C siguen; OCR no clasifica ni genera preguntas |

## Checklist de seguridad

- [ ] El alumno no ve `material_ocr_runs`/`material_ocr_pages` ni controles OCR.
- [ ] RLS de **solo gestión** en las nuevas tablas (alumno sin SELECT/INSERT/UPDATE/DELETE).
- [ ] Sin `service_role` ni clave de proveedor OCR en el frontend (`VITE_*`).
- [ ] La respuesta de la Edge Function no incluye `storage_path`, claves ni URLs internas de imagen.
- [ ] Un OCR fallido **no** sobreescribe buen texto nativo.
- [ ] No se genera índice ni preguntas; sin RAG/embeddings/fine-tuning.

## Verificación de la migración 032

- Aplicar `supabase/migrations/032_ocr_vision_scanned_pdfs.sql` (idempotente).
- Comprobar columnas OCR en `materials`, el CHECK ampliado de `extraction_status`,
  las tablas `material_ocr_runs`/`material_ocr_pages` con RLS activa y los
  triggers `updated_at` (ver §5 del runbook de migraciones).

## Proveedor real (Edge Function)

1. `supabase functions deploy ocr-material` y
   `supabase secrets set OCR_PROVIDER_API_KEY=<clave>`.
2. Definir `VITE_OCR_EDGE_FUNCTION_URL` en el frontend (modo Supabase).
3. Sin la URL, la app usa el mock. Sin la clave, la función responde
   `501 OCR_PROVIDER_NOT_CONFIGURED`. Scaffold sin integrar →
   `501 OCR_PROVIDER_NOT_IMPLEMENTED`.
4. Verificar que el navegador **nunca** recibe la clave del proveedor (solo envía
   imagen + su Bearer de sesión).
