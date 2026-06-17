// Implementacion en memoria del repositorio de tests (SPEC 007).

import type { PracticeTest } from '../models/practiceTest.js';
import type { TestRepository } from './testRepository.js';

export class InMemoryTestRepository implements TestRepository {
  private readonly tests = new Map<string, PracticeTest>();

  async create(test: PracticeTest): Promise<PracticeTest> {
    this.tests.set(test.id, clone(test));
    return clone(test);
  }

  async findById(id: string): Promise<PracticeTest | null> {
    const test = this.tests.get(id);
    return test ? clone(test) : null;
  }

  async save(test: PracticeTest): Promise<PracticeTest> {
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
