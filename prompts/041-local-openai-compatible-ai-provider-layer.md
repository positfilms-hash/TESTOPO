# Prompt para Claude — SPEC 041 Local/OpenAI-Compatible AI Provider Layer

Lee antes de implementar:

- `docs/constitution/CODEX.md`
- `docs/constitution/CLAUDE.md`
- `docs/specs/041-local-openai-compatible-ai-provider-layer.md`
- specs relevantes del flujo actual: SPEC 038, SPEC 039 y SPEC 040

## Rol

Implementa una capa de proveedor IA local/OpenAI-compatible con alcance pequeño y seguro.

No rehagas generación, OCR, Auth, RLS, tests finales ni índice/temario.

## Objetivo

La app debe poder cambiar entre:

- OpenAI/API externa;
- LM Studio local;
- futuro servidor europeo compatible con OpenAI.

Variables objetivo:

```env
AI_PROVIDER=lmstudio
AI_BASE_URL=http://192.168.1.50:1234/v1
AI_API_KEY=lm-studio
AI_MODEL=qwen3-8b-instruct
AI_REQUEST_TIMEOUT_MS=120000
AI_CONTEXT_WINDOW_TOKENS=8192
AI_MAX_SOURCE_CHARS=8000
```

Mantén compatibilidad temporal con:

```env
OPENAI_BASE_URL
OPENAI_API_KEY
OPENAI_MODEL
```

## Implementación mínima

1. Crear shared provider en `supabase/functions/_shared/ai-provider/`.
2. Implementar adapter OpenAI-compatible con URL base configurable.
3. Sustituir llamadas directas a `https://api.openai.com/v1/chat/completions` en:
   - `generate-questions-from-studied-material`;
   - `study-material` si usa proveedor IA;
   - `generate-questions` legacy si el cambio es acotado.
4. Añadir timeout configurable.
5. Mantener diagnósticos seguros.
6. Añadir prueba interna/smoke de conexión con IA.
7. Documentar LM Studio en `docs/setup/local-ai-lm-studio.md`.

## Enfoque de riesgo cero

Todo debe ir detrás de env.

Sin configurar `AI_BASE_URL`/`AI_PROVIDER=lmstudio`, el comportamiento debe ser idéntico al actual.

El cambio esencial es permitir:

```env
AI_BASE_URL=http://192.168.1.50:1234/v1
```

con default:

```env
https://api.openai.com/v1
```

No hardcodear `api.openai.com`.

Reutilizar compatibilidad con:

```env
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_BASE_URL
```

cuando `AI_*` no esté definido.

## Fallback de formato para local

Para LM Studio/Qwen3:

1. Intentar `json_schema` si está soportado.
2. Si aparece `provider_response_format_error`, reintentar una vez con `json_object` o JSON estricto por prompt.
3. Parsear con los validadores existentes.
4. Si no valida, bloqueo honesto.

No relajar `validateCandidate`, anclaje a fuente ni estados.

## Timeouts y contexto local

Exponer:

```env
AI_REQUEST_TIMEOUT_MS=120000
AI_CONTEXT_WINDOW_TOKENS=8192
AI_MAX_SOURCE_CHARS=8000
```

Respetar la ventana de contexto local en el troceo y preparación de prompts. No mandar documentos completos por defecto.

Si ya existen límites (`MAX_STUDY_CHUNK_CHARS`, `MAX_QUESTION_SOURCE_CHARS`, `MAX_DIRECT_EVIDENCE_UNITS`), deben seguir aplicando y no superar el presupuesto local.

## Qwen3 thinking

Qwen3 puede emitir `<think>...</think>`.

Para LM Studio:

- Inyectar `enable_thinking:false` o `/no_think` si aplica y es seguro.
- Filtrar bloques `<think>...</think>` antes de parsear JSON.
- No guardar thinking.
- No mostrar thinking.
- No usar thinking como fuente factual.

## Reglas duras

- Frontend nunca llama directamente al modelo.
- No exponer claves ni base URLs privadas en frontend.
- No mocks.
- Mantener `allowMockProvider:false` en producción/staging real.
- Si el proveedor local no responde, bloqueo honesto.
- No crear preguntas `validated`.
- Student no genera ni ve candidatas internas.
- No tocar Auth/RLS salvo necesidad demostrada.
- No tocar OCR salvo extracción común muy acotada y segura.
- No borrar OpenAI todavía.
- No reintroducir índice visible obligatorio ni `topic_id` obligatorio.

## Punto crítico

Documenta que Supabase Edge Functions cloud no puede llamar directamente a `192.168.x.x`. Para probar LM Studio desde cloud hará falta túnel/VPN/servidor accesible o ejecución local.

## Tests

Añade tests para:

- provider `lmstudio` resuelve base URL/model/key desde `AI_*`;
- provider `openai` mantiene compatibilidad;
- provider disabled bloquea;
- timeout/error red;
- generación directa sigue `pending_review`/`needs_fix`, nunca `validated`;
- no texto arbitrario desde frontend.

## Entrega esperada

- Código.
- Tests.
- Build si aplica.
- Documentación setup.
- Nota clara de qué hay que desplegar: Edge Functions afectadas y si Vercel no es necesario.
