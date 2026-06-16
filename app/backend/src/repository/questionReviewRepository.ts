// Contrato del historial de revisiones (SPEC 006, 8).

import type { QuestionReview } from '../models/questionReview.js';

export interface QuestionReviewRepository {
  create(review: QuestionReview): QuestionReview;
  findByQuestion(questionId: string): QuestionReview[];
  findAll(): QuestionReview[];
}
