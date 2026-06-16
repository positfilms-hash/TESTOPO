// Conjuntos de valores controlados del banco de preguntas (SPEC 001).
// Se exponen como arrays `as const` para poder validarlos en tiempo de
// ejecucion y derivar de ellos los tipos en tiempo de compilacion.

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_STATUSES = [
  'draft',
  'pending_review',
  'validated',
  'rejected',
  'needs_fix',
  'obsolete',
] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const SOURCE_TYPES = [
  'syllabus',
  'old_test',
  'official_exam',
  'law',
  'notes',
  'other',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_STATUSES = [
  'active',
  'deprecated',
  'obsolete',
  'needs_review',
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return QUESTION_STATUSES.includes(value as QuestionStatus);
}
