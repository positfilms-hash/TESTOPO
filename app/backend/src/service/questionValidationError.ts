// Error que se lanza cuando se intenta validar una pregunta que incumple las
// reglas obligatorias. Transporta los codigos concretos para que la capa
// superior pueda mostrarlos al usuario o al revisor.

import type { ValidationErrorCode } from '../validation/errors.js';

export class QuestionValidationError extends Error {
  readonly errors: ValidationErrorCode[];

  constructor(errors: ValidationErrorCode[]) {
    super(`Question cannot be validated: ${errors.join(', ')}`);
    this.name = 'QuestionValidationError';
    this.errors = errors;
  }
}
