// Error de las operaciones de intento de test (SPEC 008).

import type { TestAttemptErrorCode } from './attemptErrors.js';

export class TestAttemptError extends Error {
  readonly codes: TestAttemptErrorCode[];

  constructor(codes: TestAttemptErrorCode[]) {
    super(`Test attempt operation failed: ${codes.join(', ')}`);
    this.name = 'TestAttemptError';
    this.codes = codes;
  }
}
