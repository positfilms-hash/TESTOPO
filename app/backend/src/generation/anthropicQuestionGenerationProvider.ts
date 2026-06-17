// Proveedor de generacion basado en la API de Claude (Anthropic).
//
// SPEC 018.4 / 018.4-B: proveedor ALTERNATIVO configurable que implementa la
// interfaz `QuestionGenerationProvider`. Llama a la Messages API por HTTP
// (fetch) con salida JSON estructurada (`output_config.format`). NO valida
// preguntas: solo propone candidatos que despues valida y guarda el servicio.
//
// EXPERIMENTAL: el formato `output_config.format` y el modelo por defecto no se
// han verificado contra la API real en este repo. OpenAI es el proveedor
// principal (SPEC 018.4-B); usa Anthropic solo tras validarlo con la API real.
//
// - La clave nunca se hardcodea: se inyecta por configuracion (env ANTHROPIC_API_KEY).
// - El prompt usa solo el material aportado y el feedback previo como contexto.

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

// Modelo por defecto: el Claude mas capaz disponible (configurable via env).
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  /** Inyectable para tests; por defecto el `fetch` global. */
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

export class AnthropicQuestionGenerationProvider
  implements QuestionGenerationProvider
{
  readonly version = 'anthropic-generator-1';
  readonly name = 'anthropic';
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions) {
    if (!isNonEmptyString(options.apiKey)) {
      throw new Error('AnthropicQuestionGenerationProvider requiere apiKey');
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxTokens = options.maxTokens ?? 8000;
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('No hay implementacion de fetch disponible');
    }
  }

  async generate(context: GenerationContext): Promise<GeneratedCandidate[]> {
    const response = await this.fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: buildGenerationSystemPrompt(),
        output_config: {
          format: { type: 'json_schema', schema: GENERATION_OUTPUT_SCHEMA },
        },
        messages: [
          { role: 'user', content: buildGenerationUserPrompt(context) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await safeText(response);
      throw new Error(
        `Error de la API de Claude (${response.status}): ${detail}`,
      );
    }

    const payload = (await response.json()) as AnthropicResponse;
    if (payload.stop_reason === 'refusal') {
      throw new Error('La IA rechazo la solicitud de generacion');
    }

    const text = extractText(payload);
    return parseGeneratedCandidates(text);
  }
}

interface AnthropicResponse {
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
}

function extractText(payload: AnthropicResponse): string {
  const block = (payload.content ?? []).find(
    (b) => b.type === 'text' && isNonEmptyString(b.text),
  );
  return block?.text ?? '';
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}
