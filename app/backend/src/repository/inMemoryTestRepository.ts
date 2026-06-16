// Implementacion en memoria del repositorio de tests (SPEC 007).

import type { PracticeTest } from '../models/practiceTest.js';
import type { TestRepository } from './testRepository.js';

export class InMemoryTestRepository implements TestRepository {
  private readonly tests = new Map<string, PracticeTest>();

  create(test: PracticeTest): PracticeTest {
    this.tests.set(test.id, clone(test));
    return clone(test);
  }

  findById(id: string): PracticeTest | null {
    const test = this.tests.get(id);
    return test ? clone(test) : null;
  }

  save(test: PracticeTest): PracticeTest {
    if (!this.tests.has(test.id)) {
      throw new Error(`Cannot save unknown test: ${test.id}`);
    }
    this.tests.set(test.id, clone(test));
    return clone(test);
  }
}

function clone(test: PracticeTest): PracticeTest {
  return structuredClone(test);
}
