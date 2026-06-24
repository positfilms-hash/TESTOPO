// Metricas basicas de fiabilidad por workspace/oposicion (SPEC 040).
//
// Calculadas BAJO DEMANDA desde datos REALES (preguntas, revisiones y feedback);
// no es un dashboard. La aritmetica vive en el contrato compartido
// (`computeReliabilityMetrics`) para ser una unica fuente de verdad. Aislada por
// oposicion: solo agrega datos de esa oposicion.

import type { QuestionService } from './questionService.js';
import type { QuestionReviewRepository } from '../repository/questionReviewRepository.js';
import type { QuestionReviewFeedbackRepository } from '../repository/questionReviewFeedbackRepository.js';
import {
  computeReliabilityMetrics,
  type ReliabilityMetrics,
} from '../../../../supabase/functions/_shared/reliability/contract';

// Acciones de revision que marcan una decision TERMINAL (para el tiempo de revision).
const TERMINAL_ACTIONS = new Set(['approve', 'reject']);

export interface ReliabilityMetricsServiceDeps {
  questionService: QuestionService;
  reviewRepository: QuestionReviewRepository;
  feedbackRepository: QuestionReviewFeedbackRepository;
}

export class ReliabilityMetricsService {
  constructor(private readonly deps: ReliabilityMetricsServiceDeps) {}

  // Metricas reales de una oposicion. Cuenta estados, agrega los tipos de error mas
  // frecuentes del feedback SCOPED y el tiempo medio de revision (creacion ->
  // primera decision terminal).
  async getMetrics(oppositionId: string): Promise<ReliabilityMetrics> {
    const questions = (await this.deps.questionService.listQuestions()).filter(
      (q) => q.opposition_id === oppositionId,
    );
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const ids = new Set(questions.map((q) => q.id));

    const validated = questions.filter((q) => q.status === 'validated').length;
    const rejected = questions.filter((q) => q.status === 'rejected').length;
    const needsFix = questions.filter((q) => q.status === 'needs_fix').length;

    // top_error_types: feedback del MISMO scope (oposicion), agrupado por tipo.
    const feedback = (await this.deps.feedbackRepository.findAll()).filter(
      (f) => f.opposition_id === oppositionId || (f.opposition_id == null && ids.has(f.question_id)),
    );
    const byType = new Map<string, number>();
    for (const f of feedback) {
      byType.set(f.feedback_type, (byType.get(f.feedback_type) ?? 0) + 1);
    }
    const topErrorTypes = [...byType.entries()].map(([type, count]) => ({ type, count }));

    // average_review_time: creacion de la pregunta -> primera decision terminal.
    const reviews = (await this.deps.reviewRepository.findAll()).filter((r) =>
      ids.has(r.question_id),
    );
    const firstTerminal = new Map<string, Date>();
    for (const r of reviews) {
      if (!TERMINAL_ACTIONS.has(r.action)) continue;
      const prev = firstTerminal.get(r.question_id);
      if (!prev || r.created_at < prev) firstTerminal.set(r.question_id, r.created_at);
    }
    const reviewTimes: number[] = [];
    for (const [questionId, decidedAt] of firstTerminal) {
      const q = questionById.get(questionId);
      if (q?.created_at) {
        const ms = decidedAt.getTime() - q.created_at.getTime();
        if (ms >= 0) reviewTimes.push(ms);
      }
    }

    return computeReliabilityMetrics({
      generated_count: questions.length,
      validated_count: validated,
      rejected_count: rejected,
      needs_fix_count: needsFix,
      review_times_ms: reviewTimes,
      top_error_types: topErrorTypes,
    });
  }
}
