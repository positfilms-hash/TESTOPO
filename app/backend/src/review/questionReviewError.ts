// Error de una operacion de revision. Cuando bloquea una aprobacion, adjunta el
// informe de validacion (SPEC 005) para que la capa superior muestre el detalle.

import type { QuestionValidationResult } from '../models/questionValidationResult.js';
import type { QuestionReviewErrorCode } from './reviewErrors.js';

export class QuestionReviewError extends Error {
  readonly codes: QuestionReviewErrorCode[];
  readonly validation?: QuestionValidationResult;

  constructor(
    codes: QuestionReviewErrorCode[],
    validation?: QuestionValidationResult,
  ) {
    super(`Question review operation failed: ${codes.join(', ')}`);
    this.name = 'QuestionReviewError';
    this.codes = codes;
    this.validation = validation;
  }
}
