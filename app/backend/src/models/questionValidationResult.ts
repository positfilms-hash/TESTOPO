// Informe estructurado de una validacion de pregunta (SPEC 005, seccion 9).

import type { Finding } from '../quality/qualityCodes.js';

export const VALIDATION_REPORT_STATUSES = [
  'passed',
  'failed',
  'passed_with_warnings',
] as const;
export type ValidationReportStatus =
  (typeof VALIDATION_REPORT_STATUSES)[number];

// El validador automatico nunca recomienda `validated` (SPEC 005, regla central).
export type RecommendedStatus = 'pending_review' | 'needs_fix';

export interface QuestionValidationResult {
  id: string;
  question_id: string;
  status: ValidationReportStatus;
  passed: boolean;
  errors: Finding[];
  warnings: Finding[];
  info: Finding[];
  validated_at: Date;
  validator_version: string;
  recommended_status: RecommendedStatus;
}
