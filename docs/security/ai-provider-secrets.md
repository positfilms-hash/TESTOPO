# Secretos del proveedor de IA (SPEC 033)

La clave del proveedor de IA y la `service_role` son **secretos de servidor**.
Nunca deben aparecer en el frontend, en variables `VITE_*`, en fixtures, logs,
capturas ni en `.env` commiteados. Este documento fija el *secret boundary* de la
generación de preguntas en servidor (Edge Function `generate-questions`, SPEC 033).

## Qué es público y qué es secreto

| Variable | Dónde vive | ¿Frontend? |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | bundle del front | **Sí** (públicas) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Function (inyectadas por Supabase) | **No** |
| `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` | secreto de Edge Function | **No** |

- El frontend solo usa la clave **anónima**. La generación real la hace la Edge
  Function autenticada; el navegador la invoca con
  `supabase.functions.invoke('generate-questions', { body })` enviando **solo IDs y
  parámetros**.
- `.env.example` documenta `OPENAI_API_KEY=...server-only` y
  `SUPABASE_SERVICE_ROLE_KEY=...server-only` **sin** prefijo `VITE_`, con valores
  de ejemplo. El repo no contiene claves reales.

## Comportamiento sin proveedor (honesto)

Si la Edge Function no encuentra un proveedor real configurado
(`AI_PROVIDER` ∈ {openai, anthropic} y `OPENAI_API_KEY` presente), responde:

```
HTTP 501
{ "error": "QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED",
  "message": "La generación de preguntas todavía no está configurada en servidor." }
```

y **no persiste nada** (ni run, ni pregunta, ni texto, ni mock) en Supabase,
staging ni producción. Un proveedor mock solo es admisible en tests aislados o en
desarrollo InMemory explícito; su configuración es imposible en modo Supabase.

## Configurar los secretos (despliegue)

Requiere la Supabase CLI y el proyecto vinculado (ver
[`../setup/supabase-edge-functions.md`](../setup/supabase-edge-functions.md)).

```bash
# 1) Secretos del proveedor (NUNCA con prefijo VITE_, nunca en el repo)
supabase secrets set AI_PROVIDER=openai
supabase secrets set OPENAI_API_KEY=sk-...            # clave real, solo servidor
supabase secrets set OPENAI_MODEL=gpt-4o-mini

# 2) Desplegar la función (verify_jwt activado: exige Authorization)
supabase functions deploy generate-questions
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta
Supabase automáticamente; no hace falta declararlas salvo para sobreescribir.

## Verificación de no-filtración

- `grep` de `OPENAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` en `app/frontend` y en
  cualquier `VITE_*` debe dar **cero** resultados de valor real.
- El test `app/frontend/tests/serverQuestionGeneration.test.ts` comprueba que el
  body enviado a la función contiene **solo** IDs/parámetros (sin `source_text`,
  `raw_text`, `custom_prompt`, `user_id`, etc.).
- La función no devuelve prompts, excerpts completos, errores del proveedor ni
  secretos: solo códigos de error estables y un resumen seguro.

## Relación con otros documentos

- Uso de `service_role`: [`service-role-usage.md`](./service-role-usage.md).
- Arquitectura del flujo: [`../architecture/server-side-question-generation.md`](../architecture/server-side-question-generation.md).
- Plan de pruebas: [`../qa/server-side-question-generation-test-plan.md`](../qa/server-side-question-generation-test-plan.md).
