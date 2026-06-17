// Limites configurables del indice de temario IA (SPEC 019, 24-25).

import type { EnvLike } from './generationConfig.js';

export const DEFAULT_MAX_SYLLABUS_INDEX_INPUT_CHARS = 50000;
export const DEFAULT_MAX_SYLLABUS_TOPICS = 100;
export const MAX_SYLLABUS_TREE_DEPTH = 4;

export interface SyllabusIndexConfig {
  /** Maximo de caracteres de material enviados al proveedor. */
  max_input_chars: number;
  /** Maximo de temas (nodos) propuestos. */
  max_topics: number;
}

function readProcessEnv(): EnvLike {
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

export function loadSyllabusIndexConfig(
  env: EnvLike = readProcessEnv(),
): SyllabusIndexConfig {
  return {
    max_input_chars: parsePositiveInt(
      env.MAX_SYLLABUS_INDEX_INPUT_CHARS,
      DEFAULT_MAX_SYLLABUS_INDEX_INPUT_CHARS,
    ),
    max_topics: parsePositiveInt(
      env.MAX_SYLLABUS_TOPICS,
      DEFAULT_MAX_SYLLABUS_TOPICS,
    ),
  };
}
