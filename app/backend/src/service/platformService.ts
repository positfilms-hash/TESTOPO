// Facade de acceso (SPEC 011, remediacion de la revision): centraliza el control
// de acceso de las operaciones de contenido y estudio segun el ROL DE WORKSPACE
// y el acceso a la oposicion, delegando despues en los servicios de dominio
// (que se mantienen puros). Es el limite de acceso del MVP: el frontend y
// cualquier consumidor de aplicacion deben pasar por aqui.
//
// - Gestion (material, temas, generacion, revision): requiere gestionar el
//   workspace de la oposicion (owner/admin del workspace) -> habilita Premium
//   personal (owner) y organizacion (owner/admin), no el `User.role` global.
// - Estudio (crear/realizar test, resultados): requiere acceso a la oposicion;
//   un intento solo lo ve/gestiona su propio usuario.

import type { User } from '../models/user.js';
import type { Material } from '../models/material.js';
import type { Topic } from '../models/topic.js';
import type { OppositionRepository } from '../repository/oppositionRepository.js';
import type { WorkspaceMemberRepository } from '../repository/workspaceMemberRepository.js';
import { AccessError } from '../access/accessError.js';
import { AccessErrorCode } from '../access/accessErrors.js';
import { requireManageWorkspace, requireUser } from '../access/permissions.js';
import type { OppositionService } from './oppositionService.js';
import type {
  CreateMaterialInput,
  EditMaterialInput,
  MaterialService,
} from './materialService.js';
import type { CreateTopicInput, TopicService } from './topicService.js';
import type {
  EditQuestionInput,
  QuestionService,
} from './questionService.js';
import type { QuestionGenerationService } from './questionGenerationService.js';
import type {
  GenerationResult,
} from './questionGenerationService.js';
import type {
  QuestionReviewService,
  ReviewActionInput,
  ReviewActionResult,
} from './questionReviewService.js';
import type {
  GenerateTestRequest,
  GeneratedTest,
  TestGeneratorService,
} from './testGeneratorService.js';
import type {
  AttemptResult,
  AttemptReview,
  TakingView,
  TestAttemptService,
} from './testAttemptService.js';
import type { TestAttempt } from '../models/testAttempt.js';
import type { TestAnswer } from '../models/testAnswer.js';

export interface PlatformServiceDeps {
  oppositionRepository: OppositionRepository;
  workspaceMembers: WorkspaceMemberRepository;
  oppositions: OppositionService;
  materials: MaterialService;
  topics: TopicService;
  questions: QuestionService;
  generation: QuestionGenerationService;
  review: QuestionReviewService;
  testGenerator: TestGeneratorService;
  attempts: TestAttemptService;
}

export class PlatformService {
  constructor(private readonly deps: PlatformServiceDeps) {}

  // --- Gestion (owner/admin del workspace de la oposicion) -----------------

  createMaterial(actor: User, input: CreateMaterialInput): Material {
    this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.materials.createMaterial(input);
  }

  editMaterial(
    actor: User,
    materialId: string,
    changes: EditMaterialInput,
  ): Material {
    const material = this.deps.materials.getMaterial(materialId);
    this.requireManageOpposition(actor, material?.opposition_id);
    return this.deps.materials.editMaterial(materialId, changes);
  }

  markMaterialObsolete(actor: User, materialId: string): Material {
    const material = this.deps.materials.getMaterial(materialId);
    this.requireManageOpposition(actor, material?.opposition_id);
    return this.deps.materials.markObsolete(materialId);
  }

  createTopic(actor: User, input: CreateTopicInput): Topic {
    this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.topics.createTopic(input);
  }

  editTopic(
    actor: User,
    topicId: string,
    changes: Parameters<TopicService['editTopic']>[1],
  ): Topic {
    const topic = this.deps.topics.getTopic(topicId);
    this.requireManageOpposition(actor, topic?.opposition_id);
    return this.deps.topics.editTopic(topicId, changes);
  }

  markTopicObsolete(actor: User, topicId: string): Topic {
    const topic = this.deps.topics.getTopic(topicId);
    this.requireManageOpposition(actor, topic?.opposition_id);
    return this.deps.topics.markObsolete(topicId);
  }

  generateFromMaterial(
    actor: User,
    input: Parameters<QuestionGenerationService['generateFromMaterial']>[0],
  ): GenerationResult {
    const material = this.deps.materials.getMaterial(input.material_id);
    this.requireManageOpposition(actor, material?.opposition_id);
    return this.deps.generation.generateFromMaterial(input);
  }

  generateFromExcerpt(
    actor: User,
    input: Parameters<QuestionGenerationService['generateFromExcerpt']>[0],
  ): GenerationResult {
    const material = this.deps.materials.getMaterial(input.material_id);
    this.requireManageOpposition(actor, material?.opposition_id);
    return this.deps.generation.generateFromExcerpt(input);
  }

  approve(
    actor: User,
    questionId: string,
    input?: ReviewActionInput,
  ): ReviewActionResult {
    this.requireManageQuestion(actor, questionId);
    return this.deps.review.approve(questionId, input);
  }

  reject(
    actor: User,
    questionId: string,
    input?: ReviewActionInput,
  ): ReviewActionResult {
    this.requireManageQuestion(actor, questionId);
    return this.deps.review.reject(questionId, input);
  }

  markNeedsFix(
    actor: User,
    questionId: string,
    input?: ReviewActionInput,
  ): ReviewActionResult {
    this.requireManageQuestion(actor, questionId);
    return this.deps.review.markNeedsFix(questionId, input);
  }

  editFromReview(
    actor: User,
    questionId: string,
    changes: EditQuestionInput,
    input?: ReviewActionInput,
  ): ReviewActionResult {
    this.requireManageQuestion(actor, questionId);
    return this.deps.review.editFromReview(questionId, changes, input);
  }

  // --- Estudio (miembro del workspace con acceso a la oposicion) -----------

  createTest(actor: User, request: GenerateTestRequest): GeneratedTest {
    // getOpposition exige membresia de workspace + acceso a la oposicion.
    if (!isNonEmptyString(request.opposition_id)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_REQUIRED]);
    }
    this.deps.oppositions.getOpposition(actor, request.opposition_id);
    return this.deps.testGenerator.generate(request);
  }

  startAttempt(actor: User, testId: string): TestAttempt {
    const view = this.deps.testGenerator.getTest(testId);
    this.deps.oppositions.getOpposition(actor, view.test.opposition_id);
    return this.deps.attempts.startAttempt(testId, actor.id);
  }

  getTestForTaking(actor: User, attemptId: string): TakingView {
    this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.getTestForTaking(attemptId);
  }

  saveAnswer(
    actor: User,
    input: { attempt_id: string; test_question_id: string; selected_option_id: string },
  ): TestAnswer {
    this.requireAttemptOwner(actor, input.attempt_id);
    return this.deps.attempts.saveAnswer(input);
  }

  clearAnswer(
    actor: User,
    input: { attempt_id: string; test_question_id: string },
  ): void {
    this.requireAttemptOwner(actor, input.attempt_id);
    this.deps.attempts.clearAnswer(input);
  }

  submitAttempt(actor: User, attemptId: string): TestAttempt {
    this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.submitAttempt(attemptId);
  }

  getResult(actor: User, attemptId: string): AttemptResult {
    this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.getResult(attemptId);
  }

  getReview(actor: User, attemptId: string): AttemptReview {
    this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.getReview(attemptId);
  }

  getTest(actor: User, testId: string) {
    const view = this.deps.testGenerator.getTest(testId);
    this.deps.oppositions.getOpposition(actor, view.test.opposition_id);
    return view;
  }

  cancelTest(actor: User, testId: string) {
    const view = this.deps.testGenerator.getTest(testId);
    this.requireManageOpposition(actor, view.test.opposition_id);
    return this.deps.testGenerator.cancelTest(testId);
  }

  // --- Guards internos ------------------------------------------------------

  private requireManageOpposition(
    actor: User,
    oppositionId: string | undefined | null,
  ): void {
    requireUser(actor);
    if (!isNonEmptyString(oppositionId)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_REQUIRED]);
    }
    const opposition = this.deps.oppositionRepository.findById(oppositionId);
    if (!opposition) {
      throw new AccessError([AccessErrorCode.OPPOSITION_NOT_FOUND]);
    }
    requireManageWorkspace(
      this.deps.workspaceMembers,
      actor,
      opposition.workspace_id,
    );
  }

  private requireManageQuestion(actor: User, questionId: string): void {
    const question = this.deps.questions.getQuestion(questionId);
    this.requireManageOpposition(actor, question?.opposition_id);
  }

  private requireAttemptOwner(actor: User, attemptId: string): void {
    requireUser(actor);
    const attempt = this.deps.attempts.getAttempt(attemptId);
    // Si el intento tiene dueno y no es el actor, se deniega (resultados ajenos).
    if (attempt && attempt.user_id && attempt.user_id !== actor.id) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
