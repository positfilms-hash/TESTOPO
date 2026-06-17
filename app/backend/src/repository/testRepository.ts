// Contrato de persistencia de tests de practica (SPEC 007).

import type { PracticeTest } from '../models/practiceTest.js';

export interface TestRepository {
  create(test: PracticeTest): Promise<PracticeTest>;
  findById(id: string): Promise<PracticeTest | null>;
  save(test: PracticeTest): Promise<PracticeTest>;
}
