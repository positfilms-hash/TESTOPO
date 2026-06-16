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

// El material (SPEC 002) comparte la misma taxonomia de tipos y estados que la
// fuente de una pregunta (SPEC 001). Se reutilizan los mismos conjuntos para
// evitar duplicar valores que deben mantenerse sincronizados.
export const MATERIAL_TYPES = SOURCE_TYPES;
export type MaterialType = SourceType;

export const MATERIAL_STATUSES = SOURCE_STATUSES;
export type MaterialStatus = SourceStatus;

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return QUESTION_STATUSES.includes(value as QuestionStatus);
}

export function isMaterialType(value: unknown): value is MaterialType {
  return MATERIAL_TYPES.includes(value as MaterialType);
}

export function isMaterialStatus(value: unknown): value is MaterialStatus {
  return MATERIAL_STATUSES.includes(value as MaterialStatus);
}

// Estados de un tema del temario (SPEC 003). Se define como conjunto propio
// aunque hoy comparta valores con el material: tema y material son conceptos
// distintos y sus estados podrian divergir en el futuro.
export const TOPIC_STATUSES = [
  'active',
  'needs_review',
  'deprecated',
  'obsolete',
] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export function isTopicStatus(value: unknown): value is TopicStatus {
  return TOPIC_STATUSES.includes(value as TopicStatus);
}
