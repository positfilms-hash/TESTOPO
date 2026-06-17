// Contrato del historial de revisiones (SPEC 006, 8).

import type { QuestionReview } from '../models/questionReview.js';

export interface QuestionReviewRepository {
  create(review: QuestionReview): Promise<QuestionReview>;
  findByQuestion(questionId: string): Promise<QuestionReview[]>;
  findAll(): Promise<QuestionReview[]>;
}
