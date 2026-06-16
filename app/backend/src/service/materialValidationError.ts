// Error que se lanza cuando se intenta crear o registrar material que incumple
// las reglas obligatorias. Transporta los codigos concretos para la capa
// superior.

import type { MaterialValidationErrorCode } from '../validation/materialErrors.js';

export class MaterialValidationError extends Error {
  readonly errors: MaterialValidationErrorCode[];

  constructor(errors: MaterialValidationErrorCode[]) {
    super(`Material is not valid: ${errors.join(', ')}`);
    this.name = 'MaterialValidationError';
    this.errors = errors;
  }
}
