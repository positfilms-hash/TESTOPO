// Proveedor de generacion basado en la API de OpenAI (proveedor PRINCIPAL,
// SPEC 018.4-B).
//
// Implementa `QuestionGenerationProvider` y llama a la Chat Completions API por
// HTTP (fetch) con salida estructurada estricta (`response_format` json_schema).
// NO valida preguntas ni las guarda: devuelve candidatos al servicio de
// generacion, que aplica la validacion interna y la revision humana.
//
// - La clave nunca se hardcodea: se inyecta por configuracion (env OPENAI_API_KEY).
// - El modelo es configurable (OPENAI_MODEL); el valor por defecto no bloquea.
// - El dominio depende solo de la interfaz, no de OpenAI directamente.

import type {
  GeneratedCandidate,
  GenerationContext,
  QuestionGenerationProvider,
} from './generationTypes.js';
import {
  GENERATION_OUTPUT_SCHEMA,
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
  parseGeneratedCandidates,
  isNonEmptyString,
} from './aiGenerationShared.js';
import { AiProviderError, AiProviderErrorCode } from './aiProviderErrors.js';

// Modelo por defecto recomendado (configurable via OPENAI_MODEL). Compatible
// con salida estructurada estricta.
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export interface OpenAiProviderOptions {
  apiKey: string;
  model?: string;
  /** Inyectable para tests; por defecto el `fetch` global. */
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

export class OpenAiQuestionGenerationProvider
  implements QuestionGenerationProvider
{
  readonly version = 'openai-generator-1';
  readonly name = 'openai';
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxTokens: number;

  constructor(options: OpenAiProviderOptions) {
    if (!isNonEmptyString(options.apiKey)) {
      throw new AiProviderError(AiProviderErrorCode.OPENAI_API_KEY_MISSING);
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_OPENAI_MODEL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxTokens = options.maxTokens ?? 8000;
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('No hay implementacion de fetch disponible');
    }
  }

  async generate(context: GenerationContext): Promise<GeneratedCandidate[]> {
    let response: Response;
    try {
      response = await this.fetchImpl(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_completion_tokens: this.maxTokens,
          messages: [
            { role: 'system', content: buildGenerationSystemPrompt() },
            { role: 'user', content: buildGenerationUserPrompt(context) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'testopo_questions',
              strict: true,
              schema: GENERATION_OUTPUT_SCHEMA,
            },
          },
        }),
      });
    } catch (error) {
      throw new AiProviderError(
        AiProviderErrorCode.OPENAI_GENERATION_FAILED,
        `Fallo al llamar a OpenAI: ${String(error)}`,
      );
    }

    if (!response.ok) {
      const detail = await safeText(response);
      throw new AiProviderError(
        AiProviderErrorCode.OPENAI_GENERATION_FAILED,
        `Error de la API de OpenAI (${response.status}): ${detail}`,
      );
    }

    const payload = (await response.json()) as OpenAiResponse;
    const message = payload.choices?.[0]?.message;
    if (message && isNonEmptyString(message.refusal)) {
      throw new AiProviderError(
        AiProviderErrorCode.OPENAI_GENERATION_FAILED,
        'OpenAI rechazo la solicitud de generacion',
      );
    }
    const content = message?.content;
    if (!isNonEmptyString(content)) {
      throw new AiProviderError(AiProviderErrorCode.OPENAI_EMPTY_RESPONSE);
    }

    try {
      return parseGeneratedCandidates(content);
    } catch {
      throw new AiProviderError(AiProviderErrorCode.OPENAI_INVALID_RESPONSE);
    }
  }
}

interface OpenAiResponse {
  choices?: Array<{
    message?: { content?: string; refusal?: string | null };
    finish_reason?: string;
  }>;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}
