// Contrato de persistencia del feedback de revision (SPEC 018.4, 12).

import type { QuestionReviewFeedback } from '../models/questionReviewFeedback.js';

export interface QuestionReviewFeedbackRepository {
  create(feedback: QuestionReviewFeedback): Promise<QuestionReviewFeedback>;
  findByQuestion(questionId: string): Promise<QuestionReviewFeedback[]>;
  findAll(): Promise<QuestionReviewFeedback[]>;
}
