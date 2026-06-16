// Error que se lanza cuando una operacion sobre temas incumple las reglas
// (metadatos invalidos, jerarquia invalida, entidades inexistentes...).

import type { TopicValidationErrorCode } from '../validation/topicErrors.js';

export class TopicValidationError extends Error {
  readonly errors: TopicValidationErrorCode[];

  constructor(errors: TopicValidationErrorCode[]) {
    super(`Topic operation is not valid: ${errors.join(', ')}`);
    this.name = 'TopicValidationError';
    this.errors = errors;
  }
}
