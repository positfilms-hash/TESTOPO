// Proveedor de generacion real basado en la API de Claude (Anthropic).
//
// SPEC 018.4 (4, 8, 20): proveedor configurable que implementa la misma
// interfaz `QuestionGenerationProvider` que el mock. Llama a la Messages API
// por HTTP (fetch) con salida estructurada (JSON Schema) para obtener candidatos
// que despues valida y guarda el servicio. NO valida preguntas: solo propone.
//
// Reglas de la spec respetadas:
// - La clave nunca se hardcodea: se inyecta por configuracion (env AI_API_KEY).
// - El prompt usa solo el material aportado y el feedback previo como contexto.
// - El proveedor no marca ninguna pregunta como `validated`.

import type { Difficulty } from '../models/enums.js';
import { DIFFICULTIES } from '../models/enums.js';
import type {
  GeneratedCandidate,
  GenerationContext,
  QuestionGenerationProvider,
} from './generationTypes.js';

// Modelo por defecto: el Claude mas capaz disponible (SPEC: usar el modelo
// mas reciente salvo que se indique otro via AI_MODEL).
export const DEFAULT_AI_MODEL = 'claude-opus-4-8';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  /** Inyectable para tests; por defecto el `fetch` global. */
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

// Esquema JSON de la salida esperada (SPEC 018.4, 11). Sin restricciones no
// soportadas por la salida estructurada (minItems, etc.).
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          statement: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                text: { type: 'string' },
                is_correct: { type: 'boolean' },
              },
              required: ['text', 'is_correct'],
            },
          },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: [...DIFFICULTIES] },
          // Fuente exacta usada (SPEC 018.4, regla 5): fragmento + referencia.
          source_excerpt: { type: 'string' },
          source_reference: { type: 'string' },
        },
        required: [
          'statement',
          'options',
          'explanation',
          'difficulty',
          'source_excerpt',
          'source_reference',
        ],
      },
    },
  },
  required: ['questions'],
} as const;

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
    this.model = options.model ?? DEFAULT_AI_MODEL;
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
        system: buildSystemPrompt(),
        output_config: {
          format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
        },
        messages: [{ role: 'user', content: buildUserPrompt(context) }],
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
    return parseCandidates(text);
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

// Convierte la salida JSON en candidatos internos. Descarta lo que no encaje;
// el servicio aplica despues la validacion formal y de calidad.
function parseCandidates(text: string): GeneratedCandidate[] {
  if (!isNonEmptyString(text)) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('La IA devolvio una respuesta que no es JSON valido');
  }
  const questions = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) {
    return [];
  }
  const candidates: GeneratedCandidate[] = [];
  for (const raw of questions) {
    const candidate = toCandidate(raw);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

function toCandidate(raw: unknown): GeneratedCandidate | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const statement = obj.statement;
  const explanation = obj.explanation;
  const difficulty = obj.difficulty;
  const optionsRaw = obj.options;
  if (
    !isNonEmptyString(statement) ||
    !isNonEmptyString(explanation) ||
    !isDifficulty(difficulty) ||
    !Array.isArray(optionsRaw)
  ) {
    return null;
  }
  const options = optionsRaw
    .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null)
    .map((o) => ({ text: String(o.text ?? ''), is_correct: o.is_correct === true }));
  return {
    statement,
    options,
    explanation,
    difficulty,
    source_excerpt: isNonEmptyString(obj.source_excerpt) ? obj.source_excerpt : null,
    source_reference: isNonEmptyString(obj.source_reference)
      ? obj.source_reference
      : null,
  };
}

function buildSystemPrompt(): string {
  return [
    'Eres un generador de preguntas tipo test para oposiciones.',
    'Generas borradores, no preguntas validadas.',
    'Reglas obligatorias:',
    '1. Usa unicamente el material proporcionado.',
    '2. No inventes informacion externa.',
    '3. Cada pregunta debe tener una unica respuesta correcta.',
    '4. Cada pregunta debe incluir explicacion.',
    '5. No generes preguntas ambiguas ni de opinion.',
    '6. Para cada pregunta indica en source_excerpt el fragmento exacto del',
    '   material usado y en source_reference su referencia (articulo, apartado).',
    '7. No marques ninguna pregunta como validada.',
    '8. Si no hay suficiente material, devuelve menos preguntas.',
    'Devuelve unicamente el JSON solicitado.',
  ].join('\n');
}

function buildUserPrompt(context: GenerationContext): string {
  const parts: string[] = [];
  parts.push(`Genera ${context.count} preguntas de dificultad ${context.difficulty}.`);
  if (isNonEmptyString(context.topic_title)) {
    parts.push(`Tema: ${context.topic_title}.`);
  }
  const feedback = context.previous_feedback ?? [];
  if (feedback.length > 0) {
    parts.push(
      'En revisiones anteriores de este contexto se detectaron estos errores frecuentes; evitalos especialmente:',
    );
    for (const summary of feedback) {
      parts.push(
        `- ${summary.feedback_type} (severidad ${summary.severity}, ${summary.count} veces)`,
      );
    }
  }
  parts.push('Material:');
  parts.push(context.text);
  return parts.join('\n');
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}

function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
