# SPEC 041 — Local/OpenAI-Compatible AI Provider Layer

## Contexto

La app de generación de tests de oposiciones ya puede trabajar con IA externa, pero queremos empezar la preparación para usar una IA local/interna sin entrenar un modelo desde cero.

La primera prueba será con:

- Windows.
- GPU AMD Radeon RX 6800 XT de 16 GB.
- LM Studio como servidor local.
- Modelo local recomendado inicialmente: Qwen3 8B Instruct GGUF Q4_K_M.
- API local compatible con OpenAI.
- URL prevista: `http://IP_DEL_PC_IA:1234/v1`.
- API key dummy: `lm-studio`.

Más adelante, si funciona bien, se migrará a un servidor europeo con GPU.

## Objetivo

Preparar la app para cambiar de proveedor de IA sin romper el funcionamiento actual.

La app debe poder trabajar con:

1. OpenAI/API externa actual.
2. LM Studio local.
3. Futuro servidor europeo compatible con OpenAI.

Esta SPEC no debe mejorar todavía la generación de preguntas, rehacer análisis de PDFs, crear RAG avanzado ni reintroducir índices visibles obligatorios. Su objetivo es la infraestructura de proveedor IA.

## Enfoque de bajo riesgo

La integración local debe quedar completamente detrás de variables de entorno.

Sin configurar nada nuevo, el comportamiento debe ser idéntico al actual. Esto es una regla de despliegue: riesgo cero para el deploy actual.

Como LM Studio expone una API OpenAI-compatible, el cambio esencial no es crear un proveedor radicalmente distinto, sino permitir que el cliente OpenAI-compatible use una URL base configurable.

Prioridad técnica:

1. `AI_BASE_URL` configurable.
2. Default seguro: `https://api.openai.com/v1`.
3. Reutilizar compatibilidad con `OPENAI_API_KEY` / `OPENAI_MODEL`.
4. Permitir LM Studio cambiando env, no código.

## Reglas

- El frontend nunca llama directamente al modelo.
- No exponer claves, base URLs privadas ni endpoints internos en frontend.
- Todo pasa por servidor/Edge Function.
- Si el proveedor local no responde, bloqueo honesto.
- No mocks.
- No preguntas `validated` automáticamente.
- Student no puede generar ni ver candidatas internas.
- No tocar Auth ni RLS salvo que sea estrictamente necesario.
- No tocar OCR en esta SPEC salvo extraer llamadas comunes si es seguro y pequeño.
- No borrar OpenAI todavía; debe quedar como adapter opcional.
- No reintroducir dependencia de índice/temario visible ni `topic_id` obligatorio.

## Variables de entorno

Variables nuevas/neutrales recomendadas:

```env
AI_PROVIDER=lmstudio
AI_BASE_URL=http://192.168.1.50:1234/v1
AI_API_KEY=lm-studio
AI_MODEL=qwen3-8b-instruct
AI_REQUEST_TIMEOUT_MS=120000
AI_CONTEXT_WINDOW_TOKENS=8192
AI_MAX_SOURCE_CHARS=8000
```

Valores iniciales permitidos:

```text
openai
lmstudio
custom-openai-compatible
disabled
```

Mantener compatibilidad temporal con nombres existentes:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Regla de resolución:

- Preferir `AI_*` cuando estén definidos.
- Si `AI_*` no está definido y `AI_PROVIDER=openai` o no hay proveedor explícito, permitir fallback temporal a `OPENAI_*`.
- Si `AI_BASE_URL` no está definido, usar `OPENAI_BASE_URL` si existe.
- Si no hay `AI_BASE_URL` ni `OPENAI_BASE_URL`, usar `https://api.openai.com/v1`.
- Si falta configuración suficiente, devolver bloqueo honesto de proveedor no configurado.

## Alcance técnico mínimo

### 1. Capa común de proveedor IA

Crear una abstracción compartida en Supabase Functions, por ejemplo:

```text
supabase/functions/_shared/ai-provider/contract.ts
supabase/functions/_shared/ai-provider/openaiCompatible.ts
supabase/functions/_shared/ai-provider/provider.ts
```

Nombres exactos adaptables al estilo del repo.

La capa debe resolver:

- proveedor;
- base URL;
- API key;
- modelo;
- timeout;
- capacidades de formato (`json_schema`, `json_object`, `text`).

### 2. Adapter OpenAI-compatible

LM Studio expone una API compatible con OpenAI.

El adapter debe llamar a:

```text
{AI_BASE_URL}/chat/completions
```

con:

```text
Authorization: Bearer {AI_API_KEY}
```

Aunque LM Studio use una key dummy, no hardcodearla.

No debe quedar ningún endpoint fijo a `https://api.openai.com/v1/chat/completions` en el flujo de generación. El endpoint debe construirse desde la URL base resuelta.

### 3. Sustituir llamadas directas

Sustituir llamadas directas a:

```text
https://api.openai.com/v1/chat/completions
```

en los puntos de generación de contenido, empezando por:

- `generate-questions-from-studied-material`;
- `study-material` si usa proveedor IA;
- `generate-questions` legacy si sigue activo y el cambio es acotado.

No cambiar la lógica profunda de generación, validación, estudio de material ni tests. Solo cambiar el cliente/proveedor usado.

### 4. Compatibilidad con formato JSON

LM Studio puede no soportar exactamente las mismas capacidades que OpenAI.

Para `lmstudio`:

1. Intentar `json_schema` si el provider/capacidad lo permite.
2. Si el proveedor devuelve un error de formato seguro, por ejemplo `provider_response_format_error`, reintentar una sola vez con `json_object` o JSON estricto por prompt.
3. Parsear y validar estrictamente la respuesta con los validadores existentes.
4. Si no se puede parsear/validar, bloqueo honesto.
5. Nunca crear contenido mock.

Este fallback de formato debe aplicar al camino local/OpenAI-compatible. No debe relajar `validateCandidate`, anclaje a fuente, ni estados permitidos.

### 4.b Manejo de thinking en Qwen3

Qwen3 puede emitir bloques de razonamiento tipo `<think>...</think>` o usar modos híbridos de thinking.

Para LM Studio/Qwen3:

- Si el servidor/modelo soporta parámetro equivalente, inyectar `enable_thinking: false` o instrucción `/no_think` de forma configurable y acotada.
- Independientemente de lo anterior, filtrar bloques `<think>...</think>` antes de parsear JSON.
- No guardar thinking en base de datos.
- No mostrar thinking en frontend.
- No usar thinking como fuente factual.

### 5. Prueba de conexión

Añadir una prueba interna de conexión con la IA, sin exponer secretos en frontend.

Debe comprobar:

- que el servidor responde;
- que el modelo/base URL están configurados;
- que se puede hacer una generación simple;
- que hay timeout controlado.

Prompt de smoke sugerido:

```text
Genera una pregunta tipo test sobre la Constitución Española con 4 opciones, una única respuesta correcta y una explicación breve. Devuelve JSON válido.
```

La prueba debe devolver errores claros si:

- LM Studio está apagado;
- IP/puerto no responde;
- modelo no está cargado;
- respuesta tarda demasiado;
- respuesta no es JSON válido.

### 6. Diagnóstico seguro

Mantener códigos de error seguros:

- `provider_not_configured`
- `provider_http_401`
- `provider_http_403`
- `provider_http_429`
- `provider_timeout`
- `provider_invalid_request`
- `provider_model_not_found`
- `provider_network_error`
- `provider_invalid_json`
- `provider_unknown`

No loguear:

- API keys;
- prompts completos con material privado;
- excerpts largos;
- cabeceras `Authorization`;
- respuestas crudas con contenido del usuario.

Sí registrar:

- proveedor;
- modelo;
- base URL sanitizada (sin credenciales);
- tiempo de respuesta;
- status HTTP;
- código seguro de error;
- uso/tokens si el proveedor los devuelve.

### 7. Timeouts configurables

La IA local puede ser más lenta que OpenAI.

Exponer timeout por env:

```env
AI_REQUEST_TIMEOUT_MS=120000
```

Si ya existen helpers `withTimeout`, reutilizarlos. El timeout no debe dejar runs colgados indefinidamente: debe cerrar con error seguro y estado honesto.

### 8. Ventana de contexto y límites de troceo

Los modelos locales pueden tener menos contexto efectivo que GPT-4o.

Añadir configuración para ventana/contexto y límites de fuente:

```env
AI_CONTEXT_WINDOW_TOKENS=8192
AI_MAX_SOURCE_CHARS=8000
```

La generación debe respetar estos límites al preparar prompts y evidencias.

Si ya existen límites como:

- `MAX_STUDY_CHUNK_CHARS`
- `MAX_QUESTION_SOURCE_CHARS`
- `MAX_DIRECT_EVIDENCE_UNITS`

deben seguir funcionando y, para el proveedor local, no deben exceder la ventana configurada.

No mandar documentos completos al modelo local por defecto.

### 9. Garantías que no se relajan

El uso de modelo local no permite relajar seguridad ni calidad:

- Mantener `allowMockProvider: false` en producción/staging real.
- No mocks.
- Mantener anclaje obligatorio a fuente.
- Mantener validación estricta de salida.
- Mantener `pending_review` / `needs_fix`.
- Nunca `validated` automático.
- No aceptar texto arbitrario del frontend como fuente factual.
- Student no genera ni ve candidatas internas.

## Consideración importante de conectividad

`http://192.168.1.50:1234/v1` es una IP privada LAN.

Supabase Edge Functions en la nube no pueden acceder directamente a una IP privada de una red doméstica. Para staging cloud hará falta una de estas opciones:

- ejecutar funciones/backend en local durante la prueba;
- exponer LM Studio con túnel seguro;
- usar VPN/red privada;
- mover el runtime local a un servidor accesible;
- usar un futuro servidor europeo con URL accesible desde Supabase.

La SPEC debe documentar esta limitación claramente para evitar falsos fallos.

## Documentación requerida

Crear:

```text
docs/setup/local-ai-lm-studio.md
```

Debe incluir:

1. Instalar/abrir LM Studio.
2. Descargar/cargar Qwen3 8B Instruct GGUF Q4_K_M.
3. Activar Developer Mode / Local Server.
4. Verificar endpoint `/v1`.
5. Variables para desarrollo local.
6. Variables para Supabase/servidor.
7. Nota sobre IP privada y conectividad desde cloud.
8. Smoke test.
9. Cómo apagar proveedor online.

## Tests mínimos

Añadir tests para:

- `AI_PROVIDER=lmstudio` usa `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.
- `AI_PROVIDER=openai` sigue usando OpenAI o `OPENAI_*` temporalmente.
- `AI_PROVIDER=disabled` bloquea honestamente.
- timeout configurable.
- error de red devuelve código seguro.
- generación directa mantiene `pending_review`/`needs_fix`, nunca `validated`.
- frontend no envía texto arbitrario ni llama directamente al modelo.

## Criterios de aceptación

La SPEC se considera completada cuando:

1. La app puede seguir usando OpenAI/API externa como antes.
2. La app puede apuntar a LM Studio cambiando variables de entorno.
3. URL y modelo son configurables.
4. Existe una prueba simple de conexión/generación.
5. Los errores de conexión/modelo/timeout son claros y seguros.
6. La generación no queda bloqueada indefinidamente si LM Studio está apagado.
7. No se ha reintroducido índice visible obligatorio.
8. No se ha cambiado la lógica principal de generación de tests.
9. No se exponen claves ni URLs privadas al frontend.
10. Queda preparada la migración futura a servidor europeo compatible con OpenAI.
