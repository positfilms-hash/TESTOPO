# IA local con LM Studio (SPEC 041)

Esta guia explica como usar un modelo de IA **local** (LM Studio en Windows, GPU
AMD/NVIDIA) como proveedor de la app, en lugar de OpenAI, para reducir costes y no
depender de un proveedor externo. La app habla con LM Studio a traves de su **API
compatible con OpenAI**, asi que el cambio es solo de **variables de entorno**: sin
configurar nada nuevo, el comportamiento es identico al actual.

> Garantias que NO cambian con IA local: la generacion sigue anclada a fuente, las
> candidatas quedan `pending_review`/`needs_fix` (nunca `validated` automatico), el
> frontend nunca llama al modelo y las claves son secreto de servidor.

## 1. Instalar / abrir LM Studio

1. Descarga LM Studio para Windows desde su web oficial e instalalo.
2. Abrelo. En una GPU AMD Radeon RX 6800 XT (16 GB) usa el backend **Vulkan**
   (el runtime ROCm en Windows para esa tarjeta es irregular).

## 2. Descargar / cargar el modelo

Modelo recomendado inicial: **Qwen3 8B Instruct GGUF Q4_K_M** (~5 GB; deja VRAM de
sobra en 16 GB). Alternativa ligera para smoke: Gemma 3 4B Q4_K_M. Si el rendimiento
acompana, prueba Qwen3 14B Q4_K_M para mejor calidad en contenido juridico.

1. Pestana **Search** -> busca `Qwen3 8B Instruct GGUF` -> descarga la variante
   `Q4_K_M`.
2. Pestana **Chat** o **Developer** -> carga el modelo (Load).

> Qwen3 puede emitir razonamiento `<think>...</think>`. La app desactiva el thinking
> en proveedores locales (`enable_thinking:false`) y, ademas, filtra cualquier bloque
> `<think>` antes de parsear el JSON. Para permitir thinking pon `AI_ENABLE_THINKING=true`.

## 3. Activar el servidor local (Developer Mode)

1. Ve a la pestana **Developer** (o **Local Server**).
2. Pulsa **Start Server**. Por defecto escucha en `http://localhost:1234`.
3. Asegurate de que el endpoint OpenAI-compatible esta activo: la base URL es
   `http://localhost:1234/v1`.
4. (Opcional) Configura una API key; LM Studio acepta una key dummy como `lm-studio`.

## 4. Verificar el endpoint `/v1`

Con el servidor arrancado y el modelo cargado, comprueba que responde:

```bash
curl http://localhost:1234/v1/models
```

Debe listar el modelo cargado. Si no responde, revisa que el server este iniciado y
el modelo cargado.

## 5. Smoke test (prueba de conexion)

Hay un script autocontenido que valida conexion + generacion + timeout sin exponer
secretos. Es lo PRIMERO que deberias correr (Fase 0), antes de tocar la app:

```bash
AI_PROVIDER=lmstudio \
AI_BASE_URL=http://localhost:1234/v1 \
AI_API_KEY=lm-studio \
AI_MODEL=qwen3-8b-instruct \
node scripts/ai-connection-test.mjs
```

Salida esperada: `✓ Conexion y generacion OK (… ms)` + una pregunta de prueba en JSON.
Errores claros y seguros si algo falla:

| Sintoma                              | Codigo                     |
| ------------------------------------ | -------------------------- |
| LM Studio apagado / IP/puerto malo   | `provider_network_error`   |
| Respuesta demasiado lenta            | `provider_timeout`         |
| Modelo no cargado / nombre erroneo   | `provider_http_404`        |
| API key invalida                     | `provider_http_401/403`    |
| El modelo no devuelve JSON parseable | `provider_invalid_json`    |

## 6. Variables para desarrollo local

Copia `.env.example` a `.env` y descomenta el bloque de IA local:

```env
AI_PROVIDER=lmstudio
AI_BASE_URL=http://localhost:1234/v1
AI_API_KEY=lm-studio
AI_MODEL=qwen3-8b-instruct
AI_REQUEST_TIMEOUT_MS=120000
AI_CONTEXT_WINDOW_TOKENS=8192
AI_MAX_SOURCE_CHARS=8000
```

Reglas de resolucion (las **AI_\*** tienen prioridad):

- `AI_BASE_URL` -> si falta, `OPENAI_BASE_URL` -> si falta, `https://api.openai.com/v1`.
- `AI_API_KEY` -> si falta, `OPENAI_API_KEY` (obligatoria; sin ella -> bloqueo honesto).
- `AI_MODEL` -> modelo legado del flujo -> `OPENAI_MODEL` -> default.
- `AI_PROVIDER=disabled` o ninguno -> proveedor no configurado (bloqueo honesto).
- `AI_MAX_SOURCE_CHARS` solo **endurece** los limites de fuente del flujo, nunca los amplia.

## 7. Variables para Supabase / servidor

Las Edge Functions afectadas son **`generate-questions-from-studied-material`** y
**`study-material`**. Configura los secretos en el servidor (no en el repo, nunca con
prefijo `VITE_`):

```bash
supabase secrets set \
  AI_PROVIDER=lmstudio \
  AI_BASE_URL=https://TU-TUNEL-PUBLICO/v1 \
  AI_API_KEY=un-token-secreto \
  AI_MODEL=qwen3-8b-instruct \
  AI_REQUEST_TIMEOUT_MS=120000 \
  AI_MAX_SOURCE_CHARS=8000
supabase functions deploy generate-questions-from-studied-material
supabase functions deploy study-material
```

No hay migracion de base de datos en esta SPEC. **Vercel/frontend no requiere cambios**
(el navegador nunca habla con el modelo).

## 8. IP privada y conectividad desde la nube (IMPORTANTE)

`http://192.168.1.50:1234/v1` es una IP **privada de tu LAN**. Las Edge Functions de
Supabase corren en la nube y **no pueden alcanzar una IP privada de tu casa**. Para
probar LM Studio desde Supabase cloud necesitas una de estas opciones:

- **Ejecutar la generacion en local** durante la prueba (Fase 0 con el script de arriba
  o un backend local) apuntando a `http://localhost:1234/v1`.
- **Exponer LM Studio con un tunel seguro** (Cloudflare Tunnel o ngrok) y usar la URL
  publica como `AI_BASE_URL` + un `AI_API_KEY` que actue de token de acceso. No abras
  puertos de tu router directamente.
- **VPN / red privada** que conecte el runtime con quien hace la llamada.
- **Servidor europeo con GPU** y URL accesible desde Supabase (la migracion futura):
  como la base URL es configurable, solo cambias `AI_BASE_URL`. Para NVIDIA conviene
  un servidor OpenAI-compatible robusto en salida estructurada (p.ej. vLLM).

Documentar esto evita falsos fallos del tipo "el OCR/la generacion no funciona": en
realidad la nube no llega a la IP privada.

## 9. Como volver al proveedor online

Para volver a OpenAI (o desactivar la IA local), simplemente:

- Pon `AI_PROVIDER=openai` (o elimina las `AI_*`) y deja `OPENAI_API_KEY`/`OPENAI_MODEL`.
- O `AI_PROVIDER=disabled` para bloquear honestamente la generacion (501) sin mocks.

Tras cambiar secretos en Supabase, vuelve a `supabase functions deploy` de las dos
funciones afectadas. El cambio de proveedor no toca codigo.
