// Repositorios Supabase auxiliares del banco de preguntas (SPEC 023):
// generación, revisión, feedback e informes de validación. Implementan las
// interfaces async existentes mapeando fila<->modelo; los campos array/objeto
// (errors/warnings/info, errors de generación) se guardan como JSONB.

import type {
  GenerationRunStatus,
  QuestionGenerationRun,
} from '../../models/questionGenerationRun.js';
import type { GenerationMode } from '../../models/generationMetadata.js';
import type { QuestionGenerationErrorCode } from '../../generation/generationErrors.js';
import type {
  QuestionReview,
  ReviewAction,
} from '../../models/questionReview.js';
import type { QuestionStatus } from '../../models/enums.js';
import type {
  FeedbackSeverity,
  FeedbackType,
  QuestionReviewFeedback,
} from '../../models/questionReviewFeedback.js';
import type {
  QuestionValidationResult,
  RecommendedStatus,
  ValidationReportStatus,
} from '../../models/questionValidationResult.js';
import type { Finding } from '../../quality/qualityCodes.js';
import type { GenerationRunRepository } from '../generationRunRepository.js';
import type { QuestionReviewRepository } from '../questionReviewRepository.js';
import type { QuestionReviewFeedbackRepository } from '../questionReviewFeedbackRepository.js';
import type { QuestionValidationReportRepository } from '../questionValidationReportRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

// ===================== Generation runs =====================
export class SupabaseGenerationRunRepository implements GenerationRunRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(run: QuestionGenerationRun): Promise<QuestionGenerationRun> {
    const row = await this.port.table('question_generation_runs').insert({
      id: run.id,
      material_id: run.material_id,
      topic_id: run.topic_id,
      mode: run.mode,
      requested_count: run.requested_count,
      created_count: run.created_count,
      status: run.status,
      errors: run.errors,
      provider: run.provider,
      model: run.model,
      feedback_used: run.feedback_used,
      source_strategy: run.source_strategy ?? null,
      source_reference_ids: run.source_reference_ids ?? [],
      material_section_ids: run.material_section_ids ?? [],
      created_at: iso(run.created_at),
    });
    return toRun(row);
  }

  async findAll(): Promise<QuestionGenerationRun[]> {
    const rows = await this.port.table('question_generation_runs').selectAll();
    return rows.map(toRun);
  }

  async findById(id: string): Promise<QuestionGenerationRun | null> {
    const rows = await this.port
      .table('question_generation_runs')
      .selectMatch({ id });
    return rows[0] ? toRun(rows[0]) : null;
  }
}

function toRun(row: SupabaseRow): QuestionGenerationRun {
  return {
    id: String(row.id),
    material_id: asNullableString(row.material_id),
    topic_id: asNullableString(row.topic_id),
    mode: row.mode as GenerationMode,
    requested_count: asNumber(row.requested_count),
    created_count: asNumber(row.created_count),
    status: row.status as GenerationRunStatus,
    errors: Array.isArray(row.errors)
      ? (row.errors as QuestionGenerationErrorCode[])
      : [],
    provider: String(row.provider ?? ''),
    model: asNullableString(row.model),
    feedback_used: row.feedback_used === true,
    source_strategy: asNullableString(row.source_strategy),
    source_reference_ids: Array.isArray(row.source_reference_ids)
      ? (row.source_reference_ids as string[])
      : [],
    material_section_ids: Array.isArray(row.material_section_ids)
      ? (row.material_section_ids as string[])
      : [],
    created_at: parseDate(row.created_at),
  };
}

// ===================== Reviews =====================
export class SupabaseQuestionReviewRepository
  implements QuestionReviewRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(review: QuestionReview): Promise<QuestionReview> {
    const row = await this.port.table('question_reviews').insert({
      id: review.id,
      question_id: review.question_id,
      action: review.action,
      previous_status: review.previous_status,
      new_status: review.new_status,
      reviewer_name: review.reviewer_name,
      notes: review.notes,
      validation_result_id: review.validation_result_id,
      created_at: iso(review.created_at),
    });
    return toReview(row);
  }

  async findByQuestion(questionId: string): Promise<QuestionReview[]> {
    const rows = await this.port
      .table('question_reviews')
      .selectMatch({ question_id: questionId });
    return rows.map(toReview);
  }

  async findAll(): Promise<QuestionReview[]> {
    const rows = await this.port.table('question_reviews').selectAll();
    return rows.map(toReview);
  }
}

function toReview(row: SupabaseRow): QuestionReview {
  return {
    id: String(row.id),
    question_id: String(row.question_id ?? ''),
    action: row.action as ReviewAction,
    previous_status: row.previous_status as QuestionStatus,
    new_status: row.new_status as QuestionStatus,
    reviewer_name: asNullableString(row.reviewer_name),
    notes: asNullableString(row.notes),
    validation_result_id: asNullableString(row.validation_result_id),
    created_at: parseDate(row.created_at),
  };
}

// ===================== Review feedback =====================
export class SupabaseQuestionReviewFeedbackRepository
  implements QuestionReviewFeedbackRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(
    feedback: QuestionReviewFeedback,
  ): Promise<QuestionReviewFeedback> {
    const row = await this.port.table('question_review_feedback').insert({
      id: feedback.id,
      question_id: feedback.question_id,
      review_id: feedback.review_id,
      feedback_type: feedback.feedback_type,
      severity: feedback.severity,
      comment: feedback.comment,
      created_by: feedback.created_by,
      created_at: iso(feedback.created_at),
    });
    return toFeedback(row);
  }

  async findByQuestion(questionId: string): Promise<QuestionReviewFeedback[]> {
    const rows = await this.port
      .table('question_review_feedback')
      .selectMatch({ question_id: questionId });
    return rows.map(toFeedback);
  }

  async findAll(): Promise<QuestionReviewFeedback[]> {
    const rows = await this.port.table('question_review_feedback').selectAll();
    return rows.map(toFeedback);
  }
}

function toFeedback(row: SupabaseRow): QuestionReviewFeedback {
  return {
    id: String(row.id),
    question_id: String(row.question_id ?? ''),
    review_id: asNullableString(row.review_id),
    feedback_type: row.feedback_type as FeedbackType,
    severity: row.severity as FeedbackSeverity,
    comment: asNullableString(row.comment),
    created_by: asNullableString(row.created_by),
    created_at: parseDate(row.created_at),
  };
}

// ===================== Validation reports =====================
export class SupabaseQuestionValidationReportRepository
  implements QuestionValidationReportRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async save(
    result: QuestionValidationResult,
  ): Promise<QuestionValidationResult> {
    const row = await this.port.table('question_validation_results').insert({
      id: result.id,
      question_id: result.question_id,
      status: result.status,
      passed: result.passed,
      errors: result.errors,
      warnings: result.warnings,
      info: result.info,
      validated_at: iso(result.validated_at),
      validator_version: result.validator_version,
      recommended_status: result.recommended_status,
      created_at: iso(result.validated_at),
    });
    return toReport(row);
  }

  async findLastByQuestion(
    questionId: string,
  ): Promise<QuestionValidationResult | null> {
    const rows = await this.port
      .table('question_validation_results')
      .selectMatch({ question_id: questionId });
    if (rows.length === 0) {
      return null;
    }
    // El "ultimo" informe: orden estable por validated_at; entre iguales, el
    // ultimo insertado (el puerto preserva el orden de insercion).
    const sorted = [...rows].sort(
      (a, b) => dateMs(a.validated_at) - dateMs(b.validated_at),
    );
    return toReport(sorted[sorted.length - 1]);
  }
}

function toReport(row: SupabaseRow): QuestionValidationResult {
  return {
    id: String(row.id),
    question_id: String(row.question_id ?? ''),
    status: row.status as ValidationReportStatus,
    passed: row.passed === true,
    errors: Array.isArray(row.errors) ? (row.errors as Finding[]) : [],
    warnings: Array.isArray(row.warnings) ? (row.warnings as Finding[]) : [],
    info: Array.isArray(row.info) ? (row.info as Finding[]) : [],
    validated_at: parseDate(row.validated_at),
    validator_version: String(row.validator_version ?? ''),
    recommended_status: row.recommended_status as RecommendedStatus,
  };
}

// ===================== helpers =====================
function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function dateMs(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}
