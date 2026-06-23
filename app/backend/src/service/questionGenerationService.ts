// Generador de borradores de preguntas (SPEC 004).
//
// Orquesta proveedor + validacion formal + guardado, reutilizando el banco de
// preguntas de SPEC 001 (no crea un modelo paralelo). Conecta con el material
// de SPEC 002 (fuente trazable) y el tema de SPEC 003.
//
// Regla central: ninguna pregunta generada queda en `validated`. Si hay tema
// vinculado, las preguntas quedan en `pending_review`; si no, en `draft`.

import { randomUUID } from 'node:crypto';
import type { Material } from '../models/material.js';
import type { Question } from '../models/question.js';
import type { QuestionStatus } from '../models/enums.js';
import type { Source } from '../models/source.js';
import type { Topic } from '../models/topic.js';
import type { GenerationMetadata } from '../models/generationMetadata.js';
import type { QuestionGenerationRun } from '../models/questionGenerationRun.js';
import type { GenerationRunStatus } from '../models/questionGenerationRun.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicRepository } from '../repository/topicRepository.js';
import type { GenerationRunRepository } from '../repository/generationRunRepository.js';
import { InMemoryGenerationRunRepository } from '../repository/inMemoryGenerationRunRepository.js';
import { normalizeOptionText } from '../validation/normalizeOptionText.js';
import { QuestionService } from './questionService.js';
import type {
  GenerateQuestionsRequest,
  GeneratedCandidate,
  QuestionGenerationProvider,
} from '../generation/generationTypes.js';
import {
  QuestionGenerationErrorCode,
} from '../generation/generationErrors.js';
import { QuestionGenerationError } from '../generation/questionGenerationError.js';
import { MockQuestionGenerationProvider } from '../generation/mockQuestionGenerationProvider.js';
import {
  validateGeneratedCandidate,
  validateGenerationRequest,
} from '../generation/validateGeneration.js';
import {
  loadGenerationConfig,
  type GenerationConfig,
} from '../generation/generationConfig.js';
import type { QuestionGenerationFeedbackSummary } from '../models/questionReviewFeedback.js';
import type { QuestionValidationService } from './questionValidationService.js';
import type { QuestionFeedbackService } from './questionFeedbackService.js';
import { requireOpposition } from '../access/oppositionGuards.js';

export interface QuestionGenerationServiceOptions {
  questionService: QuestionService;
  materialRepository: MaterialRepository;
  topicRepository?: TopicRepository;
  provider?: QuestionGenerationProvider;
  runRepository?: GenerationRunRepository;
  /**
   * Validador de calidad (SPEC 005). Si se proporciona, cada pregunta generada
   * pasa por la validacion automatica tras crearse (SPEC 018.4, 22): si hay
   * errores criticos queda en `needs_fix`; si pasa, en `pending_review`.
   * Si se omite, se mantiene el comportamiento de SPEC 004 (sin validacion).
   */
  validationService?: QuestionValidationService;
  /**
   * Resumen de feedback (SPEC 018.4, 15-16). Si se proporciona, se consulta
   * antes de generar y se inyecta en el contexto del proveedor.
   */
  feedbackService?: QuestionFeedbackService;
  /** Limites configurables (SPEC 018.4, 19). */
  config?: GenerationConfig;
  generateId?: () => string;
  now?: () => Date;
}

export interface GenerationResult {
  run: QuestionGenerationRun;
  questions: Question[];
}

export class QuestionGenerationService {
  private readonly questionService: QuestionService;
  private readonly materials: MaterialRepository;
  private readonly topics?: TopicRepository;
  private readonly provider: QuestionGenerationProvider;
  private readonly runs: GenerationRunRepository;
  private readonly validation?: QuestionValidationService;
  private readonly feedback?: QuestionFeedbackService;
  private readonly config: GenerationConfig;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: QuestionGenerationServiceOptions) {
    this.questionService = options.questionService;
    this.materials = options.materialRepository;
    this.topics = options.topicRepository;
    this.provider = options.provider ?? new MockQuestionGenerationProvider();
    this.runs = options.runRepository ?? new InMemoryGenerationRunRepository();
    this.validation = options.validationService;
    this.feedback = options.feedbackService;
    this.config = options.config ?? loadGenerationConfig();
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 13.1 Generar desde el texto del material.
  generateFromMaterial(input: {
    material_id: string;
    topic_id?: string | null;
    difficulty: GenerateQuestionsRequest['difficulty'];
    question_count: number;
    reference?: string | null;
  }): Promise<GenerationResult> {
    return this.generate({ ...input, mode: 'from_material_text' });
  }

  // 13.2 Generar desde un fragmento concreto.
  generateFromExcerpt(input: {
    material_id: string;
    topic_id?: string | null;
    excerpt: string;
    difficulty: GenerateQuestionsRequest['difficulty'];
    question_count: number;
    reference?: string | null;
  }): Promise<GenerationResult> {
    return this.generate({ ...input, mode: 'from_material_excerpt' });
  }

  // 13.3 Generar desde texto pegado manualmente.
  generateFromManualText(input: {
    manual_text: string;
    opposition_id?: string | null;
    topic_id?: string | null;
    difficulty: GenerateQuestionsRequest['difficulty'];
    question_count: number;
    reference?: string | null;
    material_id?: string | null;
  }): Promise<GenerationResult> {
    return this.generate({ ...input, mode: 'manual_seed' });
  }

  async listRuns(): Promise<QuestionGenerationRun[]> {
    return this.runs.findAll();
  }

  async generate(request: GenerateQuestionsRequest): Promise<GenerationResult> {
    const paramErrors = validateGenerationRequest(
      request,
      this.config.max_question_count,
    );
    if (paramErrors.length > 0) {
      throw new QuestionGenerationError(paramErrors);
    }

    const material = await this.resolveMaterial(request);
    const topic = await this.resolveTopic(request);

    const baseText = this.resolveBaseText(request, material);
    if (!isNonEmptyString(baseText)) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.CONTENT_REQUIRED,
      ]);
    }

    // Revision Codex (bloqueante): un fragmento pegado debe PERTENECER al
    // material seleccionado. Si no esta contenido en su `content_text`, no se
    // puede anclar a una fuente real -> se rechaza (evita etiquetar texto
    // inventado con un PDF real y que acabe como pregunta aprobable).
    if (
      request.mode === 'from_material_excerpt' &&
      material &&
      !excerptBelongsToMaterial(request.excerpt ?? '', material.content_text)
    ) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.EXCERPT_NOT_IN_SOURCE,
      ]);
    }
    // Limite de caracteres enviados al proveedor (SPEC 018.4, 19).
    const text = baseText.slice(0, this.config.max_input_chars);

    // Feedback de revisiones anteriores (SPEC 018.4, 15-16) como contexto.
    const previousFeedback = await this.loadFeedback(material, topic, request);

    const candidates = await this.provider.generate({
      text,
      reference: request.reference ?? null,
      difficulty: request.difficulty,
      count: request.question_count,
      topic_title: topic?.title ?? null,
      previous_feedback: previousFeedback,
    });
    if (candidates.length === 0) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.EMPTY_RESULT,
      ]);
    }

    // La oposicion de las preguntas generadas se hereda del material; en modo
    // manual sin material, debe venir en la solicitud (SPEC 010).
    const oppositionId = material
      ? material.opposition_id
      : requireOpposition(request.opposition_id);

    // Sin tema vinculado, los borradores del motor base quedan en `draft`; con
    // tema, en `pending_review` (SPEC 004, regla central y 9.4). Revision Codex:
    // la generacion EXPUESTA desde un fragmento concreto (`from_material_excerpt`,
    // unica via de motor base que ofrece el facade) nunca debe dejar candidatas en
    // `draft` -> queda `pending_review` aunque no haya tema.
    const targetStatus: QuestionStatus =
      topic || request.mode === 'from_material_excerpt'
        ? 'pending_review'
        : 'draft';

    const existingStatements = new Set(
      (await this.questionService.listQuestions()).map((question) =>
        normalizeOptionText(question.statement),
      ),
    );

    const created: Question[] = [];
    const errors: QuestionGenerationErrorCode[] = [];

    for (const candidate of candidates) {
      const source = this.buildSource(request, material, candidate);

      const candidateErrors = validateGeneratedCandidate(candidate, source);
      if (candidateErrors.length > 0) {
        errors.push(...candidateErrors);
        continue;
      }

      const normalized = normalizeOptionText(candidate.statement);
      if (existingStatements.has(normalized)) {
        errors.push(QuestionGenerationErrorCode.DUPLICATE_STATEMENT);
        continue;
      }
      existingStatements.add(normalized);

      const metadata: GenerationMetadata = {
        generator_version: this.provider.version,
        generation_mode: request.mode,
        created_from_material_id: material?.id ?? null,
        created_from_topic_id: topic?.id ?? null,
        requested_difficulty: request.difficulty,
        requested_question_count: request.question_count,
        created_at: this.now(),
      };

      const draft = await this.questionService.createQuestion({
        opposition_id: oppositionId,
        statement: candidate.statement,
        options: candidate.options.map((option, index) => ({
          text: option.text,
          is_correct: option.is_correct,
          order: index,
        })),
        explanation: candidate.explanation,
        source,
        topic: topic?.title ?? request.reference ?? null,
        topic_id: topic?.id ?? null,
        difficulty: candidate.difficulty,
        generation_metadata: metadata,
      });

      const question = await this.applyCreatedStatus(draft, targetStatus);
      created.push(question);
    }

    const run = await this.runs.create({
      id: this.generateId(),
      material_id: material?.id ?? null,
      topic_id: topic?.id ?? null,
      mode: request.mode,
      requested_count: request.question_count,
      created_count: created.length,
      status: runStatus(created.length, errors.length),
      errors,
      provider: this.provider.name,
      model: this.provider.model,
      feedback_used: previousFeedback.length > 0,
      created_at: this.now(),
    });

    return { run, questions: created };
  }

  // Consulta el resumen de feedback para el contexto de la generacion
  // (SPEC 018.4, 15-16). Sin servicio de feedback configurado, no hay contexto.
  private async loadFeedback(
    material: Material | null,
    topic: Topic | null,
    request: GenerateQuestionsRequest,
  ): Promise<QuestionGenerationFeedbackSummary[]> {
    if (!this.feedback) {
      return [];
    }
    return this.feedback.getFeedbackSummaryForGeneration({
      opposition_id: material?.opposition_id ?? request.opposition_id ?? null,
      topic_id: topic?.id ?? null,
      material_id: material?.id ?? null,
    });
  }

  // Decide el estado final de una pregunta recien creada (SPEC 018.4, 22).
  // Con validador y tema vinculado, la pregunta pasa por la validacion
  // automatica: si falla (errores criticos) queda en `needs_fix`; si pasa, en
  // `pending_review`. Sin validador o sin tema se respeta el estado base de
  // SPEC 004 (`draft` sin tema, `pending_review` con tema). Nunca `validated`.
  private async applyCreatedStatus(
    draft: Question,
    baseStatus: QuestionStatus,
  ): Promise<Question> {
    if (this.validation && baseStatus === 'pending_review') {
      const report = await this.validation.validateQuestion(draft.id);
      const finalStatus: QuestionStatus = report.passed
        ? 'pending_review'
        : 'needs_fix';
      return this.questionService.changeStatus(draft.id, finalStatus);
    }
    if (baseStatus === 'pending_review') {
      return this.questionService.changeStatus(draft.id, 'pending_review');
    }
    return draft;
  }

  // El material es obligatorio salvo en `manual_seed`. Si se proporciona (en
  // cualquier modo) debe existir y no estar `obsolete`.
  private async resolveMaterial(
    request: GenerateQuestionsRequest,
  ): Promise<Material | null> {
    const needsMaterial = request.mode !== 'manual_seed';
    if (!needsMaterial && !request.material_id) {
      return null;
    }
    if (!request.material_id) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.MATERIAL_REQUIRED,
      ]);
    }
    const material = await this.materials.findById(request.material_id);
    if (!material) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.MATERIAL_NOT_FOUND,
      ]);
    }
    if (material.status === 'obsolete') {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.MATERIAL_OBSOLETE,
      ]);
    }
    return material;
  }

  private async resolveTopic(
    request: GenerateQuestionsRequest,
  ): Promise<Topic | null> {
    if (!request.topic_id) {
      return null;
    }
    if (!this.topics) {
      throw new Error(
        'topic_id provided but no topicRepository configured in QuestionGenerationService',
      );
    }
    const topic = await this.topics.findById(request.topic_id);
    if (!topic) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.TOPIC_NOT_FOUND,
      ]);
    }
    if (topic.status === 'obsolete') {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.TOPIC_OBSOLETE,
      ]);
    }
    return topic;
  }

  private resolveBaseText(
    request: GenerateQuestionsRequest,
    material: Material | null,
  ): string {
    switch (request.mode) {
      case 'from_material_text':
        return material?.content_text ?? '';
      case 'from_material_excerpt':
        return request.excerpt ?? '';
      case 'manual_seed':
        return request.manual_text ?? '';
    }
  }

  // Construye la fuente trazable de la pregunta. Si hay material, apunta a el;
  // si es texto manual sin material, se marca como fuente manual/temporal.
  // Si la IA aporta fragmento/referencia exactos (SPEC 018.4, 9-11), se
  // conservan; si no, se cae al comportamiento de SPEC 004.
  private buildSource(
    request: GenerateQuestionsRequest,
    material: Material | null,
    candidate?: GeneratedCandidate,
  ): Source {
    const candidateReference = isNonEmptyString(candidate?.source_reference)
      ? candidate.source_reference
      : null;
    const candidateExcerpt = isNonEmptyString(candidate?.source_excerpt)
      ? candidate.source_excerpt
      : null;

    if (material) {
      const fallbackExcerpt =
        request.mode === 'from_material_excerpt' ? (request.excerpt ?? null) : null;
      return {
        id: this.generateId(),
        material_id: material.id,
        title: material.title,
        type: material.type,
        reference: candidateReference ?? request.reference ?? '',
        excerpt: candidateExcerpt ?? fallbackExcerpt,
        status: material.status,
      };
    }
    return {
      id: this.generateId(),
      material_id: null,
      title: 'Material manual (temporal)',
      type: 'other',
      reference: candidateReference ?? request.reference ?? '',
      excerpt:
        candidateExcerpt ??
        (request.manual_text ? request.manual_text.slice(0, 280) : null),
      status: 'active',
    };
  }
}

function runStatus(
  createdCount: number,
  errorCount: number,
): GenerationRunStatus {
  if (createdCount === 0) {
    return 'failed';
  }
  return errorCount > 0 ? 'partial' : 'completed';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// El fragmento debe estar CONTENIDO en el texto del material (modulo espacios y
// mayusculas), igual que el anclaje de SPEC 028-E. Sin `content_text` (escaneo
// fallido, material sin texto) no se puede verificar -> no pertenece.
function excerptBelongsToMaterial(
  excerpt: string,
  contentText: string | null | undefined,
): boolean {
  const needle = normalizeForMatch(excerpt);
  const haystack = normalizeForMatch(contentText ?? '');
  if (needle.length === 0 || haystack.length === 0) {
    return false;
  }
  return haystack.includes(needle);
}

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
