// Validaciones puras de la generacion (SPEC 004, 9.9 y 12):
// - parametros de la solicitud (modo, dificultad, numero de preguntas);
// - formato de cada candidato antes de guardarlo.

import { DIFFICULTIES } from '../models/enums.js';
import {
  isGenerationMode,
  isRequestedDifficulty,
} from '../models/generationMetadata.js';
import type { Source } from '../models/source.js';
import type { GeneratedCandidate } from './generationTypes.js';
import type { GenerateQuestionsRequest } from './generationTypes.js';
import {
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  QuestionGenerationErrorCode,
} from './generationErrors.js';

// Valida los parametros de la solicitud (no el material ni el tema, que
// requieren acceso a repositorios y se comprueban en el servicio).
export function validateGenerationRequest(
  request: GenerateQuestionsRequest,
  maxCount: number = MAX_QUESTION_COUNT,
): QuestionGenerationErrorCode[] {
  const errors: QuestionGenerationErrorCode[] = [];

  if (!isGenerationMode(request.mode)) {
    errors.push(QuestionGenerationErrorCode.INVALID_MODE);
  }

  if (!isRequestedDifficulty(request.difficulty)) {
    errors.push(QuestionGenerationErrorCode.INVALID_DIFFICULTY);
  }

  const count = request.question_count;
  if (!Number.isInteger(count) || count < MIN_QUESTION_COUNT) {
    errors.push(QuestionGenerationErrorCode.INVALID_COUNT);
  } else if (count > maxCount) {
    errors.push(QuestionGenerationErrorCode.MAX_COUNT_EXCEEDED);
  }

  return errors;
}

// Validacion formal basica de un candidato antes de guardarlo (SPEC 004, 9.9).
export function validateGeneratedCandidate(
  candidate: GeneratedCandidate,
  source: Source | null,
): QuestionGenerationErrorCode[] {
  const errors: QuestionGenerationErrorCode[] = [];

  const options = candidate.options ?? [];
  const hasStructure =
    isNonEmptyString(candidate.statement) &&
    options.length >= 2 &&
    options.filter((option) => option.is_correct).length === 1 &&
    DIFFICULTIES.includes(candidate.difficulty);
  if (!hasStructure) {
    errors.push(QuestionGenerationErrorCode.INVALID_OUTPUT);
  }

  if (!isNonEmptyString(candidate.explanation)) {
    errors.push(QuestionGenerationErrorCode.EXPLANATION_REQUIRED);
  }

  if (!source || !isNonEmptyString(source.title)) {
    errors.push(QuestionGenerationErrorCode.SOURCE_REQUIRED);
  }

  return errors;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
