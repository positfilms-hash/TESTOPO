// SPEC 041 — Capa comun de proveedor IA (OpenAI-compatible). PURO (sin red, sin
// Deno): testeable en vitest e importable por las Edge Functions. Centraliza:
//
//  - Resolucion de proveedor/base URL/clave/modelo/timeout/contexto desde env,
//    con `AI_*` preferente y fallback temporal a las variables existentes
//    (`OPENAI_*` / variable de proveedor legada por flujo). Riesgo cero: sin
//    configurar nada nuevo, el comportamiento es identico al actual.
//  - Construccion del endpoint `{baseUrl}/chat/completions` (NUNCA hardcodear
//    `https://api.openai.com`).
//  - Fallback de formato `json_schema` -> `json_object` para modelos locales.
//  - Manejo del `thinking` de Qwen3 (filtrar `<think>...</think>`, `/no_think`).
//  - Diagnostico SEGURO de errores (codigos estables, sin secretos ni texto).
//
// El navegador NUNCA llama al modelo: estas piezas solo se usan en servidor.

// ---------------------------------------------------------------------------
// Utilidades locales (sin dependencias).
// ---------------------------------------------------------------------------
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// ---------------------------------------------------------------------------
// Defaults y limites seguros.
// ---------------------------------------------------------------------------
export const DEFAULT_AI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_AI_MODEL = 'gpt-4o-mini';
export const DEFAULT_AI_TIMEOUT_MS = 120000;
export const MIN_AI_TIMEOUT_MS = 1000;
export const MAX_AI_TIMEOUT_MS = 600000;

/** Valores de `AI_PROVIDER` aceptados. `disabled` => bloqueo honesto. */
export type AiProviderKind = 'openai' | 'lmstudio' | 'custom-openai-compatible';
const KNOWN_PROVIDER_KINDS: ReadonlyArray<AiProviderKind | 'disabled'> = [
  'openai',
  'lmstudio',
  'custom-openai-compatible',
  'disabled',
];

// ---------------------------------------------------------------------------
// Codigos de diagnostico SEGUROS (catalogo SPEC 041). Estables; nunca incluyen
// api keys, prompts, excerpts ni respuestas crudas del usuario.
// ---------------------------------------------------------------------------
export const AI_PROVIDER_ERROR = {
  NOT_CONFIGURED: 'provider_not_configured',
  TIMEOUT: 'provider_timeout',
  NETWORK: 'provider_network_error',
  INVALID_JSON: 'provider_invalid_json',
  RESPONSE_FORMAT: 'provider_response_format_error',
  MODEL_NOT_FOUND: 'provider_model_not_found',
  INVALID_REQUEST: 'provider_invalid_request',
  INSUFFICIENT_QUOTA: 'provider_insufficient_quota',
  UNKNOWN: 'provider_unknown',
} as const;

// ---------------------------------------------------------------------------
// Resolucion de proveedor desde env.
// ---------------------------------------------------------------------------
export interface AiProviderEnv {
  // Variables nuevas/neutrales (preferentes).
  AI_PROVIDER?: string | null;
  AI_BASE_URL?: string | null;
  AI_API_KEY?: string | null;
  AI_MODEL?: string | null;
  AI_REQUEST_TIMEOUT_MS?: string | null;
  AI_CONTEXT_WINDOW_TOKENS?: string | null;
  AI_MAX_SOURCE_CHARS?: string | null;
  AI_ENABLE_THINKING?: string | null;
  // Compatibilidad temporal con el esquema actual.
  OPENAI_BASE_URL?: string | null;
  OPENAI_API_KEY?: string | null;
  OPENAI_MODEL?: string | null;
}

export interface ResolvedAiProvider {
  provider: AiProviderKind;
  baseUrl: string; // normalizada, sin barra final
  apiKey: string;
  model: string;
  timeoutMs: number;
  contextWindowTokens: number | null;
  maxSourceChars: number | null;
  /** lmstudio/custom => habilita /no_think y el fallback de formato. */
  isLocal: boolean;
  /** Inyectar `enable_thinking:false` en la peticion (Qwen3). */
  disableThinking: boolean;
}

export interface ResolveAiProviderOptions {
  /**
   * Variable de proveedor legada del flujo (p.ej. `STUDY_PROVIDER`). Solo se usa
   * si `AI_PROVIDER` no esta definido, para no cambiar el comportamiento actual.
   */
  legacyProvider?: string | null;
  /** Modelo legado del flujo (p.ej. `STUDY_MODEL`), fallback tras `AI_MODEL`. */
  legacyModel?: string | null;
  /** Modelo por defecto del flujo si no hay ninguno configurado. */
  defaultModel?: string;
}

/**
 * Resuelve el proveedor IA OpenAI-compatible. Devuelve `null` (bloqueo honesto)
 * si el proveedor esta deshabilitado o falta configuracion suficiente.
 *
 * Reglas (SPEC 041):
 *  - Proveedor efectivo = `AI_PROVIDER` si esta definido; si no, la variable
 *    legada del flujo. Sin ninguno -> no configurado (identico a hoy).
 *  - `disabled` -> null.
 *  - base URL: `AI_BASE_URL` -> `OPENAI_BASE_URL` -> default OpenAI.
 *  - api key: `AI_API_KEY` -> `OPENAI_API_KEY` (obligatoria; sin ella -> null).
 *  - modelo: `AI_MODEL` -> modelo legado -> `OPENAI_MODEL` -> defaultModel.
 */
export function resolveAiProvider(
  env: AiProviderEnv,
  opts: ResolveAiProviderOptions = {},
): ResolvedAiProvider | null {
  const raw = (
    isNonEmptyString(env.AI_PROVIDER)
      ? env.AI_PROVIDER
      : isNonEmptyString(opts.legacyProvider)
        ? opts.legacyProvider
        : ''
  )
    .trim()
    .toLowerCase();

  if (raw === '' || raw === 'disabled') return null;
  // Proveedor desconocido -> bloqueo honesto (no se asume OpenAI a ciegas).
  if (!KNOWN_PROVIDER_KINDS.includes(raw as AiProviderKind | 'disabled')) return null;

  const provider = raw as AiProviderKind;
  const isLocal = provider !== 'openai';

  const apiKey = isNonEmptyString(env.AI_API_KEY)
    ? env.AI_API_KEY.trim()
    : isNonEmptyString(env.OPENAI_API_KEY)
      ? env.OPENAI_API_KEY.trim()
      : '';
  if (apiKey === '') return null; // no se hardcodea ninguna clave, ni la dummy local.

  const baseUrl = normalizeBaseUrl(
    isNonEmptyString(env.AI_BASE_URL)
      ? env.AI_BASE_URL
      : isNonEmptyString(env.OPENAI_BASE_URL)
        ? env.OPENAI_BASE_URL
        : DEFAULT_AI_BASE_URL,
  );

  const model = isNonEmptyString(env.AI_MODEL)
    ? env.AI_MODEL.trim()
    : isNonEmptyString(opts.legacyModel)
      ? opts.legacyModel.trim()
      : isNonEmptyString(env.OPENAI_MODEL)
        ? env.OPENAI_MODEL.trim()
        : opts.defaultModel ?? DEFAULT_AI_MODEL;

  const timeoutRaw = parseIntOrNull(env.AI_REQUEST_TIMEOUT_MS);
  const timeoutMs =
    timeoutRaw !== null && timeoutRaw > 0
      ? clamp(timeoutRaw, MIN_AI_TIMEOUT_MS, MAX_AI_TIMEOUT_MS)
      : DEFAULT_AI_TIMEOUT_MS;

  const ctx = parseIntOrNull(env.AI_CONTEXT_WINDOW_TOKENS);
  const contextWindowTokens = ctx !== null && ctx > 0 ? ctx : null;
  const maxChars = parseIntOrNull(env.AI_MAX_SOURCE_CHARS);
  const maxSourceChars = maxChars !== null && maxChars > 0 ? maxChars : null;

  // Por defecto el thinking se desactiva en proveedores locales (Qwen3 emite
  // <think>) salvo que se pida explicitamente con AI_ENABLE_THINKING=true.
  const enableThinking = (env.AI_ENABLE_THINKING ?? '').trim().toLowerCase() === 'true';
  const disableThinking = isLocal && !enableThinking;

  return {
    provider,
    baseUrl,
    apiKey,
    model,
    timeoutMs,
    contextWindowTokens,
    maxSourceChars,
    isLocal,
    disableThinking,
  };
}

// ---------------------------------------------------------------------------
// Endpoint y saneado de la base URL.
// ---------------------------------------------------------------------------
/** Quita barras finales y espacios. No valida el protocolo (lo hara el fetch). */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/** `{baseUrl}/chat/completions`. NUNCA endpoint fijo a api.openai.com. */
export function buildChatCompletionsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

/**
 * Base URL apta para logs: conserva esquema/host/puerto/ruta pero elimina
 * cualquier credencial incrustada (user:pass@) y la query.
 */
export function sanitizeBaseUrl(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    u.username = '';
    u.password = '';
    u.search = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    // Sin esquema parseable: devuelve solo host:puerto si se reconoce.
    return normalizeBaseUrl(baseUrl).replace(/^[a-z]+:\/\//i, '');
  }
}

// ---------------------------------------------------------------------------
// Manejo del thinking de Qwen3.
// ---------------------------------------------------------------------------
/** Elimina bloques `<think>...</think>` (incl. solo apertura) antes de parsear. */
export function stripThinkBlocks(content: string | null | undefined): string | null {
  if (typeof content !== 'string') return content ?? null;
  let out = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Apertura sin cierre (truncado): descarta hasta el final del bloque.
  out = out.replace(/<think>[\s\S]*$/i, '');
  return out.trim();
}

/**
 * Ajusta la peticion para desactivar el thinking en servidores compatibles
 * (LM Studio/llama.cpp aceptan `chat_template_kwargs.enable_thinking`). No
 * muta el objeto recibido. Solo aplica si `disableThinking`.
 */
export function applyThinkingPolicy(
  body: Record<string, unknown>,
  provider: Pick<ResolvedAiProvider, 'disableThinking'>,
): Record<string, unknown> {
  if (!provider.disableThinking) return body;
  const existing =
    body.chat_template_kwargs && typeof body.chat_template_kwargs === 'object'
      ? (body.chat_template_kwargs as Record<string, unknown>)
      : {};
  return {
    ...body,
    chat_template_kwargs: { ...existing, enable_thinking: false },
  };
}

// ---------------------------------------------------------------------------
// Fallback de formato: json_schema -> json_object (modelos locales que no
// soportan json_schema estricto). PURO: devuelve una copia con el formato
// reducido. NO relaja la validacion posterior (validateCandidate sigue igual).
// ---------------------------------------------------------------------------
/** True si la peticion pide `response_format.type === 'json_schema'`. */
export function usesJsonSchema(body: Record<string, unknown>): boolean {
  const rf = body.response_format;
  return !!rf && typeof rf === 'object' && (rf as { type?: unknown }).type === 'json_schema';
}

/** Devuelve una copia de la peticion con `response_format: { type:'json_object' }`. */
export function downgradeResponseFormat(body: Record<string, unknown>): Record<string, unknown> {
  return { ...body, response_format: { type: 'json_object' } };
}

// ---------------------------------------------------------------------------
// Diagnostico SEGURO de errores del proveedor. Mapea status HTTP + body de
// error (estilo OpenAI; LM Studio replica el formato) a codigos estables.
// NUNCA incluye api key, prompts, excerpts ni la respuesta cruda.
// ---------------------------------------------------------------------------
export interface AiProviderErrorInfo {
  codes: string[];
  provider_status: number;
  provider_code: string | null;
  provider_type: string | null;
  /** True si el error apunta a un problema de `response_format`/`json_schema`. */
  isResponseFormat: boolean;
}

export function classifyAiProviderError(status: number, body: unknown): AiProviderErrorInfo {
  const codes: string[] = [`provider_http_${status}`];
  let providerCode: string | null = null;
  let providerType: string | null = null;
  let message = '';
  let param = '';
  if (body && typeof body === 'object') {
    const err = (body as { error?: unknown }).error;
    if (err && typeof err === 'object') {
      const e = err as { message?: unknown; type?: unknown; code?: unknown; param?: unknown };
      providerType = isNonEmptyString(e.type) ? e.type.trim() : null;
      providerCode = isNonEmptyString(e.code) ? e.code.trim() : null;
      message = isNonEmptyString(e.message) ? e.message.toLowerCase() : '';
      param = isNonEmptyString(e.param) ? e.param.toLowerCase() : '';
    }
  }
  const hay = `${providerType ?? ''} ${providerCode ?? ''} ${message}`.toLowerCase();

  if (
    providerCode === 'insufficient_quota' ||
    hay.includes('insufficient_quota') ||
    hay.includes('exceeded your current quota')
  ) {
    codes.push(AI_PROVIDER_ERROR.INSUFFICIENT_QUOTA);
  }
  if (
    providerCode === 'model_not_found' ||
    hay.includes('model_not_found') ||
    (hay.includes('model') && hay.includes('does not exist')) ||
    (hay.includes('model') && hay.includes('not found'))
  ) {
    codes.push(AI_PROVIDER_ERROR.MODEL_NOT_FOUND);
  }
  if (providerType === 'invalid_request_error') {
    codes.push(AI_PROVIDER_ERROR.INVALID_REQUEST);
  }
  const isResponseFormat =
    hay.includes('response_format') ||
    hay.includes('json_schema') ||
    hay.includes('json schema') ||
    param.includes('response_format');
  if (isResponseFormat) {
    codes.push(AI_PROVIDER_ERROR.RESPONSE_FORMAT);
  }
  return {
    codes: [...new Set(codes)],
    provider_status: status,
    provider_code: providerCode,
    provider_type: providerType,
    isResponseFormat,
  };
}

// ---------------------------------------------------------------------------
// Smoke de conexion (SPEC 041 #5). Peticion minima para validar que el servidor
// responde y genera JSON. PURA: la llamada de red vive en openaiCompatible.ts.
// ---------------------------------------------------------------------------
export const AI_SMOKE_PROMPT =
  'Genera una pregunta tipo test sobre la Constitucion Espanola con 4 opciones, una unica ' +
  'respuesta correcta y una explicacion breve. Devuelve JSON valido con las claves ' +
  'statement, options (array), correct_index y explanation.';

// ---------------------------------------------------------------------------
// Limite de chars de fuente para el proveedor local (SPEC 041 #8). Se usa para
// ENDURECER el presupuesto de chars existente de cada flujo (nunca ampliarlo):
// `Math.min(presupuestoExistente, aiMax)`. PURO.
// ---------------------------------------------------------------------------
export function resolveMaxSourceChars(env: { AI_MAX_SOURCE_CHARS?: string | null }): number | null {
  const n = parseIntOrNull(env.AI_MAX_SOURCE_CHARS);
  return n !== null && n > 0 ? n : null;
}

/** Devuelve el menor entre el presupuesto del flujo y el tope local (si existe). */
export function capSourceChars(flowBudget: number, aiMaxSourceChars: number | null): number {
  return aiMaxSourceChars !== null ? Math.min(flowBudget, aiMaxSourceChars) : flowBudget;
}

export function buildSmokeRequest(provider: ResolvedAiProvider): Record<string, unknown> {
  const base: Record<string, unknown> = {
    model: provider.model,
    temperature: 0,
    messages: [
      { role: 'system', content: 'Responde SOLO con JSON valido, sin texto adicional.' },
      { role: 'user', content: AI_SMOKE_PROMPT },
    ],
    response_format: { type: 'json_object' },
  };
  return applyThinkingPolicy(base, provider);
}
