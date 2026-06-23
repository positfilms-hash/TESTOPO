# Edge Functions de Supabase (SPEC 026 / 030 / 033)

TESTOPO usa Edge Functions para operaciones que no pueden ejecutarse en el
navegador: bien porque requieren la `service_role`, bien porque guardan una
**clave de proveedor** que no debe llegar al frontend. Hoy hay tres:

- `supabase/functions/delete-account` (SPEC 026) — eliminación segura de cuenta
  (ver [`../security/account-deletion.md`](../security/account-deletion.md)).
- `supabase/functions/ocr-material` (SPEC 030, **scaffold**) — OCR/visión de una
  página de PDF escaneado. Guarda la clave del proveedor OCR como secreto de
  servidor (ver [`../architecture/ocr-scanned-pdfs.md`](../architecture/ocr-scanned-pdfs.md)).
- `supabase/functions/generate-questions` (SPEC 033, **scaffold**) — generación de
  preguntas anclada a fuentes en servidor. Guarda la clave del proveedor de IA
  (`OPENAI_API_KEY`) como secreto de servidor (ver
  [`../security/ai-provider-secrets.md`](../security/ai-provider-secrets.md) y
  [`../architecture/server-side-question-generation.md`](../architecture/server-side-question-generation.md)).

## Requisitos

- **Supabase CLI** instalada (`scoop install supabase` / `npm i -g supabase` /
  `npx supabase`).
- Proyecto vinculado: `supabase link --project-ref <project-ref>`.

## Variables / secretos

Las funciones desplegadas reciben **inyectadas automáticamente** por Supabase:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

No hace falta declararlas como secreto salvo que quieras sobrescribirlas. **Nunca**
pongas estas claves en el frontend ni con prefijo `VITE_`. La `service_role` solo
vive en el entorno de la función. Ver
[`../security/service-role-usage.md`](../security/service-role-usage.md).

## Desplegar

```bash
# Despliega la función (verify_jwt está activado por defecto: exige Authorization)
supabase functions deploy delete-account
```

> La función igualmente revalida el JWT y obtiene el `user_id` del token (no del
> body), así que es segura aunque se invoque directamente.

## Probar

Localmente:

```bash
supabase functions serve delete-account
# en otra terminal, con un access_token de un usuario de prueba:
curl -i -X POST http://localhost:54321/functions/v1/delete-account \
  -H "Authorization: Bearer <ACCESS_TOKEN_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{"confirmation":"ELIMINAR"}'
```

Respuestas esperadas:

- `200 { "ok": true, "auth_deleted": true }` — cuenta eliminada.
- `200 { "ok": true, "auth_deleted": false, "warning": "ACCOUNT_DELETE_AUTH_DELETE_FAILED" }`
  — perfil `deleted` pero el borrado Auth falló (reintentar/revisar permisos).
- `400 ACCOUNT_DELETE_CONFIRMATION_REQUIRED` — falta/!= `ELIMINAR`.
- `401 ACCOUNT_DELETE_AUTH_REQUIRED` — sin JWT válido.
- `409 ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED` — único owner de organización.
- `500 SERVICE_ROLE_NOT_CONFIGURED` — faltan variables de servidor.

## Desde el frontend

El frontend invoca la función con la sesión del usuario:

```ts
await supabase.functions.invoke('delete-account', {
  body: { confirmation: 'ELIMINAR' },
});
```

(en `app/frontend/src/auth/authService.ts → requestAccountDeletion`).

## Verificar que la service role no se expone

- `app/frontend/tests/supabaseSecurity.test.ts` (CI) escanea `app/frontend/src` y
  falla si aparece `service_role` o una env `SUPABASE_*` sin prefijo `VITE_`.
- La Edge Function vive en `supabase/functions/`, fuera del bundle del frontend.

## `ocr-material` (SPEC 034, server-owned)

OCR de un PDF escaneado **íntegro en el servidor**. El navegador solo manda IDs de
scope + reintento; la función descarga el PDF privado, lo renderiza página a página
(MuPDF WASM) y lo lee con un modelo de visión, guardando la **clave del proveedor**
como secreto de servidor (nunca en el frontend ni con prefijo `VITE_`).

> El contrato anterior browser-image (`{ page_number, image_base64 }` +
> `EdgeFunctionOcrProvider`) quedó **retirado** por SPEC 034.

Contrato HTTP:

```text
POST  { workspace_id, opposition_id, material_id, mode: "auto", force_retry? }
200   { material_id, extraction_status, run_id, page_count, processed_pages,
        failed_pages, average_confidence, warnings }
501   { error: "OCR_PROVIDER_NOT_CONFIGURED", message }   // sin proveedor real
```

### Secreto del proveedor

Además de las variables inyectadas (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), la
función espera la clave del proveedor OCR como secreto:

```bash
supabase secrets set OCR_PROVIDER_API_KEY=<clave-del-proveedor>
```

Sin ella, la función responde `501 OCR_PROVIDER_NOT_CONFIGURED`. El estado actual
es un **scaffold**: autentica el JWT del gestor y deja marcado el punto exacto
(paso 4 de `index.ts`) donde se llama al proveedor real; mientras no se integre
responde `501 OCR_PROVIDER_NOT_IMPLEMENTED`.

### Desplegar y activar en el frontend

```bash
supabase functions deploy ocr-material
```

Para que la app use el proveedor real (en modo Supabase), define la URL de la
función en el frontend:

```text
VITE_OCR_EDGE_FUNCTION_URL=https://<project-ref>.supabase.co/functions/v1/ocr-material
```

Sin esa variable (o en modo memoria/demo) la app usa el **mock** determinista sin
red. La autorización por material la aplica el facade (`startMaterialOcr` /
`retryMaterialOcr`, solo gestión); el alumno nunca accede.

### Respuestas esperadas

- `200 { text, confidence, warnings }` — página reconocida.
- `400 OCR_INVALID_REQUEST` — payload inválido (falta `page_number`/`image_base64`).
- `401 OCR_ACCESS_DENIED` — sin JWT válido.
- `501 OCR_PROVIDER_NOT_CONFIGURED` — falta `OCR_PROVIDER_API_KEY`.
- `501 OCR_PROVIDER_NOT_IMPLEMENTED` — scaffold sin proveedor real integrado.
