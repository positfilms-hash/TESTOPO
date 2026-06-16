// Transiciones de estado permitidas en la revision (SPEC 006, 12).
// Las transiciones a `validated` solo se permiten desde `pending_review`.

import type { QuestionStatus } from '../models/enums.js';
import { QuestionReviewErrorCode } from './reviewErrors.js';

export const ALLOWED_TRANSITIONS: Record<QuestionStatus, QuestionStatus[]> = {
  draft: ['pending_review', 'needs_fix', 'rejected', 'obsolete'],
  pending_review: ['validated', 'needs_fix', 'rejected', 'obsolete'],
  needs_fix: ['pending_review', 'rejected', 'obsolete'],
  rejected: ['pending_review', 'obsolete'],
  validated: ['needs_fix', 'obsolete'],
  obsolete: ['needs_fix'],
};

export function isAllowedTransition(
  from: QuestionStatus,
  to: QuestionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// Devuelve el codigo de error apropiado para una transicion no permitida,
// distinguiendo los casos especiales hacia `validated` (SPEC 006, 10.5/10.6).
export function transitionErrorCode(
  from: QuestionStatus,
  to: QuestionStatus,
): QuestionReviewErrorCode {
  if (to === 'validated') {
    if (from === 'rejected') {
      return QuestionReviewErrorCode.REJECTED_REQUIRES_REVIEW_REOPEN;
    }
    if (from === 'obsolete') {
      return QuestionReviewErrorCode.OBSOLETE_CANNOT_BE_VALIDATED;
    }
  }
  return QuestionReviewErrorCode.INVALID_STATUS_TRANSITION;
}
