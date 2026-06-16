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
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicRepository } from '../repository/topicRepository.js';
import type { QuestionReviewRepository } from '../repository/questionReviewRepository.js';
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

export interface ReviewActionInput {
  reviewer_name?: string | null;
  notes?: string | null;
}

export interface ReviewActionResult {
  question: Question;
  review: QuestionReview;
  validation?: QuestionValidationResult;
}

export interface QuestionReviewServiceOptions {
  questionService: QuestionService;
  validationService: QuestionValidationService;
  materialRepository: MaterialRepository;
  topicRepository: TopicRepository;
  reviewRepository?: QuestionReviewRepository;
  generateId?: () => string;
  now?: () => Date;
}

export class QuestionReviewService {
  private readonly questions: QuestionService;
  private readonly validation: QuestionValidationService;
  private readonly materials: MaterialRepository;
  private readonly topics: TopicRepository;
  private readonly reviews: QuestionReviewRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: QuestionReviewServiceOptions) {
    this.questions = options.questionService;
    this.validation = options.validationService;
    this.materials = options.materialRepository;
    this.topics = options.topicRepository;
    this.reviews =
      options.reviewRepository ?? new InMemoryQuestionReviewRepository();
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 9.1 Listar preguntas para revisar. Por defecto solo draft/pending_review/
  // needs_fix; con filtro de estado puede pedirse cualquiera.
  listForReview(filter: ReviewListFilter = {}): Question[] {
    const statuses = filter.status
      ? [filter.status]
      : REVIEW_QUEUE_STATUSES;
    const search = filter.search?.trim().toLowerCase();

    return this.questions.listQuestions().filter((question) => {
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
  getReviewDetail(questionId: string): ReviewDetail {
    const question = this.requireQuestion(questionId);
    const materialId = question.source?.material_id;
    return {
      question,
      material: materialId ? this.materials.findById(materialId) : null,
      topic: question.topic_id
        ? this.topics.findById(question.topic_id)
        : null,
      last_validation: this.validation.getLastReport(questionId),
      reviews: this.reviews.findByQuestion(questionId),
    };
  }

  // 9.3 Editar desde revision. Nunca deja la pregunta en `validated`: tras
  // editar queda en `pending_review` (si pasa validacion) o `draft`.
  editFromReview(
    questionId: string,
    changes: EditQuestionInput,
    input: ReviewActionInput = {},
  ): ReviewActionResult {
    const existing = this.requireQuestion(questionId);
    const previousStatus = existing.status;

    this.questions.editQuestion(questionId, changes);
    const validation = this.validation.validateQuestion(questionId);
    const newStatus: QuestionStatus = validation.passed
      ? 'pending_review'
      : 'draft';
    const question = this.questions.changeStatus(questionId, newStatus);

    const review = this.recordReview(
      questionId,
      'edit',
      previousStatus,
      newStatus,
      input,
      validation.id,
    );
    return { question, review, validation };
  }

  // 9.4 Aprobar: unica via a `validated`. Reusa la validacion de SPEC 005.
  approve(
    questionId: string,
    input: ReviewActionInput = {},
  ): ReviewActionResult {
    const existing = this.requireQuestion(questionId);
    this.assertTransition(existing.status, 'validated');

    const validation = this.validation.validateQuestion(questionId);
    if (!validation.passed) {
      throw new QuestionReviewError(
        [QuestionReviewErrorCode.APPROVAL_BLOCKED],
        validation,
      );
    }

    const question = this.questions.changeStatus(questionId, 'validated');
    const review = this.recordReview(
      questionId,
      'approve',
      existing.status,
      'validated',
      input,
      validation.id,
    );
    return { question, review, validation };
  }

  // 9.5 Rechazar.
  reject(
    questionId: string,
    input: ReviewActionInput = {},
  ): ReviewActionResult {
    return this.transition(questionId, 'rejected', 'reject', input);
  }

  // 9.6 Marcar como necesita correccion.
  markNeedsFix(
    questionId: string,
    input: ReviewActionInput = {},
  ): ReviewActionResult {
    return this.transition(questionId, 'needs_fix', 'mark_needs_fix', input);
  }

  // 9.7 Marcar como obsoleta.
  markObsolete(
    questionId: string,
    input: ReviewActionInput = {},
  ): ReviewActionResult {
    return this.transition(questionId, 'obsolete', 'mark_obsolete', input);
  }

  // 9.8 Devolver a pendiente de revision. Solo si pasa la validacion formal
  // minima (no exige resolucion de fuente/tema).
  returnToPendingReview(
    questionId: string,
    input: ReviewActionInput = {},
  ): ReviewActionResult {
    const existing = this.requireQuestion(questionId);
    this.assertTransition(existing.status, 'pending_review');

    const formalErrors = formalFindings(existing);
    if (formalErrors.length > 0) {
      throw new QuestionReviewError([
        QuestionReviewErrorCode.INVALID_STATUS_TRANSITION,
      ]);
    }

    const question = this.questions.changeStatus(questionId, 'pending_review');
    const review = this.recordReview(
      questionId,
      'return_to_pending_review',
      existing.status,
      'pending_review',
      input,
      null,
    );
    return { question, review };
  }

  listReviews(questionId: string): QuestionReview[] {
    return this.reviews.findByQuestion(questionId);
  }

  // Transicion simple (reject / needs_fix / obsolete) con registro.
  private transition(
    questionId: string,
    newStatus: QuestionStatus,
    action: ReviewAction,
    input: ReviewActionInput,
  ): ReviewActionResult {
    const existing = this.requireQuestion(questionId);
    this.assertTransition(existing.status, newStatus);
    const question = this.questions.changeStatus(questionId, newStatus);
    const review = this.recordReview(
      questionId,
      action,
      existing.status,
      newStatus,
      input,
      null,
    );
    return { question, review };
  }

  private assertTransition(from: QuestionStatus, to: QuestionStatus): void {
    if (!isAllowedTransition(from, to)) {
      throw new QuestionReviewError([transitionErrorCode(from, to)]);
    }
  }

  private recordReview(
    questionId: string,
    action: ReviewAction,
    previousStatus: QuestionStatus,
    newStatus: QuestionStatus,
    input: ReviewActionInput,
    validationResultId: string | null,
  ): QuestionReview {
    return this.reviews.create({
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
  }

  private requireQuestion(questionId: string): Question {
    const question = this.questions.getQuestion(questionId);
    if (!question) {
      throw new QuestionReviewError([
        QuestionReviewErrorCode.QUESTION_NOT_FOUND,
      ]);
    }
    return question;
  }
}
