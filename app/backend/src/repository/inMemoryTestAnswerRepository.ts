// Implementacion en memoria de respuestas de intento (SPEC 008).

import type { TestAnswer } from '../models/testAnswer.js';
import type { TestAnswerRepository } from './testAnswerRepository.js';

export class InMemoryTestAnswerRepository implements TestAnswerRepository {
  private readonly answers = new Map<string, TestAnswer>();

  create(answer: TestAnswer): TestAnswer {
    this.answers.set(key(answer.attempt_id, answer.test_question_id), clone(answer));
    return clone(answer);
  }

  save(answer: TestAnswer): TestAnswer {
    this.answers.set(key(answer.attempt_id, answer.test_question_id), clone(answer));
    return clone(answer);
  }

  find(attemptId: string, testQuestionId: string): TestAnswer | null {
    const answer = this.answers.get(key(attemptId, testQuestionId));
    return answer ? clone(answer) : null;
  }

  findByAttempt(attemptId: string): TestAnswer[] {
    return [...this.answers.values()]
      .filter((answer) => answer.attempt_id === attemptId)
      .map(clone);
  }

  delete(attemptId: string, testQuestionId: string): boolean {
    return this.answers.delete(key(attemptId, testQuestionId));
  }
}

function key(attemptId: string, testQuestionId: string): string {
  return `${attemptId}::${testQuestionId}`;
}

function clone(answer: TestAnswer): TestAnswer {
  return structuredClone(answer);
}
