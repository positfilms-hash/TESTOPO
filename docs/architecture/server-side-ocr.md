# OCR de PDFs escaneados en servidor (SPEC 034)

El OCR de PDFs **escaneados** (SPEC 030) deja de depender del navegador cuando la
app corre en modo Supabase: pasa a una **Edge Function autenticada**
(`supabase/functions/ocr-material`). El navegador solo pide el OCR con IDs de
scope y una opción de reintento; nunca renderiza páginas, ni aporta imágenes/texto
OCR, ni llama al proveedor, ni guarda claves privadas o `service_role`.

Esto retira el contrato anterior de SPEC 030 (el navegador rendereaba cada página
a imagen y la enviaba a la función con `{ page_number, image_base64 }`). Bajo SPEC
034 todo el render + lectura ocurre **server-side**, y sin proveedor real el OCR se
bloquea de forma **honesta** sin escribir estado simulado.

## Dónde corre cada cosa

| Modo | Render + proveedor + persistencia | Notas |
| --- | --- | --- |
| **Supabase** (`VITE_APP_PERSISTENCE_MODE=supabase` configurado) | Edge Function `ocr-material` (servidor) | El front llama `supabase.functions.invoke('ocr-material', { body })`. La clave del proveedor es secreto de servidor; el PDF se descarga y renderiza en el servidor. |
| **Memoria / demo** (sin Supabase) | `MaterialOcrService` en proceso con proveedor mock | Igual que SPEC 030. El mock está **bloqueado** como lectura real cuando hay `supabasePort` (`allowMockProvider: false`); en demo InMemory se permite y la UI avisa de que el texto es SIMULADO. |

La lógica **canónica** (forma del body, validación, elegibilidad/reintento, bandas
de confianza, agregación de texto usable, mapeo de estados terminales) vive en un
único módulo puro compartido:

```
supabase/functions/_shared/ocr-material/contract.ts
```

Lo consumen **a la vez** la Edge Function (Deno) y los tests de vitest del backend
(`app/backend/tests/serverOcrMaterialContract.test.ts`), de modo que no hay
duplicación de reglas. El frontend (`app/frontend/src/ocr/serverOcrMaterial.ts`)
reutiliza el mismo contrato para construir/validar el body y mapear códigos de
error a mensajes seguros.

## Contrato HTTP

`POST` autenticado (con `verify_jwt`; la función revalida con `auth.getUser()`).

Request (whitelist estricta; cualquier otro campo se rechaza):

```json
{
  "workspace_id": "uuid",
  "opposition_id": "uuid",
  "material_id": "uuid",
  "mode": "auto",
  "force_retry": false
}
```

- `mode`: solo `"auto"` en el MVP (escaneo completo). `force_retry` es opcional.
- Se rechaza con `OCR_ARBITRARY_INPUT_FORBIDDEN` cualquier body con `user_id`,
  `image_base64`, `image_url`, `ocr_text`, `fake_text`, `raw_text`,
  `provider_prompt`, `api_key` o campos desconocidos.

Response (resumen seguro):
`{ "material_id": string, "extraction_status": string, "run_id": string|null, "page_count": number, "processed_pages": number, "failed_pages": number, "average_confidence": number|null, "warnings": string[] }`.
Nunca se devuelven texto OCR completo, URLs firmadas, rutas internas, errores
crudos del proveedor ni secretos.

## Flujo de la Edge Function

1. **Auth**: deriva el actor SOLO del JWT verificado (`auth.getUser()`); nunca del
   body. Las lecturas de scope van con el cliente del usuario (RLS).
2. **Body**: `validateOcrRequest` (whitelist + rechazo de imagen/texto OCR/clave).
3. **Scope + elegibilidad**: la oposición pertenece al `workspace_id` declarado; el
   material pertenece a esa oposición y workspace exactos; es un PDF **no obsoleto**
   en estado OCR-elegible; un reintento solo procede desde `scanned_detected`,
   `ocr_failed` o `completed_ocr_with_warnings`; se respeta el límite de páginas. La
   autorización autoritativa de escritura la garantiza además la RLS de
   `material_ocr_runs`/`material_ocr_pages` (`*_manage` → `can_manage_workspace`).
3b. **Guarda explícita de gestión (no solo RLS)**: además de la RLS, la función
   consulta `profiles` (no eliminado/bloqueado) y `workspace_members` (membership
   `active` con rol `owner`/`admin`) y evalúa `evaluateManagementAccess`
   (`_shared/authz/management.ts`). Student/eliminado/revocado fallan **antes** de
   Storage, del proveedor o de cualquier escritura.
4. **Proveedor**: `resolveOcrProvider` lee `OCR_PROVIDER` / `OPENAI_API_KEY` /
   `OCR_MODEL` de los **secretos de la Edge Function**. **Solo OpenAI** (visión)
   está soportado; Anthropic no se declara aquí. Sin proveedor real → **HTTP 501**
   `OCR_PROVIDER_NOT_CONFIGURED`, se **preserva** el estado detectado y **cero
   escrituras**.
5. **Flujo real (implementado)**: crea run (`processing`) y mueve el material a
   `ocr_processing` → descarga el PDF privado por `storage_path` (Storage, RLS de
   bucket owner/admin) → render server-side página a página con **MuPDF WASM**
   (`ocr-material/pdfRender.ts`; *fail closed* con `OCR_RENDER_FAILED`/
   `OCR_PAGE_RENDER_FAILED`, nunca render en navegador ni texto inventado) → por
   página real: `buildOcrVisionRequest` → `fetch` a OpenAI (visión, timeout 60s) →
   `parseOcrVisionResponse` → `ocrConfidenceBand` + un `material_ocr_pages` →
   `aggregateUsableText` + `averageOcrConfidence` + `mapOcrTerminalOutcome` →
   `content_text` solo si hay texto usable → resumen seguro. Un reintento borra
   runs/páginas previos y crea un run **nuevo aislado**.

> **Estado de verificación (honesto).** La lógica determinista (validación de body,
> autorización explícita, elegibilidad/reintento, bandas de confianza, agregación y
> estados terminales, construcción de la petición de visión y parseo) vive en
> `_shared/*` y está **cubierta por vitest** (`serverOcrMaterialContract.test.ts`).
> El `index.ts` y `pdfRender.ts` corren en **Deno** y **no** los ejecuta ningún test
> de este repo. **Riesgo principal de staging:** el render server-side de PDF con
> MuPDF WASM dentro del runtime de Edge Functions (memoria/tiempo) **no está
> verificado aquí**; si no inicializa, la función falla cerrada (`OCR_RENDER_FAILED`)
> sin inventar texto. La descarga de Storage, la llamada de visión y la persistencia
> **solo** se verifican en **staging con secretos reales**.

## Límites (acotados, documentados)

`MAX_OCR_PAGES = 300`, `MAX_OCR_CONCURRENT_PAGES = 3`,
`OCR_PER_PAGE_TIMEOUT_MS = 60000`, `MAX_OCR_IMAGE_BYTES = 10 MB` por página
temporal. Las imágenes temporales son privadas y se borran tras procesar.

## Persistencia y estados honestos

Reutiliza las entidades de SPEC 030/032 (sin migración nueva):

- `material_ocr_runs`: un run nuevo por (re)ejecución; un reintento **no** reutiliza
  ni mezcla páginas de runs previos. `status` ∈
  `pending`/`processing`/`completed`/`completed_with_warnings`/`failed`.
- `material_ocr_pages`: exactamente un registro por página realmente procesada, con
  texto/confianza/estado/advertencias/errores reales. Las páginas saltadas/fallidas
  **no** se representan como completadas.
- `materials.content_text`: solo se concatena texto USABLE en orden de página
  (`extraction_method = ocr`). Un fallo total **no** sobreescribe buen texto nativo.

Bandas de confianza (SPEC 030): `>= 0.70` usable; `0.40–0.69` usable con
advertencia; `< 0.40` fallida/revisable. Estado terminal del material:
`completed_ocr` (limpio) · `completed_ocr_with_warnings` + `needs_review` (parcial)
· `ocr_failed` + `needs_review` (sin texto). Logs: solo IDs/contadores/estado/
códigos.

## Aislamiento del alumno

Alumnos, usuarios borrados/revocados y sin acceso no pueden invocar la función
(RLS + checks de scope), ni reintentar OCR, ni inspeccionar runs/páginas/
confianza/errores, ni ver referencias internas de imagen/almacenamiento. La UI de
OCR (badges, detalle, `Reintentar OCR`) es solo para gestores. Nada de
clasificación, índice, generación de preguntas, Auth, RLS amplia, embeddings, RAG
ni fine-tuning se modifica aquí.

## Despliegue

Ver [`../security/ocr-provider-secrets.md`](../security/ocr-provider-secrets.md)
para el secret boundary y los comandos exactos de despliegue/secretos. Una
afirmación de "OCR real funciona" exige secretos desplegados y un retest de staging
aparte; no se infiere de los tests mock/unit.
