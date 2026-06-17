// Implementacion en memoria de intentos de test (SPEC 008).

import type { TestAttempt } from '../models/testAttempt.js';
import type { TestAttemptRepository } from './testAttemptRepository.js';

export class InMemoryTestAttemptRepository
  implements TestAttemptRepository
{
  private readonly attempts = new Map<string, TestAttempt>();

  async create(attempt: TestAttempt): Promise<TestAttempt> {
    this.attempts.set(attempt.id, clone(attempt));
    return clone(attempt);
  }

  async findById(id: string): Promise<TestAttempt | null> {
    const attempt = this.attempts.get(id);
    return attempt ? clone(attempt) : null;
  }

  async findByUser(userId: string): Promise<TestAttempt[]> {
    return [...this.attempts.values()]
      .filter((attempt) => attempt.user_id === userId)
      .map(clone);
  }

  async save(attempt: TestAttempt): Promise<TestAttempt> {
    if (!this.attempts.has(attempt.id)) {
      throw new Error(`Cannot save unknown attempt: ${attempt.id}`);
    }
    this.attempts.set(attempt.id, clone(attempt));
    return clone(attempt);
  }
}

function clone(attempt: TestAttempt): TestAttempt {
  return structuredClone(attempt);
}
