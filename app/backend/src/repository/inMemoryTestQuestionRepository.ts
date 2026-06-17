// Implementacion en memoria de las preguntas de test (SPEC 007).

import type { PracticeTestQuestion } from '../models/practiceTestQuestion.js';
import type { TestQuestionRepository } from './testQuestionRepository.js';

export class InMemoryTestQuestionRepository
  implements TestQuestionRepository
{
  private readonly testQuestions: PracticeTestQuestion[] = [];

  async create(testQuestion: PracticeTestQuestion): Promise<PracticeTestQuestion> {
    this.testQuestions.push(clone(testQuestion));
    return clone(testQuestion);
  }

  async findByTest(testId: string): Promise<PracticeTestQuestion[]> {
    return this.testQuestions
      .filter((item) => item.test_id === testId)
      .sort((a, b) => a.order - b.order)
      .map(clone);
  }
}

function clone(item: PracticeTestQuestion): PracticeTestQuestion {
  return structuredClone(item);
}
