// SPEC 041 — Adapter OpenAI-compatible (UNICA capa con red). Llama a
// `{baseUrl}/chat/completions` con la base URL resuelta (NUNCA endpoint fijo a
// api.openai.com), aplica timeout configurable, el fallback de formato
// json_schema->json_object para modelos locales y devuelve diagnostico SEGURO.
//
// No vive en contract.ts (que es PURO y testeable en vitest) porque aqui hay
// red. Las Edge Functions importan `callChatCompletion` desde aqui.

import {
  AI_PROVIDER_ERROR,
  applyThinkingPolicy,
  buildChatCompletionsUrl,
  classifyAiProviderError,
  downgradeResponseFormat,
  sanitizeBaseUrl,
  stripThinkBlocks,
  usesJsonSchema,
  type AiProviderErrorInfo,
  type ResolvedAiProvider,
} from './contract.ts';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export interface ChatCompletionResult {
  ok: boolean;
  /** Contenido del modelo ya SIN bloques <think> (listo para parsear). */
  content: string | null;
  /** `usage` crudo del proveedor (tokens) para el tracking de coste. */
  usage: unknown;
  /** Solo en fallo: diagnostico seguro (codigos estables, sin secretos). */
  info?: AiProviderErrorInfo;
}

/**
 * Llama al endpoint chat/completions del proveedor resuelto.
 *
 *  - Construye la URL desde `provider.baseUrl`.
 *  - Aplica `Authorization: Bearer <apiKey>` (la clave es secreto de servidor).
 *  - Aplica la politica de thinking (Qwen3) sobre el body.
 *  - Timeout via `provider.timeoutMs`.
 *  - Si el proveedor rechaza por `response_format`/`json_schema` y el body usaba
 *    json_schema, reintenta UNA sola vez con `json_object`.
 *  - Filtra `<think>...</think>` del contenido antes de devolverlo.
 *
 * NUNCA loguea api keys, Authorization, prompts, excerpts ni la respuesta cruda:
 * solo proveedor/modelo/base URL sanitizada/status/codigo/latencia.
 */
export async function callChatCompletion(
  provider: ResolvedAiProvider,
  body: Record<string, unknown>,
): Promise<ChatCompletionResult> {
  const url = buildChatCompletionsUrl(provider.baseUrl);
  const firstBody = applyThinkingPolicy(body, provider);

  const attempt = await sendOnce(provider, url, firstBody);

  // Fallback de formato (solo local + solo si el error es de response_format y la
  // peticion usaba json_schema). No relaja la validacion posterior.
  if (
    !attempt.ok &&
    provider.isLocal &&
    attempt.info?.isResponseFormat &&
    usesJsonSchema(firstBody)
  ) {
    const retryBody = applyThinkingPolicy(downgradeResponseFormat(body), provider);
    const retry = await sendOnce(provider, url, retryBody, true);
    return retry;
  }

  return attempt;
}

async function sendOnce(
  provider: ResolvedAiProvider,
  url: string,
  body: Record<string, unknown>,
  isRetry = false,
): Promise<ChatCompletionResult> {
  const startedAt = Date.now();
  const safeBase = sanitizeBaseUrl(provider.baseUrl);
  try {
    const resp = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
      }),
      provider.timeoutMs,
    );

    const elapsed = Date.now() - startedAt;

    if (!resp.ok) {
      let errBody: unknown = null;
      try {
        errBody = await resp.json();
      } catch {
        errBody = null;
      }
      const info = classifyAiProviderError(resp.status, errBody);
      console.error(
        `ai_provider error provider=${provider.provider} model=${provider.model} ` +
          `base=${safeBase} status=${info.provider_status} code=${info.provider_code ?? ''} ` +
          `retry=${isRetry} ms=${elapsed}`,
      );
      return { ok: false, content: null, usage: null, info };
    }

    let data: { choices?: { message?: { content?: string } }[]; usage?: unknown };
    try {
      data = (await resp.json()) as typeof data;
    } catch {
      console.error(
        `ai_provider invalid_json provider=${provider.provider} model=${provider.model} ` +
          `base=${safeBase} ms=${elapsed}`,
      );
      return {
        ok: false,
        content: null,
        usage: null,
        info: {
          codes: [AI_PROVIDER_ERROR.INVALID_JSON],
          provider_status: resp.status,
          provider_code: null,
          provider_type: null,
          isResponseFormat: false,
        },
      };
    }

    const rawContent = data.choices?.[0]?.message?.content ?? null;
    return {
      ok: true,
      content: stripThinkBlocks(rawContent),
      usage: data.usage ?? null,
    };
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const isTimeout = err instanceof Error && err.message === 'timeout';
    const code = isTimeout ? AI_PROVIDER_ERROR.TIMEOUT : AI_PROVIDER_ERROR.NETWORK;
    console.error(
      `ai_provider ${code} provider=${provider.provider} model=${provider.model} ` +
        `base=${safeBase} ms=${elapsed}`,
    );
    return {
      ok: false,
      content: null,
      usage: null,
      info: {
        codes: [code],
        provider_status: 0,
        provider_code: null,
        provider_type: null,
        isResponseFormat: false,
      },
    };
  }
}
