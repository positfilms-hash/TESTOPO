// Validacion de los metadatos minimos de un tema (SPEC 003, 13): titulo y
// estado. La validacion de jerarquia (padre existente, no ser padre de si
// mismo, ausencia de ciclos) requiere acceso al repositorio y vive en el
// servicio.

import { isTopicStatus } from '../models/enums.js';
import { TopicValidationErrorCode } from './topicErrors.js';

export interface TopicValidationResult {
  valid: boolean;
  errors: TopicValidationErrorCode[];
}

export interface TopicMetadata {
  title: unknown;
  status: unknown;
}

export function validateTopicMetadata(
  topic: TopicMetadata,
): TopicValidationResult {
  const errors: TopicValidationErrorCode[] = [];

  if (!isNonEmptyString(topic.title)) {
    errors.push(TopicValidationErrorCode.TITLE_REQUIRED);
  }

  if (!isTopicStatus(topic.status)) {
    errors.push(TopicValidationErrorCode.INVALID_STATUS);
  }

  return { valid: errors.length === 0, errors };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
