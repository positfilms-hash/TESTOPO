import { describe, expect, it } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import {
  QuestionService,
  type CreateQuestionInput,
} from '../src/service/questionService.js';
import { QuestionValidationService } from '../src/service/questionValidationService.js';
import { QuestionReviewService } from '../src/service/questionReviewService.js';
import { QuestionReviewError } from '../src/review/questionReviewError.js';
import { QuestionReviewErrorCode } from '../src/review/reviewErrors.js';
import { QuestionValidationCode } from '../src/quality/qualityCodes.js';
import type { Difficulty, QuestionStatus } from '../src/models/enums.js';
import type { Source } from '../src/models/source.js';
import { validInput, TEST_OPPOSITION_ID } from './helpers.js';

function makeSetup() {
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(questionRepository, {
    resolveMaterialStatus: (id) => materials.getMaterial(id)?.status ?? null,
    resolveTopicStatus: (id) => topics.getTopic(id)?.status ?? null,
  });
  const validation = new QuestionValidationService({
    questionService: questions,
    materialRepository,
    topicRepository,
  });
  const review = new QuestionReviewService({
    questionService: questions,
    validationService: validation,
    materialRepository,
    topicRepository,
  });
  return { materials, topics, questions, validation, review };
}

// Crea una pregunta y la deja en el estado indicado (sin pasar por validacion,
// usando el cambio de estado directo del banco para preparar el escenario).
function makeQuestion(
  questions: QuestionService,
  status: QuestionStatus = 'pending_review',
  overrides: Partial<CreateQuestionInput> = {},
) {
  const q = questions.createQuestion(validInput(overrides));
  if (status !== 'draft') {
    questions.changeStatus(q.id, status);
  }
  return questions.getQuestion(q.id)!;
}

describe('QuestionReviewService - listado y detalle', () => {
  it('lista por defecto solo draft/pending_review/needs_fix', () => {
    const { questions, review } = makeSetup();
    makeQuestion(questions, 'pending_review');
    makeQuestion(questions, 'needs_fix');
    makeQuestion(questions, 'rejected');

    const list = review.listForReview();
    expect(list).toHaveLength(2);
    expect(list.every((q) => q.status !== 'rejected')).toBe(true);
  });

  it('devuelve el detalle de una pregunta', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review');
    const detail = review.getReviewDetail(q.id);
    expect(detail.question.id).toBe(q.id);
    expect(detail.reviews).toHaveLength(0);
  });
});

describe('QuestionReviewService - edicion', () => {
  it('editar no convierte en validated y registra accion edit', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review');

    const { question, review: log } = review.editFromReview(q.id, {
      explanation: 'Explicacion revisada y suficientemente larga.',
    });

    expect(question.status).not.toBe('validated');
    expect(log.action).toBe('edit');
    expect(review.listReviews(q.id)).toHaveLength(1);
  });
});

describe('QuestionReviewService - aprobacion', () => {
  it('aprueba una pregunta valida y registra accion approve', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review');

    const result = review.approve(q.id, { reviewer_name: 'Miguel' });

    expect(result.question.status).toBe('validated');
    expect(result.review.action).toBe('approve');
    expect(result.review.validation_result_id).toBe(result.validation?.id);
  });

  function expectApprovalBlocked(
    fn: () => unknown,
    code?: QuestionValidationCode,
  ): void {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(QuestionReviewError);
      const reviewError = error as QuestionReviewError;
      expect(reviewError.codes).toContain(
        QuestionReviewErrorCode.APPROVAL_BLOCKED,
      );
      if (code) {
        expect(
          reviewError.validation?.errors.some((f) => f.code === code),
        ).toBe(true);
      }
      return;
    }
    throw new Error('Expected QuestionReviewError (APPROVAL_BLOCKED)');
  }

  it('no aprueba sin enunciado', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review', { statement: '  ' });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.STATEMENT_REQUIRED,
    );
  });

  it('no aprueba sin explicacion', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review', { explanation: null });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.EXPLANATION_REQUIRED,
    );
  });

  it('no aprueba sin fuente', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review', { source: null });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.SOURCE_REQUIRED,
    );
  });

  it('no aprueba sin tema', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review', { topic: null });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.TOPIC_REQUIRED,
    );
  });

  it('no aprueba sin dificultad', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review', { difficulty: null });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.DIFFICULTY_REQUIRED,
    );
  });

  it('no aprueba con mas de una respuesta correcta', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review', {
      options: [
        { text: 'A', is_correct: true },
        { text: 'B', is_correct: true },
      ],
    });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.SINGLE_CORRECT_OPTION_REQUIRED,
    );
  });

  it('no aprueba con fuente obsoleta', () => {
    const { questions, review } = makeSetup();
    const source: Source = {
      id: 'src',
      title: 'Norma ficticia',
      type: 'law',
      reference: 'Ley ficticia',
      status: 'obsolete',
    };
    const q = makeQuestion(questions, 'pending_review', { source });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.SOURCE_OBSOLETE,
    );
  });

  it('no aprueba con material obsoleto', () => {
    const { materials, questions, review } = makeSetup();
    const material = materials.createMaterial({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Material ficticio',
      type: 'syllabus',
      content_text: 'texto',
    });
    materials.markObsolete(material.id);
    const source: Source = {
      id: 'src',
      material_id: material.id,
      title: 'Material ficticio',
      type: 'syllabus',
      reference: 'Tema 1',
      excerpt: 'fragmento',
      status: 'active',
    };
    const q = makeQuestion(questions, 'pending_review', { source });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.SOURCE_MATERIAL_OBSOLETE,
    );
  });

  it('no aprueba con tema obsoleto', () => {
    const { topics, questions, review } = makeSetup();
    const topic = topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema viejo' });
    topics.markObsolete(topic.id);
    const q = makeQuestion(questions, 'pending_review', {
      topic_id: topic.id,
    });
    expectApprovalBlocked(
      () => review.approve(q.id),
      QuestionValidationCode.TOPIC_OBSOLETE,
    );
  });

  it('no permite pasar directamente de rejected a validated', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'rejected');
    try {
      review.approve(q.id);
    } catch (error) {
      expect((error as QuestionReviewError).codes).toContain(
        QuestionReviewErrorCode.REJECTED_REQUIRES_REVIEW_REOPEN,
      );
      return;
    }
    throw new Error('Expected QuestionReviewError');
  });

  it('no permite pasar directamente de obsolete a validated', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'obsolete');
    try {
      review.approve(q.id);
    } catch (error) {
      expect((error as QuestionReviewError).codes).toContain(
        QuestionReviewErrorCode.OBSOLETE_CANNOT_BE_VALIDATED,
      );
      return;
    }
    throw new Error('Expected QuestionReviewError');
  });
});

describe('QuestionReviewService - otras acciones', () => {
  it('rechaza una pregunta', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review');
    const { question, review: log } = review.reject(q.id, {
      notes: 'Ambigua',
    });
    expect(question.status).toBe('rejected');
    expect(log.action).toBe('reject');
  });

  it('marca como needs_fix', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review');
    expect(review.markNeedsFix(q.id).question.status).toBe('needs_fix');
  });

  it('marca como obsolete', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review');
    expect(review.markObsolete(q.id).question.status).toBe('obsolete');
  });

  it('devuelve una pregunta valida a pending_review', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'needs_fix');
    const { question, review: log } = review.returnToPendingReview(q.id);
    expect(question.status).toBe('pending_review');
    expect(log.action).toBe('return_to_pending_review');
  });

  it('cada accion crea un registro de revision', () => {
    const { questions, review } = makeSetup();
    const q = makeQuestion(questions, 'pending_review');
    review.markNeedsFix(q.id, { notes: 'falta fuente' });
    review.returnToPendingReview(q.id);
    review.approve(q.id);
    expect(review.listReviews(q.id)).toHaveLength(3);
  });
});
