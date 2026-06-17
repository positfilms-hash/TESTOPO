// Resumen de feedback de revision para alimentar futuras generaciones IA
// (SPEC 018.4, 15-16). No es entrenamiento: agrupa los motivos detectados en
// revision para inyectarlos como contexto en el prompt de generacion.

import type {
  FeedbackSeverity,
  QuestionGenerationFeedbackSummary,
  QuestionReviewFeedback,
} from '../models/questionReviewFeedback.js';
import { SEVERITY_RANK } from '../models/questionReviewFeedback.js';
import type { Question } from '../models/question.js';
import type { QuestionReviewFeedbackRepository } from '../repository/questionReviewFeedbackRepository.js';
import { QuestionService } from './questionService.js';

const DEFAULT_EXAMPLE_LIMIT = 3;

export interface FeedbackSummaryFilter {
  /** Filtra por oposicion de la pregunta (SPEC 018.4, 16). */
  opposition_id?: string | null;
  /** Filtra por tema vinculado de la pregunta. */
  topic_id?: string | null;
  /** Filtra por material origen de la pregunta. */
  material_id?: string | null;
  /** Maximo de comentarios de ejemplo por tipo (defecto 3). */
  example_limit?: number;
}

export interface QuestionFeedbackServiceOptions {
  feedbackRepository: QuestionReviewFeedbackRepository;
  questionService: QuestionService;
}

export class QuestionFeedbackService {
  private readonly feedback: QuestionReviewFeedbackRepository;
  private readonly questions: QuestionService;

  constructor(options: QuestionFeedbackServiceOptions) {
    this.feedback = options.feedbackRepository;
    this.questions = options.questionService;
  }

  async listForQuestion(questionId: string): Promise<QuestionReviewFeedback[]> {
    return this.feedback.findByQuestion(questionId);
  }

  // 16. Resumen agregado por tipo de error, filtrable por oposicion/tema/material.
  async getFeedbackSummaryForGeneration(
    filter: FeedbackSummaryFilter = {},
  ): Promise<QuestionGenerationFeedbackSummary[]> {
    const exampleLimit = filter.example_limit ?? DEFAULT_EXAMPLE_LIMIT;
    const all = await this.feedback.findAll();
    if (all.length === 0) {
      return [];
    }

    const questionCache = new Map<string, Question | null>();
    const matching: QuestionReviewFeedback[] = [];
    for (const entry of all) {
      if (!(await this.matchesFilter(entry, filter, questionCache))) {
        continue;
      }
      matching.push(entry);
    }

    return summarize(matching, exampleLimit);
  }

  private async matchesFilter(
    entry: QuestionReviewFeedback,
    filter: FeedbackSummaryFilter,
    cache: Map<string, Question | null>,
  ): Promise<boolean> {
    const needsQuestion =
      isNonEmptyString(filter.opposition_id) ||
      isNonEmptyString(filter.topic_id) ||
      isNonEmptyString(filter.material_id);
    if (!needsQuestion) {
      return true;
    }
    let question = cache.get(entry.question_id);
    if (question === undefined) {
      question = await this.questions.getQuestion(entry.question_id);
      cache.set(entry.question_id, question);
    }
    if (!question) {
      return false;
    }
    if (
      isNonEmptyString(filter.opposition_id) &&
      question.opposition_id !== filter.opposition_id
    ) {
      return false;
    }
    if (
      isNonEmptyString(filter.topic_id) &&
      question.topic_id !== filter.topic_id
    ) {
      return false;
    }
    if (
      isNonEmptyString(filter.material_id) &&
      question.source?.material_id !== filter.material_id
    ) {
      return false;
    }
    return true;
  }
}

function summarize(
  entries: QuestionReviewFeedback[],
  exampleLimit: number,
): QuestionGenerationFeedbackSummary[] {
  const groups = new Map<
    string,
    {
      summary: QuestionGenerationFeedbackSummary;
      severityRank: number;
      examples: string[];
    }
  >();

  for (const entry of entries) {
    let group = groups.get(entry.feedback_type);
    if (!group) {
      group = {
        summary: {
          feedback_type: entry.feedback_type,
          count: 0,
          severity: entry.severity,
        },
        severityRank: SEVERITY_RANK[entry.severity],
        examples: [],
      };
      groups.set(entry.feedback_type, group);
    }
    group.summary.count += 1;
    if (SEVERITY_RANK[entry.severity] > group.severityRank) {
      group.severityRank = SEVERITY_RANK[entry.severity];
      group.summary.severity = entry.severity;
    }
    if (
      isNonEmptyString(entry.comment) &&
      group.examples.length < exampleLimit &&
      !group.examples.includes(entry.comment)
    ) {
      group.examples.push(entry.comment);
    }
  }

  const result = [...groups.values()].map((group) => {
    const summary = group.summary;
    if (group.examples.length > 0) {
      summary.example_comments = group.examples;
    }
    return summary;
  });

  // Mas grave primero; a igual severidad, mas frecuente primero.
  result.sort((a, b) => {
    const severityDiff = severityRankOf(b.severity) - severityRankOf(a.severity);
    return severityDiff !== 0 ? severityDiff : b.count - a.count;
  });
  return result;
}

function severityRankOf(severity: FeedbackSeverity): number {
  return SEVERITY_RANK[severity];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
