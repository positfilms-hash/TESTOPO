// Proveedor de indice de temario basado en OpenAI (SPEC 019, usa la arquitectura
// de SPEC 018.4-B). Llama a la Chat Completions API por HTTP (fetch) pidiendo
// JSON (`response_format: json_object`) y lo mapea a la salida interna. NO crea
// temas ni genera preguntas: solo propone. La clave nunca se hardcodea.

import {
  type AISyllabusTopicNode,
  type AIExamPatternSummary,
  type SyllabusIndexOutput,
  type SyllabusIndexProvider,
  type SyllabusIndexProviderInput,
} from './syllabusIndexTypes.js';
import {
  SyllabusIndexError,
  SyllabusIndexErrorCode,
} from '../syllabus/syllabusIndexErrors.js';

export const DEFAULT_SYLLABUS_OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export interface OpenAiSyllabusProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

export class OpenAiSyllabusIndexProvider implements SyllabusIndexProvider {
  readonly name = 'openai';
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxTokens: number;

  constructor(options: OpenAiSyllabusProviderOptions) {
    if (!isNonEmptyString(options.apiKey)) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED,
      ]);
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_SYLLABUS_OPENAI_MODEL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxTokens = options.maxTokens ?? 8000;
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('No hay implementacion de fetch disponible');
    }
  }

  async proposeIndex(
    input: SyllabusIndexProviderInput,
  ): Promise<SyllabusIndexOutput> {
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
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(input) },
          ],
        }),
      });
    } catch (error) {
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.GENERATION_FAILED],
        `Fallo al llamar a OpenAI: ${String(error)}`,
      );
    }

    if (!response.ok) {
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.GENERATION_FAILED],
        `Error de la API de OpenAI (${response.status})`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!isNonEmptyString(content)) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.INVALID_OUTPUT]);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.INVALID_OUTPUT]);
    }
    return mapOutput(parsed, this.name, this.model);
  }
}

// Mapea la respuesta cruda a la salida interna; tolerante (el servicio valida).
function mapOutput(
  raw: unknown,
  provider: string,
  model: string | null,
): SyllabusIndexOutput {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    title: asString(obj.title) ?? '',
    summary: asString(obj.summary) ?? '',
    topics: Array.isArray(obj.topics) ? obj.topics.map(mapNode) : [],
    unclassified_material_ids: asStringArray(obj.unclassified_material_ids),
    exam_patterns: Array.isArray(obj.exam_patterns)
      ? obj.exam_patterns.map(mapExam)
      : [],
    warnings: asStringArray(obj.warnings),
    provider,
    model,
  };
}

function mapNode(raw: unknown): AISyllabusTopicNode {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    title: asString(obj.title) ?? '',
    description: asString(obj.description),
    code: asString(obj.code),
    order: typeof obj.order === 'number' ? obj.order : 0,
    confidence: typeof obj.confidence === 'number' ? obj.confidence : null,
    source_material_ids: asStringArray(obj.source_material_ids),
    source_references: asStringArray(obj.source_references),
    children: Array.isArray(obj.children) ? obj.children.map(mapNode) : [],
    warnings: asStringArray(obj.warnings),
  };
}

function mapExam(raw: unknown): AIExamPatternSummary {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    material_id: asString(obj.material_id) ?? '',
    detected_question_count:
      typeof obj.detected_question_count === 'number'
        ? obj.detected_question_count
        : null,
    detected_topics: asStringArray(obj.detected_topics),
    difficulty_notes: asString(obj.difficulty_notes),
    style_notes: asString(obj.style_notes),
    warnings: asStringArray(obj.warnings),
  };
}

function buildSystemPrompt(): string {
  return [
    'Eres un asistente especializado en organizar temarios de oposiciones.',
    'Analiza el material y propon un indice de temas y subtemas.',
    'Reglas: usa solo el material; no inventes temas sin base; diferencia temario',
    'de tests/examenes (usa los tests para estilo/cobertura, no para copiar',
    'preguntas); indica los materiales fuente de cada tema; marca dudas con',
    'warnings; no generes preguntas; no apruebes el indice automaticamente.',
    'Devuelve JSON con: title, summary, topics (arbol con title, description,',
    'code, order, confidence, source_material_ids, source_references, children,',
    'warnings), unclassified_material_ids, exam_patterns, warnings.',
  ].join('\n');
}

function buildUserPrompt(input: SyllabusIndexProviderInput): string {
  const parts: string[] = [];
  if (isNonEmptyString(input.opposition_title)) {
    parts.push(`Oposicion: ${input.opposition_title}.`);
  }
  parts.push(`Maximo de temas: ${input.max_topics}.`);
  parts.push('Materiales (id | tipo | titulo):');
  for (const m of input.materials) {
    parts.push(`--- id=${m.id} | ${m.type} | ${m.title}`);
    parts.push(m.text);
  }
  return parts.join('\n');
}

function asString(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => isNonEmptyString(v));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
