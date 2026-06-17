// Implementacion en memoria del feedback de revision (SPEC 018.4).

import type { QuestionReviewFeedback } from '../models/questionReviewFeedback.js';
import type { QuestionReviewFeedbackRepository } from './questionReviewFeedbackRepository.js';

export class InMemoryQuestionReviewFeedbackRepository
  implements QuestionReviewFeedbackRepository
{
  private readonly items = new Map<string, QuestionReviewFeedback>();

  async create(
    feedback: QuestionReviewFeedback,
  ): Promise<QuestionReviewFeedback> {
    this.items.set(feedback.id, clone(feedback));
    return clone(feedback);
  }

  async findByQuestion(questionId: string): Promise<QuestionReviewFeedback[]> {
    return [...this.items.values()]
      .filter((item) => item.question_id === questionId)
      .map(clone);
  }

  async findAll(): Promise<QuestionReviewFeedback[]> {
    return [...this.items.values()].map(clone);
  }
}

function clone(feedback: QuestionReviewFeedback): QuestionReviewFeedback {
  return structuredClone(feedback);
}
