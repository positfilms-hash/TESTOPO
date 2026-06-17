// Historial en memoria de revisiones (SPEC 006).

import type { QuestionReview } from '../models/questionReview.js';
import type { QuestionReviewRepository } from './questionReviewRepository.js';

export class InMemoryQuestionReviewRepository
  implements QuestionReviewRepository
{
  private readonly reviews: QuestionReview[] = [];

  async create(review: QuestionReview): Promise<QuestionReview> {
    this.reviews.push(clone(review));
    return clone(review);
  }

  async findByQuestion(questionId: string): Promise<QuestionReview[]> {
    return this.reviews
      .filter((review) => review.question_id === questionId)
      .map(clone);
  }

  async findAll(): Promise<QuestionReview[]> {
    return this.reviews.map(clone);
  }
}

function clone(review: QuestionReview): QuestionReview {
  return structuredClone(review);
}
