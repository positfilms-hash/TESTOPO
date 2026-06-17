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
import { requireOpposition } from '../access/oppositionGuards.js';

export interface QuestionGenerationServiceOptions {
  questionService: QuestionService;
  materialRepository: MaterialRepository;
  topicRepository?: TopicRepository;
  provider?: QuestionGenerationProvider;
  runRepository?: GenerationRunRepository;
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
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: QuestionGenerationServiceOptions) {
    this.questionService = options.questionService;
    this.materials = options.materialRepository;
    this.topics = options.topicRepository;
    this.provider = options.provider ?? new MockQuestionGenerationProvider();
    this.runs = options.runRepository ?? new InMemoryGenerationRunRepository();
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
  }): GenerationResult {
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
  }): GenerationResult {
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
  }): GenerationResult {
    return this.generate({ ...input, mode: 'manual_seed' });
  }

  listRuns(): QuestionGenerationRun[] {
    return this.runs.findAll();
  }

  generate(request: GenerateQuestionsRequest): GenerationResult {
    const paramErrors = validateGenerationRequest(request);
    if (paramErrors.length > 0) {
      throw new QuestionGenerationError(paramErrors);
    }

    const material = this.resolveMaterial(request);
    const topic = this.resolveTopic(request);

    const text = this.resolveBaseText(request, material);
    if (!isNonEmptyString(text)) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.CONTENT_REQUIRED,
      ]);
    }

    const candidates = this.provider.generate({
      text,
      reference: request.reference ?? null,
      difficulty: request.difficulty,
      count: request.question_count,
      topic_title: topic?.title ?? null,
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

    // Sin tema vinculado, los borradores quedan en `draft`; con tema, en
    // `pending_review` (SPEC 004, regla central y 9.4).
    const targetStatus: QuestionStatus = topic ? 'pending_review' : 'draft';

    const existingStatements = new Set(
      this.questionService
        .listQuestions()
        .map((question) => normalizeOptionText(question.statement)),
    );

    const created: Question[] = [];
    const errors: QuestionGenerationErrorCode[] = [];

    for (const candidate of candidates) {
      const source = this.buildSource(request, material);

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

      const draft = this.questionService.createQuestion({
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

      const question =
        targetStatus === 'pending_review'
          ? this.questionService.changeStatus(draft.id, 'pending_review')
          : draft;
      created.push(question);
    }

    const run = this.runs.create({
      id: this.generateId(),
      material_id: material?.id ?? null,
      topic_id: topic?.id ?? null,
      mode: request.mode,
      requested_count: request.question_count,
      created_count: created.length,
      status: runStatus(created.length, errors.length),
      errors,
      created_at: this.now(),
    });

    return { run, questions: created };
  }

  // El material es obligatorio salvo en `manual_seed`. Si se proporciona (en
  // cualquier modo) debe existir y no estar `obsolete`.
  private resolveMaterial(request: GenerateQuestionsRequest): Material | null {
    const needsMaterial = request.mode !== 'manual_seed';
    if (!needsMaterial && !request.material_id) {
      return null;
    }
    if (!request.material_id) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.MATERIAL_REQUIRED,
      ]);
    }
    const material = this.materials.findById(request.material_id);
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

  private resolveTopic(request: GenerateQuestionsRequest): Topic | null {
    if (!request.topic_id) {
      return null;
    }
    if (!this.topics) {
      throw new Error(
        'topic_id provided but no topicRepository configured in QuestionGenerationService',
      );
    }
    const topic = this.topics.findById(request.topic_id);
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
  private buildSource(
    request: GenerateQuestionsRequest,
    material: Material | null,
  ): Source {
    if (material) {
      return {
        id: this.generateId(),
        material_id: material.id,
        title: material.title,
        type: material.type,
        reference: request.reference ?? '',
        excerpt:
          request.mode === 'from_material_excerpt'
            ? (request.excerpt ?? null)
            : null,
        status: material.status,
      };
    }
    return {
      id: this.generateId(),
      material_id: null,
      title: 'Material manual (temporal)',
      type: 'other',
      reference: request.reference ?? '',
      excerpt: request.manual_text ? request.manual_text.slice(0, 280) : null,
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
