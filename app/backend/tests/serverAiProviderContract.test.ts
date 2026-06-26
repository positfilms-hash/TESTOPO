// SPEC 041: tests del contrato COMPARTIDO de la capa de proveedor IA
// OpenAI-compatible. Logica PURA, sin red. Importa el MISMO modulo que usan las
// Edge Functions `generate-questions-from-studied-material` y `study-material`.

import { describe, it, expect } from 'vitest';
import {
  AI_PROVIDER_ERROR,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_TIMEOUT_MS,
  MAX_AI_TIMEOUT_MS,
  resolveAiProvider,
  normalizeBaseUrl,
  buildChatCompletionsUrl,
  sanitizeBaseUrl,
  stripThinkBlocks,
  applyThinkingPolicy,
  usesJsonSchema,
  downgradeResponseFormat,
  classifyAiProviderError,
  buildSmokeRequest,
  resolveMaxSourceChars,
  capSourceChars,
} from '../../../supabase/functions/_shared/ai-provider/contract';

describe('resolveAiProvider', () => {
  it('AI_PROVIDER=lmstudio usa AI_BASE_URL/AI_API_KEY/AI_MODEL', () => {
    const p = resolveAiProvider({
      AI_PROVIDER: 'lmstudio',
      AI_BASE_URL: 'http://192.168.1.50:1234/v1',
      AI_API_KEY: 'lm-studio',
      AI_MODEL: 'qwen3-8b-instruct',
    });
    expect(p).not.toBeNull();
    expect(p?.provider).toBe('lmstudio');
    expect(p?.baseUrl).toBe('http://192.168.1.50:1234/v1');
    expect(p?.apiKey).toBe('lm-studio');
    expect(p?.model).toBe('qwen3-8b-instruct');
    expect(p?.isLocal).toBe(true);
    expect(p?.disableThinking).toBe(true); // local sin AI_ENABLE_THINKING => off
  });

  it('AI_PROVIDER=openai mantiene compatibilidad con OPENAI_* y base URL por defecto', () => {
    const p = resolveAiProvider({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-4o-mini',
    });
    expect(p?.provider).toBe('openai');
    expect(p?.baseUrl).toBe(DEFAULT_AI_BASE_URL);
    expect(p?.apiKey).toBe('sk-test');
    expect(p?.model).toBe('gpt-4o-mini');
    expect(p?.isLocal).toBe(false);
    expect(p?.disableThinking).toBe(false);
  });

  it('AI_* tiene prioridad sobre OPENAI_*', () => {
    const p = resolveAiProvider({
      AI_PROVIDER: 'openai',
      AI_BASE_URL: 'https://eu.example.com/v1',
      AI_API_KEY: 'ai-key',
      AI_MODEL: 'ai-model',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_API_KEY: 'openai-key',
      OPENAI_MODEL: 'gpt-4o',
    });
    expect(p?.baseUrl).toBe('https://eu.example.com/v1');
    expect(p?.apiKey).toBe('ai-key');
    expect(p?.model).toBe('ai-model');
  });

  it('AI_PROVIDER=disabled bloquea (null = bloqueo honesto)', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'disabled', AI_API_KEY: 'x' })).toBeNull();
  });

  it('sin proveedor explicito devuelve null (comportamiento identico al actual)', () => {
    expect(resolveAiProvider({ OPENAI_API_KEY: 'sk-test' })).toBeNull();
  });

  it('proveedor configurado pero sin api key devuelve null (no se hardcodea clave)', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'lmstudio', AI_BASE_URL: 'http://x/v1' })).toBeNull();
  });

  it('proveedor desconocido devuelve null', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'ollama-raw', AI_API_KEY: 'x' })).toBeNull();
  });

  it('usa legacyProvider/legacyModel solo si AI_PROVIDER no esta definido (gate de study)', () => {
    const p = resolveAiProvider(
      { OPENAI_API_KEY: 'sk-test' },
      { legacyProvider: 'openai', legacyModel: 'study-model', defaultModel: 'def' },
    );
    expect(p?.provider).toBe('openai');
    expect(p?.model).toBe('study-model');
  });

  it('AI_PROVIDER global tiene prioridad sobre el legacy del flujo', () => {
    const p = resolveAiProvider(
      { AI_PROVIDER: 'lmstudio', AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1' },
      { legacyProvider: 'openai' },
    );
    expect(p?.provider).toBe('lmstudio');
  });

  it('timeout configurable y acotado a limites seguros', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'openai', AI_API_KEY: 'k', AI_REQUEST_TIMEOUT_MS: '45000' })?.timeoutMs).toBe(45000);
    // Por debajo del minimo o no numerico -> default.
    expect(resolveAiProvider({ AI_PROVIDER: 'openai', AI_API_KEY: 'k', AI_REQUEST_TIMEOUT_MS: 'abc' })?.timeoutMs).toBe(DEFAULT_AI_TIMEOUT_MS);
    // Por encima del maximo -> clamp.
    expect(resolveAiProvider({ AI_PROVIDER: 'openai', AI_API_KEY: 'k', AI_REQUEST_TIMEOUT_MS: '99999999' })?.timeoutMs).toBe(MAX_AI_TIMEOUT_MS);
  });

  it('ventana de contexto y max source chars opcionales', () => {
    const p = resolveAiProvider({ AI_PROVIDER: 'lmstudio', AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1', AI_CONTEXT_WINDOW_TOKENS: '8192', AI_MAX_SOURCE_CHARS: '8000' });
    expect(p?.contextWindowTokens).toBe(8192);
    expect(p?.maxSourceChars).toBe(8000);
    const q = resolveAiProvider({ AI_PROVIDER: 'openai', AI_API_KEY: 'k' });
    expect(q?.contextWindowTokens).toBeNull();
    expect(q?.maxSourceChars).toBeNull();
  });

  it('AI_ENABLE_THINKING=true permite thinking en local', () => {
    const p = resolveAiProvider({ AI_PROVIDER: 'lmstudio', AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1', AI_ENABLE_THINKING: 'true' });
    expect(p?.disableThinking).toBe(false);
  });

  it('default de modelo cuando no hay ninguno configurado', () => {
    const p = resolveAiProvider({ AI_PROVIDER: 'openai', AI_API_KEY: 'k' });
    expect(p?.model).toBe(DEFAULT_AI_MODEL);
  });
});

describe('endpoint y saneado de base URL', () => {
  it('buildChatCompletionsUrl usa la base resuelta, nunca api.openai.com fijo', () => {
    expect(buildChatCompletionsUrl('http://192.168.1.50:1234/v1')).toBe('http://192.168.1.50:1234/v1/chat/completions');
    expect(buildChatCompletionsUrl('http://192.168.1.50:1234/v1/')).toBe('http://192.168.1.50:1234/v1/chat/completions');
  });

  it('normalizeBaseUrl quita barras finales', () => {
    expect(normalizeBaseUrl('http://x/v1///')).toBe('http://x/v1');
  });

  it('sanitizeBaseUrl elimina credenciales y query', () => {
    expect(sanitizeBaseUrl('https://user:pass@host:1234/v1?token=secret')).toBe('https://host:1234/v1');
  });
});

describe('thinking de Qwen3', () => {
  it('stripThinkBlocks elimina bloques completos', () => {
    expect(stripThinkBlocks('<think>razonando...</think>{"a":1}')).toBe('{"a":1}');
  });

  it('stripThinkBlocks elimina apertura sin cierre (truncado)', () => {
    expect(stripThinkBlocks('texto<think>incompleto sin cierre')).toBe('texto');
  });

  it('stripThinkBlocks devuelve null/igual si no hay bloque', () => {
    expect(stripThinkBlocks('{"a":1}')).toBe('{"a":1}');
    expect(stripThinkBlocks(null)).toBeNull();
  });

  it('applyThinkingPolicy inyecta enable_thinking:false solo si disableThinking', () => {
    const body = { model: 'm', messages: [] };
    const withPolicy = applyThinkingPolicy(body, { disableThinking: true });
    expect((withPolicy.chat_template_kwargs as Record<string, unknown>).enable_thinking).toBe(false);
    // No muta el original.
    expect(body).not.toHaveProperty('chat_template_kwargs');
    // Sin disableThinking, devuelve el body intacto.
    expect(applyThinkingPolicy(body, { disableThinking: false })).toBe(body);
  });
});

describe('fallback de formato json_schema -> json_object', () => {
  it('usesJsonSchema detecta response_format json_schema', () => {
    expect(usesJsonSchema({ response_format: { type: 'json_schema', json_schema: {} } })).toBe(true);
    expect(usesJsonSchema({ response_format: { type: 'json_object' } })).toBe(false);
    expect(usesJsonSchema({})).toBe(false);
  });

  it('downgradeResponseFormat cambia a json_object sin mutar el original', () => {
    const body = { model: 'm', response_format: { type: 'json_schema', json_schema: { strict: true } } };
    const down = downgradeResponseFormat(body);
    expect(down.response_format).toEqual({ type: 'json_object' });
    expect((body.response_format as { type: string }).type).toBe('json_schema');
  });
});

describe('classifyAiProviderError (diagnostico seguro)', () => {
  it('mapea status HTTP a provider_http_NNN', () => {
    expect(classifyAiProviderError(401, null).codes).toContain('provider_http_401');
    expect(classifyAiProviderError(429, null).codes).toContain('provider_http_429');
  });

  it('detecta cuota insuficiente', () => {
    const info = classifyAiProviderError(429, { error: { code: 'insufficient_quota' } });
    expect(info.codes).toContain(AI_PROVIDER_ERROR.INSUFFICIENT_QUOTA);
  });

  it('detecta modelo no encontrado', () => {
    const info = classifyAiProviderError(404, { error: { message: 'The model qwen3 does not exist' } });
    expect(info.codes).toContain(AI_PROVIDER_ERROR.MODEL_NOT_FOUND);
  });

  it('detecta error de response_format y marca isResponseFormat', () => {
    const info = classifyAiProviderError(400, { error: { message: 'response_format json_schema not supported', param: 'response_format' } });
    expect(info.codes).toContain(AI_PROVIDER_ERROR.RESPONSE_FORMAT);
    expect(info.isResponseFormat).toBe(true);
  });

  it('no incluye datos sensibles, solo status/code/type', () => {
    const info = classifyAiProviderError(400, { error: { type: 'invalid_request_error', code: 'x' } });
    expect(info.provider_status).toBe(400);
    expect(info.provider_type).toBe('invalid_request_error');
    expect(Object.keys(info)).toEqual(['codes', 'provider_status', 'provider_code', 'provider_type', 'isResponseFormat']);
  });
});

describe('limite de chars de fuente local (SPEC 041 #8)', () => {
  it('resolveMaxSourceChars parsea o devuelve null', () => {
    expect(resolveMaxSourceChars({ AI_MAX_SOURCE_CHARS: '8000' })).toBe(8000);
    expect(resolveMaxSourceChars({ AI_MAX_SOURCE_CHARS: '0' })).toBeNull();
    expect(resolveMaxSourceChars({ AI_MAX_SOURCE_CHARS: 'x' })).toBeNull();
    expect(resolveMaxSourceChars({})).toBeNull();
  });

  it('capSourceChars solo endurece el presupuesto existente', () => {
    expect(capSourceChars(20000, 8000)).toBe(8000); // tope local mas estricto
    expect(capSourceChars(5000, 8000)).toBe(5000); // el flujo ya es mas estricto
    expect(capSourceChars(20000, null)).toBe(20000); // sin tope local => igual que hoy
  });
});

describe('buildSmokeRequest', () => {
  it('genera una peticion minima con json_object y respeta thinking', () => {
    const provider = resolveAiProvider({ AI_PROVIDER: 'lmstudio', AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1', AI_MODEL: 'qwen3-8b-instruct' })!;
    const req = buildSmokeRequest(provider);
    expect(req.model).toBe('qwen3-8b-instruct');
    expect(req.response_format).toEqual({ type: 'json_object' });
    expect((req.chat_template_kwargs as Record<string, unknown>).enable_thinking).toBe(false);
  });
});
