// Registro de una accion de revision humana sobre una pregunta (SPEC 006, 8).

import type { QuestionStatus } from './enums.js';

export const REVIEW_ACTIONS = [
  'approve',
  'reject',
  'mark_needs_fix',
  'mark_obsolete',
  'edit',
  'return_to_pending_review',
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export interface QuestionReview {
  id: string;
  question_id: string;
  action: ReviewAction;
  previous_status: QuestionStatus;
  new_status: QuestionStatus;
  /** Nombre del revisor. Opcional en el MVP (no hay usuarios todavia). */
  reviewer_name: string | null;
  notes: string | null;
  /** Informe de validacion (SPEC 005) usado para decidir, si aplica. */
  validation_result_id: string | null;
  created_at: Date;
}
