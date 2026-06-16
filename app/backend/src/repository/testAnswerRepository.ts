// Contrato de persistencia de respuestas de un intento (SPEC 008).
// La unicidad es la pareja (attempt_id, test_question_id).

import type { TestAnswer } from '../models/testAnswer.js';

export interface TestAnswerRepository {
  create(answer: TestAnswer): TestAnswer;
  save(answer: TestAnswer): TestAnswer;
  find(attemptId: string, testQuestionId: string): TestAnswer | null;
  findByAttempt(attemptId: string): TestAnswer[];
  delete(attemptId: string, testQuestionId: string): boolean;
}
