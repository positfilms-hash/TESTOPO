// Implementacion en memoria de respuestas de intento (SPEC 008).

import type { TestAnswer } from '../models/testAnswer.js';
import type { TestAnswerRepository } from './testAnswerRepository.js';

export class InMemoryTestAnswerRepository implements TestAnswerRepository {
  private readonly answers = new Map<string, TestAnswer>();

  async create(answer: TestAnswer): Promise<TestAnswer> {
    this.answers.set(key(answer.attempt_id, answer.test_question_id), clone(answer));
    return clone(answer);
  }

  async save(answer: TestAnswer): Promise<TestAnswer> {
    this.answers.set(key(answer.attempt_id, answer.test_question_id), clone(answer));
    return clone(answer);
  }

  async find(attemptId: string, testQuestionId: string): Promise<TestAnswer | null> {
    const answer = this.answers.get(key(attemptId, testQuestionId));
    return answer ? clone(answer) : null;
  }

  async findByAttempt(attemptId: string): Promise<TestAnswer[]> {
    return [...this.answers.values()]
      .filter((answer) => answer.attempt_id === attemptId)
      .map(clone);
  }

  async delete(attemptId: string, testQuestionId: string): Promise<boolean> {
    return this.answers.delete(key(attemptId, testQuestionId));
  }
}

function key(attemptId: string, testQuestionId: string): string {
  return `${attemptId}::${testQuestionId}`;
}

function clone(answer: TestAnswer): TestAnswer {
  return structuredClone(answer);
}
