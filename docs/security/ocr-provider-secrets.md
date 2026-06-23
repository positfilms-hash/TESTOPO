# Secretos del proveedor de OCR (SPEC 034)

La clave del proveedor de OCR/visión y la `service_role` son **secretos de
servidor**. Nunca deben aparecer en el frontend, en variables `VITE_*`, en
fixtures, logs, capturas ni en `.env` commiteados. Este documento fija el *secret
boundary* del OCR de PDFs escaneados en servidor (Edge Function `ocr-material`,
SPEC 034).

## Qué es público y qué es secreto

| Variable | Dónde vive | ¿Frontend? |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | bundle del front | **Sí** (públicas) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Function (inyectadas por Supabase) | **No** |
| `OCR_PROVIDER`, `OCR_MODEL`, `OPENAI_API_KEY` | secreto de Edge Function | **No** |

- El frontend solo usa la clave **anónima**. El OCR real lo hace la Edge Function
  autenticada; el navegador la invoca con
  `supabase.functions.invoke('ocr-material', { body })` enviando **solo IDs de
  scope** (`workspace_id`, `opposition_id`, `material_id`), `mode: "auto"` y
  `force_retry`. **Nunca** envía imágenes, texto OCR, prompts ni claves.
- El render del PDF y la lectura página a página ocurren **en el servidor**. El
  navegador ya no renderiza páginas ni sube imágenes (contrato anterior de SPEC
  030, ya retirado).

## Comportamiento sin proveedor (honesto)

Si la Edge Function no encuentra un proveedor real configurado
(`OCR_PROVIDER` ∈ {openai, anthropic} y `OPENAI_API_KEY` presente), responde:

```
HTTP 501
{ "error": "OCR_PROVIDER_NOT_CONFIGURED",
  "message": "OCR no disponible todavía: proveedor OCR no configurado en servidor." }
```

y **no persiste nada** (ni run, ni página, ni `content_text`, ni mock) en
Supabase, staging ni producción. El material **conserva** su estado detectado
(normalmente `scanned_detected`). Un proveedor mock solo es admisible en tests
aislados o en desarrollo InMemory explícito; su configuración es imposible en modo
Supabase.

## Configurar los secretos (despliegue)

Requiere la Supabase CLI y el proyecto vinculado (ver
[`../setup/supabase-edge-functions.md`](../setup/supabase-edge-functions.md)).

```bash
# 1) Secretos del proveedor (NUNCA con prefijo VITE_, nunca en el repo)
supabase secrets set OCR_PROVIDER=openai
supabase secrets set OPENAI_API_KEY=sk-...            # clave real, solo servidor
supabase secrets set OCR_MODEL=gpt-4o-mini            # debe soportar visión

# 2) Desplegar la función (verify_jwt activado: exige Authorization)
supabase functions deploy ocr-material
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta
Supabase automáticamente; no hace falta declararlas salvo para sobreescribir.

## Verificación de no-filtración

- `grep` de `OPENAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` en `app/frontend` y en
  cualquier `VITE_*` debe dar **cero** resultados de valor real.
- El test `app/frontend/tests/serverOcrMaterial.test.ts` comprueba que el body
  enviado a la función contiene **solo** IDs/opciones (sin `image_base64`,
  `image_url`, `ocr_text`, `raw_text`, `provider_prompt`, `api_key`, `user_id`).
- La función no devuelve texto OCR completo, URLs firmadas, rutas internas,
  errores crudos del proveedor ni secretos: solo códigos de error estables y un
  resumen seguro.

## Relación con otros documentos

- Uso de `service_role`: [`service-role-usage.md`](./service-role-usage.md).
- Arquitectura del flujo: [`../architecture/server-side-ocr.md`](../architecture/server-side-ocr.md).
- Plan de pruebas: [`../qa/server-side-ocr-test-plan.md`](../qa/server-side-ocr-test-plan.md).
