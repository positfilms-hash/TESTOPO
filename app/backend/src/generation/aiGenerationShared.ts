// Utilidades compartidas por los proveedores de IA reales (OpenAI, Anthropic).
//
// Centraliza el esquema de salida estructurada, el prompt de generacion y el
// parseo/mapeo al candidato interno (SPEC 018.4 / 018.4-B). Asi el dominio no
// depende de ningun proveedor concreto y ambos producen el mismo candidato.

import type { Difficulty } from '../models/enums.js';
import { DIFFICULTIES } from '../models/enums.js';
import type {
  GeneratedCandidate,
  GenerationContext,
} from './generationTypes.js';

// Esquema JSON de la salida esperada (SPEC 018.4, 11; 018.4-B, 12). Compatible
// con salida estructurada estricta: `additionalProperties: false` y todas las
// propiedades en `required`.
export const GENERATION_OUTPUT_SCHEMA = {
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

// Prompt de sistema comun. Reglas obligatorias de la spec (no validar, usar solo
// el material, fuente exacta, etc.).
export function buildGenerationSystemPrompt(): string {
  return [
    'Eres un generador de preguntas tipo test para oposiciones.',
    'Generas borradores, no preguntas validadas.',
    'Reglas obligatorias:',
    '1. Usa unicamente el material proporcionado.',
    '2. No inventes informacion externa.',
    '3. Cada pregunta debe tener una unica respuesta correcta.',
    '4. Cada pregunta debe incluir explicacion.',
    '5. Indica en source_excerpt el fragmento exacto del material usado y en',
    '   source_reference su referencia (articulo, apartado).',
    '6. No generes preguntas ambiguas ni de opinion.',
    '7. No generes preguntas sin base textual.',
    '8. No marques ninguna pregunta como validada.',
    '9. Si no hay suficiente material, devuelve menos preguntas.',
    'Devuelve unicamente datos compatibles con el schema esperado por TESTOPO.',
  ].join('\n');
}

// Prompt de usuario: parametros + feedback previo + material.
export function buildGenerationUserPrompt(context: GenerationContext): string {
  const parts: string[] = [];
  parts.push(
    `Genera ${context.count} preguntas de dificultad ${context.difficulty}.`,
  );
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

// Parsea el JSON de salida y lo mapea a candidatos internos. Descarta entradas
// que no encajen; el servicio aplica despues la validacion formal y de calidad.
// Lanza `Error` si el texto no es JSON valido (cada proveedor lo traduce a su
// codigo de error).
export function parseGeneratedCandidates(text: string): GeneratedCandidate[] {
  if (!isNonEmptyString(text)) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('La respuesta de IA no es JSON valido');
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

function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
