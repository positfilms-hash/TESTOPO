// Metadatos de trazabilidad de una pregunta generada (SPEC 004, seccion 8).
// No deben contener claves privadas, tokens ni datos sensibles.

import type { Difficulty } from './enums.js';

export const GENERATION_MODES = [
  'from_material_text',
  'from_material_excerpt',
  'manual_seed',
] as const;
export type GenerationMode = (typeof GENERATION_MODES)[number];

// Dificultad solicitada al generador: las concretas de SPEC 001 mas `mixed`.
export const REQUESTED_DIFFICULTIES = [
  'easy',
  'medium',
  'hard',
  'mixed',
] as const;
export type RequestedDifficulty = (typeof REQUESTED_DIFFICULTIES)[number];

export interface GenerationMetadata {
  generator_version: string;
  generation_mode: GenerationMode;
  created_from_material_id: string | null;
  created_from_topic_id: string | null;
  requested_difficulty: RequestedDifficulty;
  requested_question_count: number;
  created_at: Date;
}

export function isGenerationMode(value: unknown): value is GenerationMode {
  return GENERATION_MODES.includes(value as GenerationMode);
}

export function isRequestedDifficulty(
  value: unknown,
): value is RequestedDifficulty {
  return REQUESTED_DIFFICULTIES.includes(value as RequestedDifficulty);
}

export type { Difficulty };
