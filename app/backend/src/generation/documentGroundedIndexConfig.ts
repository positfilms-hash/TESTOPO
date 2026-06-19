// Limites del indice anclado a documentos (SPEC 028-D). Valores por defecto de la
// spec; sobreescribibles por entorno (solo servidor). Al truncar, el servicio
// prefiere documentos primarios de mayor confianza y emite warnings. Sin ranking
// por embeddings.

import type { EnvLike } from './generationConfig.js';

export const DEFAULT_MAX_INDEX_INPUT_CHARS = 80000;
export const DEFAULT_MAX_INDEX_SECTIONS = 200;
export const DEFAULT_MAX_INDEX_TOPICS = 100;
export const DEFAULT_MAX_INDEX_DEPTH = 4;

export interface DocumentGroundedIndexConfig {
  max_input_chars: number;
  max_sections: number;
  max_topics: number;
  max_depth: number;
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

export function loadDocumentGroundedIndexConfig(
  env: EnvLike = readProcessEnv(),
): DocumentGroundedIndexConfig {
  return {
    max_input_chars: parsePositiveInt(env.MAX_INDEX_INPUT_CHARS, DEFAULT_MAX_INDEX_INPUT_CHARS),
    max_sections: parsePositiveInt(env.MAX_INDEX_SECTIONS, DEFAULT_MAX_INDEX_SECTIONS),
    max_topics: parsePositiveInt(env.MAX_INDEX_TOPICS, DEFAULT_MAX_INDEX_TOPICS),
    max_depth: parsePositiveInt(env.MAX_INDEX_DEPTH, DEFAULT_MAX_INDEX_DEPTH),
  };
}
