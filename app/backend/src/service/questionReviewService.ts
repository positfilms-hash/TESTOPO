// Flujo de revision humana de preguntas (SPEC 006).
//
// Reutiliza el banco de preguntas (SPEC 001), material (SPEC 002), temas
// (SPEC 003) y el validador (SPEC 005). No duplica modelos ni validacion.
//
// Regla central: SOLO la accion explicita `approve` pasa una pregunta a
// `validated`, y unicamente si la validacion de SPEC 005 no devuelve errores
// criticos y la transicion de estado es valida. Editar, rechazar, etc. nunca
// producen `validated`.
//
// Nota de composicion: el `QuestionService` inyectado debe llevar cableados los
// resolutores de material/tema (resolveMaterialStatus/resolveTopicStatus) para
// que el cambio a `validated` supere tambien el gate de SPEC 001.

import { randomUUID } from 'node:crypto';
import type { Difficulty, QuestionStatus } from '../models/enums.js';
import type { Material } from '../models/material.js';
import type { Question } from '../models/question.js';
import type { QuestionReview, ReviewAction } from '../models/questionReview.js';
import type { QuestionValidationResult } from '../models/questionValidationResult.js';
import type { Topic } from '../models/topic.js';
import type {
  FeedbackSeverity,
  FeedbackType,
  QuestionReviewFeedback,
} from '../models/questionReviewFeedback.js';
import { resolveFeedbackSeverity } from '../models/questionReviewFeedback.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicRepository } from '../repository/topicRepository.js';
import type { QuestionReviewRepository } from '../repository/questionReviewRepository.js';
import type { QuestionReviewFeedbackRepository } from '../repository/questionReviewFeedbackRepository.js';
import { InMemoryQuestionReviewRepository } from '../repository/inMemoryQuestionReviewRepository.js';
import { formalFindings } from '../quality/qualityChecks.js';
import {
  QuestionService,
  type EditQuestionInput,
} from './questionService.js';
import { QuestionValidationService } from './questionValidationService.js';
import { QuestionReviewError } from '../review/questionReviewError.js';
import { QuestionReviewErrorCode } from '../review/reviewErrors.js';
import {
  isAllowedTransition,
  transitionErrorCode,
} from '../review/reviewTransitions.js';

// Estados que entran por defecto en la cola de revision (SPEC 006, 9.1).
const REVIEW_QUEUE_STATUSES: QuestionStatus[] = [
  'draft',
  'pending_review',
  'needs_fix',
];

export interface ReviewListFilter {
  status?: QuestionStatus;
  difficulty?: Difficulty;
  topic?: string;
  search?: string;
}

export interface ReviewDetail {
  question: Question;
  material: Material | null;
  topic: Topic | null;
  last_validation: QuestionValidationResult | null;
  reviews: QuestionReview[];
}

// Motivo estructurado de un rechazo/correccion (SPEC 018.4, 12-13, 17). La
// severidad es opcional: si se omite se usa la del catalogo por tipo.
export interface ReviewFeedbackInput {
  feedback_type: FeedbackType;
  severity?: FeedbackSeverity;
  comment?: string | null;
  created_by?: string | null;
}

export interface ReviewActionInput {
  reviewer_name?: string | null;
  notes?: string | null;
  /** Motivos estructurados (SPEC 018.4). Se persisten ligados a la revision. */
  feedback?: ReviewFeedbackInput[];
}

export interface ReviewActionResult {
  question: Question;
  review: QuestionReview;
  validation?: QuestionValidationResult;
  /** Feedback registrado en esta accion, si lo hubo. */
  feedback?: QuestionReviewFeedback[];
}

export interface QuestionReviewServiceOptions {
  questionService: QuestionService;
  validationService: QuestionValidationService;
  materialRepository: MaterialRepository;
  topicRepository: TopicRepository;
  reviewRepository?: QuestionReviewRepository;
  /**
   * Persistencia del feedback de revision (SPEC 018.4). Si se omite, registrar
   * feedback en una accion lanza error en vez de perderlo silenciosamente.
   */
  feedbackRepository?: QuestionReviewFeedbackRepository;
  generateId?: () => string;
  now?: () => Date;
}

export class QuestionReviewService {
  private readonly questions: QuestionService;
  private readonly validation: QuestionValidationService;
  private readonly materials: MaterialRepository;
  private readonly topics: TopicRepository;
  private readonly reviews: QuestionReviewRepository;
  private readonly feedbackRepository?: QuestionReviewFeedbackRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: QuestionReviewServiceOptions) {
    this.questions = options.questionService;
    this.validation = options.validationService;
    this.materials = options.materialRepository;
    this.topics = options.topicRepository;
    this.reviews =
      options.reviewRepository ?? new InMemoryQuestionReviewRepository();
    this.feedbackRepository = options.feedbackRepository;
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 9.1 Listar preguntas para revisar. Por defecto solo draft/pending_review/
  // needs_fix; con filtro de estado puede pedirse cualquiera.
  async listForReview(filter: ReviewListFilter = {}): Promise<Question[]> {
    const statuses = filter.status
      ? [filter.status]
      : REVIEW_QUEUE_STATUSES;
    const search = filter.search?.trim().toLowerCase();

    return (await this.questions.listQuestions()).filter((question) => {
      if (!statuses.includes(question.status)) {
        return false;
      }
      if (filter.difficulty && question.difficulty !== filter.difficulty) {
        return false;
      }
      if (
        filter.topic &&
        question.topic !== filter.topic &&
        question.topic_id !== filter.topic
      ) {
        return false;
      }
      if (search && !question.statement.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
  }

  // 9.2 Detalle completo para revision.
  async getReviewDetail(questionId: string): Promise<ReviewDetail> {
    const question = await this.requireQuestion(questionId);
    const materialId = question.source?.material_id;
    return {
      question,
      material: materialId ? await this.materials.findById(materialId) : null,
      topic: question.topic_id
        ? await this.topics.findById(question.topic_id)
        : null,
      last_validation: await this.validation.getLastReport(questionId),
      reviews: await this.reviews.findByQuestion(questionId),
    };
  }

  // 9.3 Editar desde revision. Nunca deja la pregunta en `validated`: tras
  // editar queda en `pending_review` (si pasa validacion) o `draft`.
  async editFromReview(
    questionId: string,
    changes: EditQuestionInput,
    input: ReviewActionInput = {},
  ): Promise<ReviewActionResult> {
    const existing = await this.requireQuestion(questionId);
    const previousStatus = existing.status;

    await this.questions.editQuestion(questionId, changes);
    const validation = await this.validation.validateQuestion(questionId);
    const newStatus: QuestionStatus = validation.passed
      ? 'pending_review'
      : 'draft';
    const question = await this.questions.changeStatus(questionId, newStatus);

    const { review, feedback } = await this.recordReview(
      questionId,
      'edit',
      previousStatus,
      newStatus,
      input,
      validation.id,
    );
    return { question, review, validation, feedback };
  }

  // 9.4 Aprobar: unica via a `validated`. Reusa la validacion de SPEC 005.
  async approve(
    questionId: string,
    input: ReviewActionInput = {},
  ): Promise<ReviewActionResult> {
    const existing = await this.requireQuestion(questionId);
    this.assertTransition(existing.status, 'validated');

    const validation = await this.validation.validateQuestion(questionId);
    if (!validation.passed) {
      throw new QuestionReviewError(
        [QuestionReviewErrorCode.APPROVAL_BLOCKED],
        validation,
      );
    }

    const question = await this.questions.changeStatus(questionId, 'validated');
    const { review, feedback } = await this.recordReview(
      questionId,
      'approve',
      existing.status,
      'validated',
      input,
      validation.id,
    );
    return { question, review, validation, feedback };
  }

  // 9.5 Rechazar.
  reject(
    questionId: string,
    input: ReviewActionInput = {},
  ): Promise<ReviewActionResult> {
    return this.transition(questionId, 'rejected', 'reject', input);
  }

  // 9.6 Marcar como necesita correccion.
  markNeedsFix(
    questionId: string,
    input: ReviewActionInput = {},
  ): Promise<ReviewActionResult> {
    return this.transition(questionId, 'needs_fix', 'mark_needs_fix', input);
  }

  // 9.7 Marcar como obsoleta.
  markObsolete(
    questionId: string,
    input: ReviewActionInput = {},
  ): Promise<ReviewActionResult> {
    return this.transition(questionId, 'obsolete', 'mark_obsolete', input);
  }

  // 9.8 Devolver a pendiente de revision. Solo si pasa la validacion formal
  // minima (no exige resolucion de fuente/tema).
  async returnToPendingReview(
    questionId: string,
    input: ReviewActionInput = {},
  ): Promise<ReviewActionResult> {
    const existing = await this.requireQuestion(questionId);
    this.assertTransition(existing.status, 'pending_review');

    const formalErrors = formalFindings(existing);
    if (formalErrors.length > 0) {
      throw new QuestionReviewError([
        QuestionReviewErrorCode.INVALID_STATUS_TRANSITION,
      ]);
    }

    const question = await this.questions.changeStatus(
      questionId,
      'pending_review',
    );
    const { review, feedback } = await this.recordReview(
      questionId,
      'return_to_pending_review',
      existing.status,
      'pending_review',
      input,
      null,
    );
    return { question, review, feedback };
  }

  async listReviews(questionId: string): Promise<QuestionReview[]> {
    return this.reviews.findByQuestion(questionId);
  }

  // Transicion simple (reject / needs_fix / obsolete) con registro.
  private async transition(
    questionId: string,
    newStatus: QuestionStatus,
    action: ReviewAction,
    input: ReviewActionInput,
  ): Promise<ReviewActionResult> {
    const existing = await this.requireQuestion(questionId);
    this.assertTransition(existing.status, newStatus);
    const question = await this.questions.changeStatus(questionId, newStatus);
    const { review, feedback } = await this.recordReview(
      questionId,
      action,
      existing.status,
      newStatus,
      input,
      null,
    );
    return { question, review, feedback };
  }

  private assertTransition(from: QuestionStatus, to: QuestionStatus): void {
    if (!isAllowedTransition(from, to)) {
      throw new QuestionReviewError([transitionErrorCode(from, to)]);
    }
  }

  // Lista el feedback estructurado registrado sobre una pregunta (SPEC 018.4).
  async listFeedback(questionId: string): Promise<QuestionReviewFeedback[]> {
    if (!this.feedbackRepository) {
      return [];
    }
    return this.feedbackRepository.findByQuestion(questionId);
  }

  private async recordReview(
    questionId: string,
    action: ReviewAction,
    previousStatus: QuestionStatus,
    newStatus: QuestionStatus,
    input: ReviewActionInput,
    validationResultId: string | null,
  ): Promise<{ review: QuestionReview; feedback: QuestionReviewFeedback[] }> {
    const review = await this.reviews.create({
      id: this.generateId(),
      question_id: questionId,
      action,
      previous_status: previousStatus,
      new_status: newStatus,
      reviewer_name: input.reviewer_name ?? null,
      notes: input.notes ?? null,
      validation_result_id: validationResultId,
      created_at: this.now(),
    });
    const feedback = await this.persistFeedback(review.id, questionId, input);
    return { review, feedback };
  }

  // Persiste los motivos estructurados ligados a la revision (SPEC 018.4, 12).
  private async persistFeedback(
    reviewId: string,
    questionId: string,
    input: ReviewActionInput,
  ): Promise<QuestionReviewFeedback[]> {
    const entries = input.feedback ?? [];
    if (entries.length === 0) {
      return [];
    }
    if (!this.feedbackRepository) {
      throw new Error(
        'Se indico feedback de revision pero no hay feedbackRepository configurado',
      );
    }
    const created: QuestionReviewFeedback[] = [];
    for (const entry of entries) {
      created.push(
        await this.feedbackRepository.create({
          id: this.generateId(),
          question_id: questionId,
          review_id: reviewId,
          feedback_type: entry.feedback_type,
          severity: resolveFeedbackSeverity(entry.feedback_type, entry.severity),
          comment: entry.comment ?? null,
          created_by: entry.created_by ?? null,
          created_at: this.now(),
        }),
      );
    }
    return created;
  }

  private async requireQuestion(questionId: string): Promise<Question> {
    const question = await this.questions.getQuestion(questionId);
    if (!question) {
      throw new QuestionReviewError([
        QuestionReviewErrorCode.QUESTION_NOT_FOUND,
      ]);
    }
    return question;
  }
}
