// Contrato de persistencia de las preguntas incluidas en un test (SPEC 007).

import type { PracticeTestQuestion } from '../models/practiceTestQuestion.js';

export interface TestQuestionRepository {
  create(testQuestion: PracticeTestQuestion): Promise<PracticeTestQuestion>;
  findByTest(testId: string): Promise<PracticeTestQuestion[]>;
}
