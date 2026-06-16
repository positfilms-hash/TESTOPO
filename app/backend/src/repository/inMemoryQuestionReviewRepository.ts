// Historial en memoria de revisiones (SPEC 006).

import type { QuestionReview } from '../models/questionReview.js';
import type { QuestionReviewRepository } from './questionReviewRepository.js';

export class InMemoryQuestionReviewRepository
  implements QuestionReviewRepository
{
  private readonly reviews: QuestionReview[] = [];

  create(review: QuestionReview): QuestionReview {
    this.reviews.push(clone(review));
    return clone(review);
  }

  findByQuestion(questionId: string): QuestionReview[] {
    return this.reviews
      .filter((review) => review.question_id === questionId)
      .map(clone);
  }

  findAll(): QuestionReview[] {
    return this.reviews.map(clone);
  }
}

function clone(review: QuestionReview): QuestionReview {
  return structuredClone(review);
}
