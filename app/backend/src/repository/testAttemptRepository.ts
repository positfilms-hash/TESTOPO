// Contrato de persistencia de intentos de test (SPEC 008).

import type { TestAttempt } from '../models/testAttempt.js';

export interface TestAttemptRepository {
  create(attempt: TestAttempt): TestAttempt;
  findById(id: string): TestAttempt | null;
  /** Intentos de un usuario (SPEC 013: "Mis resultados"). */
  findByUser(userId: string): TestAttempt[];
  save(attempt: TestAttempt): TestAttempt;
}
