// Validacion de las reglas obligatorias para que una pregunta pueda pasar a
// `validated` (SPEC 001, secciones 7 y 8).
//
// Esta funcion es pura y no depende de ninguna capa de transporte ni de
// persistencia, de modo que pueda reutilizarse en el panel de administracion,
// el generador de preguntas con IA, el generador de tests y los reportes.

import { DIFFICULTIES } from '../models/enums.js';
import { isQuestionStatus } from '../models/enums.js';
import type { Option } from '../models/option.js';
import type { Question } from '../models/question.js';
import { ValidationErrorCode } from './errors.js';
import { normalizeOptionText } from './normalizeOptionText.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorCode[];
}

export function validateQuestion(question: Question): ValidationResult {
  const errors: ValidationErrorCode[] = [];

  if (!isNonEmptyString(question.statement)) {
    errors.push(ValidationErrorCode.STATEMENT_REQUIRED);
  }

  const options = question.options ?? [];
  if (options.length === 0) {
    errors.push(ValidationErrorCode.OPTIONS_REQUIRED);
  } else if (options.length < 2) {
    errors.push(ValidationErrorCode.MIN_OPTIONS_NOT_MET);
  }

  if (options.length > 0) {
    const correctCount = options.filter((option) => option.is_correct).length;
    if (correctCount !== 1) {
      errors.push(ValidationErrorCode.SINGLE_CORRECT_OPTION_REQUIRED);
    }
    if (hasDuplicateOptions(options)) {
      errors.push(ValidationErrorCode.DUPLICATE_OPTIONS);
    }
  }

  if (!isNonEmptyString(question.explanation)) {
    errors.push(ValidationErrorCode.EXPLANATION_REQUIRED);
  }

  if (!question.source) {
    errors.push(ValidationErrorCode.SOURCE_REQUIRED);
  } else if (question.source.status === 'obsolete') {
    errors.push(ValidationErrorCode.SOURCE_OBSOLETE);
  }

  if (!isNonEmptyString(question.topic)) {
    errors.push(ValidationErrorCode.TOPIC_REQUIRED);
  }

  if (question.difficulty === null || question.difficulty === undefined) {
    errors.push(ValidationErrorCode.DIFFICULTY_REQUIRED);
  } else if (!DIFFICULTIES.includes(question.difficulty)) {
    errors.push(ValidationErrorCode.INVALID_DIFFICULTY);
  }

  if (!isQuestionStatus(question.status)) {
    errors.push(ValidationErrorCode.INVALID_STATUS);
  }

  if (question.status === 'obsolete') {
    errors.push(ValidationErrorCode.OBSOLETE_CANNOT_BE_VALIDATED);
  }

  return { valid: errors.length === 0, errors };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDuplicateOptions(options: Option[]): boolean {
  const seen = new Set<string>();
  for (const option of options) {
    const key = normalizeOptionText(option.text);
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}
