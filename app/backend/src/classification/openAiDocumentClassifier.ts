// Clasificador documental basado en OpenAI (SPEC 028-B, 14). Llama a Chat
// Completions por HTTP pidiendo JSON estructurado y lo mapea a la salida interna.
// SOLO clasifica: no genera indice ni preguntas. La clave nunca se hardcodea.

import {
  isDocumentClass,
  type DocumentClass,
} from '../models/documentClassification.js';
import type {
  DocumentClassificationProvider,
  DocumentClassificationProviderInput,
  DocumentClassificationProviderOutput,
} from './documentClassificationTypes.js';
import {
  DocumentClassificationError,
  DocumentClassificationErrorCode,
} from './documentClassificationErrors.js';

export const DEFAULT_CLASSIFIER_OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export interface OpenAiDocumentClassifierOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

export class OpenAiDocumentClassifier
  implements DocumentClassificationProvider
{
  readonly name = 'openai';
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxTokens: number;

  constructor(options: OpenAiDocumentClassifierOptions) {
    if (!isNonEmptyString(options.apiKey)) {
      throw new DocumentClassificationError([
        DocumentClassificationErrorCode.PROVIDER_NOT_CONFIGURED,
      ]);
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_CLASSIFIER_OPENAI_MODEL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxTokens = options.maxTokens ?? 1000;
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('No hay implementacion de fetch disponible');
    }
  }

  async classify(
    input: DocumentClassificationProviderInput,
  ): Promise<DocumentClassificationProviderOutput> {
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
      throw new DocumentClassificationError(
        [DocumentClassificationErrorCode.FAILED],
        `Fallo al llamar a OpenAI: ${String(error)}`,
      );
    }

    if (!response.ok) {
      throw new DocumentClassificationError(
        [DocumentClassificationErrorCode.FAILED],
        `Error de la API de OpenAI (${response.status})`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!isNonEmptyString(content)) {
      throw new DocumentClassificationError([
        DocumentClassificationErrorCode.INVALID_OUTPUT,
      ]);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new DocumentClassificationError([
        DocumentClassificationErrorCode.INVALID_OUTPUT,
      ]);
    }
    return mapOutput(parsed, this.name, this.model);
  }
}

function mapOutput(
  raw: unknown,
  provider: string,
  model: string | null,
): DocumentClassificationProviderOutput {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  const classification: DocumentClass = isDocumentClass(obj.classification)
    ? obj.classification
    : 'ambiguous';
  const confidence =
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 &&
    obj.confidence <= 1
      ? obj.confidence
      : 0.4;
  return {
    classification,
    confidence,
    reason: asString(obj.reason),
    detected_title: asString(obj.detected_title),
    detected_question_count:
      typeof obj.detected_question_count === 'number'
        ? obj.detected_question_count
        : null,
    warnings: asStringArray(obj.warnings),
    provider,
    model,
  };
}

function buildSystemPrompt(): string {
  // Reglas alineadas con prompts/document-classifier.md (SPEC 028-B, 13).
  return [
    'Eres un clasificador documental para una app de oposiciones.',
    'Clasifica el documento en UNA de estas clases:',
    'syllabus_material, old_exam_or_test, legal_text, notes_or_summary,',
    'index_or_table_of_contents, irrelevant, not_analyzable, ambiguous.',
    'Usa solo el texto, el nombre y la ruta. Distingue temario de tests.',
    'Si hay preguntas con opciones A/B/C/D -> old_exam_or_test.',
    'Si es una ley o norma -> legal_text. Si es solo indice/programa ->',
    'index_or_table_of_contents. Si no hay texto -> not_analyzable. Si dudas ->',
    'ambiguous. No generes preguntas, temario ni indice.',
    'Devuelve JSON con: classification, confidence (0..1), reason,',
    'detected_title, detected_question_count, warnings.',
  ].join('\n');
}

function buildUserPrompt(input: DocumentClassificationProviderInput): string {
  const parts: string[] = [];
  parts.push(`Nombre: ${input.filename}`);
  parts.push(`Ruta: ${input.original_path}`);
  if (input.upload_category) {
    parts.push(`Categoria de subida: ${input.upload_category}`);
  }
  parts.push('Texto extraido:');
  parts.push(input.text);
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
