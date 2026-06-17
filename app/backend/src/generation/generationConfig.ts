// Limites configurables de la generacion IA (SPEC 018.4, 19-20).
//
// Por defecto reproducen los valores de la spec; pueden sobreescribirse por
// variables de entorno (solo servidor). En el navegador no hay `process.env`,
// por lo que se usan los valores por defecto.

import { MAX_QUESTION_COUNT } from './generationErrors.js';

export const DEFAULT_MAX_GENERATION_INPUT_CHARS = 20000;
export const DEFAULT_MAX_GENERATED_QUESTIONS = MAX_QUESTION_COUNT;

export interface GenerationConfig {
  /** Maximo de caracteres del material/fragmento que se envia al proveedor. */
  max_input_chars: number;
  /** Maximo de preguntas por generacion. */
  max_question_count: number;
}

export type EnvLike = Record<string, string | undefined>;

function readProcessEnv(): EnvLike {
  // Guardado para el bundle del navegador, donde `process` no existe.
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvLike;
  }
  return {};
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadGenerationConfig(env: EnvLike = readProcessEnv()): GenerationConfig {
  return {
    max_input_chars: parsePositiveInt(
      env.MAX_GENERATION_INPUT_CHARS,
      DEFAULT_MAX_GENERATION_INPUT_CHARS,
    ),
    max_question_count: parsePositiveInt(
      env.MAX_GENERATED_QUESTIONS,
      DEFAULT_MAX_GENERATED_QUESTIONS,
    ),
  };
}
