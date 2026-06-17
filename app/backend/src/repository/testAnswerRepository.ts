// Contrato de persistencia de respuestas de un intento (SPEC 008).
// La unicidad es la pareja (attempt_id, test_question_id).

import type { TestAnswer } from '../models/testAnswer.js';

export interface TestAnswerRepository {
  create(answer: TestAnswer): Promise<TestAnswer>;
  save(answer: TestAnswer): Promise<TestAnswer>;
  find(attemptId: string, testQuestionId: string): Promise<TestAnswer | null>;
  findByAttempt(attemptId: string): Promise<TestAnswer[]>;
  delete(attemptId: string, testQuestionId: string): Promise<boolean>;
}
