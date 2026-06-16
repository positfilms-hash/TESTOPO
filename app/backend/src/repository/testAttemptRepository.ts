// Contrato de persistencia de intentos de test (SPEC 008).

import type { TestAttempt } from '../models/testAttempt.js';

export interface TestAttemptRepository {
  create(attempt: TestAttempt): TestAttempt;
  findById(id: string): TestAttempt | null;
  save(attempt: TestAttempt): TestAttempt;
}
