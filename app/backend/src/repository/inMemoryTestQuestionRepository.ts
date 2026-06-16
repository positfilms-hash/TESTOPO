// Implementacion en memoria de las preguntas de test (SPEC 007).

import type { PracticeTestQuestion } from '../models/practiceTestQuestion.js';
import type { TestQuestionRepository } from './testQuestionRepository.js';

export class InMemoryTestQuestionRepository
  implements TestQuestionRepository
{
  private readonly testQuestions: PracticeTestQuestion[] = [];

  create(testQuestion: PracticeTestQuestion): PracticeTestQuestion {
    this.testQuestions.push(clone(testQuestion));
    return clone(testQuestion);
  }

  findByTest(testId: string): PracticeTestQuestion[] {
    return this.testQuestions
      .filter((item) => item.test_id === testId)
      .sort((a, b) => a.order - b.order)
      .map(clone);
  }
}

function clone(item: PracticeTestQuestion): PracticeTestQuestion {
  return structuredClone(item);
}
