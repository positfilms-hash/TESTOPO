// Error del generador de tests (SPEC 007). Transporta los codigos concretos.

import type { TestGenerationErrorCode } from './testErrors.js';

export class TestGenerationError extends Error {
  readonly codes: TestGenerationErrorCode[];

  constructor(codes: TestGenerationErrorCode[]) {
    super(`Test generation failed: ${codes.join(', ')}`);
    this.name = 'TestGenerationError';
    this.codes = codes;
  }
}
