// Configuracion de la segmentacion de material (SPEC 028-C, 16). Tamanos de chunk
// por defecto segun la spec; sobreescribibles por entorno (solo servidor).

import type { EnvLike } from '../generation/generationConfig.js';

export const DEFAULT_MAX_CHUNK_CHARS = 3000;
export const DEFAULT_MIN_CHUNK_CHARS = 1500;
export const DEFAULT_CHUNK_OVERLAP_CHARS = 300;
// Maximo de preguntas por bloque para tests antiguos (SPEC 028-C, 17).
export const DEFAULT_QUESTIONS_PER_BLOCK = 10;

export interface SegmentConfig {
  max_chunk_chars: number;
  min_chunk_chars: number;
  overlap_chars: number;
  questions_per_block: number;
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

export function loadSegmentConfig(env: EnvLike = readProcessEnv()): SegmentConfig {
  return {
    max_chunk_chars: parsePositiveInt(env.MAX_SECTION_CHUNK_CHARS, DEFAULT_MAX_CHUNK_CHARS),
    min_chunk_chars: parsePositiveInt(env.MIN_SECTION_CHUNK_CHARS, DEFAULT_MIN_CHUNK_CHARS),
    overlap_chars: parsePositiveInt(env.SECTION_CHUNK_OVERLAP_CHARS, DEFAULT_CHUNK_OVERLAP_CHARS),
    questions_per_block: parsePositiveInt(
      env.QUESTIONS_PER_SECTION_BLOCK,
      DEFAULT_QUESTIONS_PER_BLOCK,
    ),
  };
}
