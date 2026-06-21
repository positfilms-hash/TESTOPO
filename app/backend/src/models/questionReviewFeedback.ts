// Feedback de revision humana sobre una pregunta (SPEC 018.4, 12-14).
//
// Es aditivo al registro de revision (SPEC 006, `QuestionReview`): mientras
// `QuestionReview` guarda la accion y la transicion de estado, este modelo
// captura el MOTIVO estructurado del rechazo/correccion para poder aprender de
// el (resumen de feedback que alimenta futuras generaciones IA).

// Tipos de motivo de feedback (SPEC 018.4, 13). Los valores de cadena son
// contractuales: se usan como clave de agrupacion en el resumen.
export const FEEDBACK_TYPES = [
  'ambiguous_statement',
  'multiple_correct_answers',
  'wrong_correct_answer',
  'weak_explanation',
  'missing_source',
  'bad_source_excerpt',
  'too_easy',
  'too_hard',
  'duplicated_question',
  'off_topic',
  'invented_content',
  'bad_options',
  'unclear_wording',
  'needs_legal_precision',
  // SPEC 028-F: motivos para el aprendizaje adaptativo (estilo/cobertura/copia).
  'style_mismatch',
  'difficulty_mismatch',
  'coverage_mismatch',
  'source_mismatch',
  'copying_risk',
  'other',
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

// Severidad del feedback (SPEC 018.4, 14).
export const FEEDBACK_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

// Orden de severidad (mayor = mas grave). Se usa para resumir el feedback
// quedandose con la severidad mas alta observada por tipo.
export const SEVERITY_RANK: Record<FeedbackSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// Severidad por defecto de cada tipo (SPEC 018.4, 14, ejemplos). Se aplica
// cuando quien registra el feedback no indica una severidad explicita.
export const DEFAULT_FEEDBACK_SEVERITY: Record<FeedbackType, FeedbackSeverity> = {
  ambiguous_statement: 'high',
  multiple_correct_answers: 'critical',
  wrong_correct_answer: 'critical',
  weak_explanation: 'medium',
  missing_source: 'critical',
  bad_source_excerpt: 'medium',
  too_easy: 'low',
  too_hard: 'low',
  duplicated_question: 'high',
  off_topic: 'high',
  invented_content: 'critical',
  bad_options: 'high',
  unclear_wording: 'medium',
  needs_legal_precision: 'high',
  style_mismatch: 'low',
  difficulty_mismatch: 'low',
  coverage_mismatch: 'medium',
  source_mismatch: 'critical',
  copying_risk: 'critical',
  other: 'low',
};

export interface QuestionReviewFeedback {
  id: string;
  question_id: string;
  /** Revision (SPEC 006) que origino el feedback, si aplica. */
  review_id: string | null;
  feedback_type: FeedbackType;
  severity: FeedbackSeverity;
  comment: string | null;
  /** Autor del feedback (usuario revisor). Opcional en el MVP. */
  created_by: string | null;
  created_at: Date;
}

// Resumen agregado de feedback para alimentar una generacion (SPEC 018.4, 16).
// Se mantiene en snake_case por coherencia con el resto del dominio.
export interface QuestionGenerationFeedbackSummary {
  feedback_type: FeedbackType;
  count: number;
  /** Severidad mas alta observada para ese tipo. */
  severity: FeedbackSeverity;
  example_comments?: string[];
}

export function isFeedbackType(value: unknown): value is FeedbackType {
  return FEEDBACK_TYPES.includes(value as FeedbackType);
}

export function isFeedbackSeverity(value: unknown): value is FeedbackSeverity {
  return FEEDBACK_SEVERITIES.includes(value as FeedbackSeverity);
}

// Severidad efectiva: la indicada o, en su defecto, la del catalogo por tipo.
export function resolveFeedbackSeverity(
  feedbackType: FeedbackType,
  severity?: FeedbackSeverity | null,
): FeedbackSeverity {
  return severity ?? DEFAULT_FEEDBACK_SEVERITY[feedbackType];
}
