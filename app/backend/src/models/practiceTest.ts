// Test de practica generado desde el banco de preguntas validadas (SPEC 007).

import type { RequestedDifficulty } from './generationMetadata.js';

export const TEST_MODES = [
  'random',
  'by_topic',
  'by_difficulty',
  'mixed',
] as const;
export type TestMode = (typeof TEST_MODES)[number];

export const TEST_STATUSES = [
  'created',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

// La dificultad solicitada para un test admite `mixed` (igual que la
// generacion); se reutiliza el tipo para no duplicar la taxonomia.
export type TestDifficulty = RequestedDifficulty;

export interface TestFilters {
  topic_id: string | null;
  difficulty: TestDifficulty | null;
  question_count: number;
  random_seed: number | null;
}

export interface PracticeTest {
  id: string;
  title: string;
  mode: TestMode;
  status: TestStatus;
  question_count: number;
  filters: TestFilters;
  created_at: Date;
  updated_at: Date;
}

export function isTestMode(value: unknown): value is TestMode {
  return TEST_MODES.includes(value as TestMode);
}
