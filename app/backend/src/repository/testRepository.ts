// Contrato de persistencia de tests de practica (SPEC 007).

import type { PracticeTest } from '../models/practiceTest.js';

export interface TestRepository {
  create(test: PracticeTest): PracticeTest;
  findById(id: string): PracticeTest | null;
  save(test: PracticeTest): PracticeTest;
}
