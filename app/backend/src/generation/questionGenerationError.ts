// Error que se lanza cuando la generacion no puede iniciarse o producir
// resultados (material/tema invalidos, parametros invalidos, sin contenido...).

import type { QuestionGenerationErrorCode } from './generationErrors.js';

export class QuestionGenerationError extends Error {
  readonly errors: QuestionGenerationErrorCode[];

  constructor(errors: QuestionGenerationErrorCode[]) {
    super(`Question generation failed: ${errors.join(', ')}`);
    this.name = 'QuestionGenerationError';
    this.errors = errors;
  }
}
