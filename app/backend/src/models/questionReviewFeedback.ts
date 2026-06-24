// Feedback de revision humana sobre una pregunta (SPEC 018.4, 12-14; SPEC 040).
//
// FUENTE UNICA DE VERDAD del catalogo de tipos/severidades: el contrato compartido
// `supabase/functions/_shared/reliability/contract.ts`. Este modulo lo RE-EXPORTA
// con los nombres historicos del dominio para que UI, QuestionReviewService,
// repositorios y memoria usen EXACTAMENTE el mismo catalogo (no hay un catalogo
// legacy paralelo). `QuestionReview` guarda la accion; este modelo el MOTIVO
// estructurado (tipo + severidad) que alimenta la memoria de errores.

import {
  RELIABILITY_FEEDBACK_TYPES,
  RELIABILITY_SEVERITIES,
  SEVERITY_RANK as RELIABILITY_SEVERITY_RANK,
  DEFAULT_FEEDBACK_SEVERITY as RELIABILITY_DEFAULT_SEVERITY,
  isReliabilityFeedbackType,
  isReliabilitySeverity,
  resolveSeverity,
  type ReliabilityFeedbackType,
  type ReliabilitySeverity,
} from '../../../../supabase/functions/_shared/reliability/contract';

// Catalogo canonico (re-exportado del contrato compartido).
export const FEEDBACK_TYPES = RELIABILITY_FEEDBACK_TYPES;
export type FeedbackType = ReliabilityFeedbackType;

export const FEEDBACK_SEVERITIES = RELIABILITY_SEVERITIES;
export type FeedbackSeverity = ReliabilitySeverity;

export const SEVERITY_RANK: Record<FeedbackSeverity, number> = RELIABILITY_SEVERITY_RANK;
export const DEFAULT_FEEDBACK_SEVERITY: Record<FeedbackType, FeedbackSeverity> =
  RELIABILITY_DEFAULT_SEVERITY;

export interface QuestionReviewFeedback {
  id: string;
  question_id: string;
  /** Revision (SPEC 006) que origino el feedback, si aplica. */
  review_id: string | null;
  /** Scope obligatorio para el aislamiento workspace/oposicion (SPEC 040). */
  workspace_id: string | null;
  opposition_id: string | null;
  feedback_type: FeedbackType;
  severity: FeedbackSeverity;
  comment: string | null;
  /** Run de generacion que produjo la candidata (trazabilidad, SPEC 040). */
  generation_run_id: string | null;
  /** Correccion sugerida por el revisor (opcional, SPEC 040). */
  suggested_fix: string | null;
  /** Tipo de problema de fuente (opcional, SPEC 040). */
  source_issue: string | null;
  /** Autor del feedback (usuario revisor). Opcional en el MVP. */
  created_by: string | null;
  created_at: Date;
}

// Resumen agregado de feedback para alimentar una generacion (SPEC 018.4, 16).
export interface QuestionGenerationFeedbackSummary {
  feedback_type: FeedbackType;
  count: number;
  /** Severidad mas alta observada para ese tipo. */
  severity: FeedbackSeverity;
  example_comments?: string[];
}

export function isFeedbackType(value: unknown): value is FeedbackType {
  return isReliabilityFeedbackType(value);
}

export function isFeedbackSeverity(value: unknown): value is FeedbackSeverity {
  return isReliabilitySeverity(value);
}

// Severidad efectiva: la indicada o, en su defecto, la del catalogo por tipo.
export function resolveFeedbackSeverity(
  feedbackType: FeedbackType,
  severity?: FeedbackSeverity | null,
): FeedbackSeverity {
  return resolveSeverity(feedbackType, severity ?? undefined);
}
