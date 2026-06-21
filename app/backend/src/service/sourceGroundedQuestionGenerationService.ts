// Generacion de preguntas ANCLADA A FUENTES (SPEC 028-E). Refuerza el generador
// existente: en lugar de partir de un PDF entero, genera desde un tema aplicado y
// fragmentos de fuente concretos (secciones 028-C / referencias 028-C / referencia
// del tema aplicado 028-D), conservando la trazabilidad en cada candidata.
//
// Reutiliza el proveedor de generacion (mock/openai), `QuestionService`, la
// validacion automatica (SPEC 005) y el repo de runs. La IA NUNCA crea una
// pregunta `validated`: las candidatas quedan en `pending_review` o `needs_fix`.

import { randomUUID } from 'node:crypto';
import type { Question } from '../models/question.js';
import type { QuestionStatus, Difficulty } from '../models/enums.js';
import type { Source } from '../models/source.js';
import type { GenerationMetadata } from '../models/generationMetadata.js';
import type { QuestionGenerationRun } from '../models/questionGenerationRun.js';
import type { GenerationRunRepository } from '../repository/generationRunRepository.js';
import { InMemoryGenerationRunRepository } from '../repository/inMemoryGenerationRunRepository.js';
import { normalizeOptionText } from '../validation/normalizeOptionText.js';
import { QuestionService } from './questionService.js';
import type { QuestionValidationService } from './questionValidationService.js';
import type {
  GeneratedCandidate,
  QuestionGenerationProvider,
} from '../generation/generationTypes.js';
import { MockQuestionGenerationProvider } from '../generation/mockQuestionGenerationProvider.js';
import { validateGeneratedCandidate } from '../generation/validateGeneration.js';
import { QuestionGenerationError } from '../generation/questionGenerationError.js';
import { QuestionGenerationErrorCode, MAX_QUESTION_COUNT } from '../generation/generationErrors.js';
import type { TopicService } from './topicService.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import {
  SourceRetrievalService,
  type GroundedSource,
} from './sourceRetrievalService.js';

// Limites de la generacion anclada (SPEC 028-E).
export const MAX_QUESTION_SOURCE_CHARS = 20000;
export const MAX_QUESTION_SOURCE_REFERENCES = 20;

export interface SourceGroundedGenerationDeps {
  questionService: QuestionService;
  materials: MaterialRepository;
  topics: TopicService;
  retrieval: SourceRetrievalService;
  provider?: QuestionGenerationProvider;
  validationService?: QuestionValidationService;
  runRepository?: GenerationRunRepository;
  generateId?: () => string;
  now?: () => Date;
}

export interface GenerateFromTopicInput {
  workspace_id?: string | null;
  opposition_id: string;
  topic_id: string;
  difficulty: Difficulty;
  count: number;
  manual_source_selection?: {
    material_section_ids?: string[];
    source_reference_ids?: string[];
  };
}

export interface SourceGroundedResult {
  run: QuestionGenerationRun;
  questions: Question[];
  warnings: string[];
}

export class SourceGroundedQuestionGenerationService {
  private readonly questions: QuestionService;
  private readonly materials: MaterialRepository;
  private readonly topics: TopicService;
  private readonly retrieval: SourceRetrievalService;
  private readonly provider: QuestionGenerationProvider;
  private readonly validation?: QuestionValidationService;
  private readonly runs: GenerationRunRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(deps: SourceGroundedGenerationDeps) {
    this.questions = deps.questionService;
    this.materials = deps.materials;
    this.topics = deps.topics;
    this.retrieval = deps.retrieval;
    this.provider = deps.provider ?? new MockQuestionGenerationProvider();
    this.validation = deps.validationService;
    this.runs = deps.runRepository ?? new InMemoryGenerationRunRepository();
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  // Vista previa de las fuentes disponibles para un tema (para la UI).
  async previewSources(input: {
    workspace_id?: string | null;
    opposition_id: string;
    topic_id: string;
  }): Promise<Awaited<ReturnType<SourceRetrievalService['retrieveForTopic']>>> {
    return this.retrieval.retrieveForTopic(input);
  }

  async generateFromTopic(
    input: GenerateFromTopicInput,
  ): Promise<SourceGroundedResult> {
    if (!isNonEmptyString(input.topic_id)) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.TOPIC_REQUIRED,
      ]);
    }
    if (input.count < 1 || input.count > MAX_QUESTION_COUNT) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.INVALID_COUNT,
      ]);
    }
    // El tema debe existir, ser de la oposicion y estar aplicado (no obsoleto).
    const topic = await this.topics.getTopic(input.topic_id);
    if (!topic || topic.opposition_id !== input.opposition_id) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.TOPIC_NOT_FOUND,
      ]);
    }
    if (topic.status === 'obsolete') {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.TOPIC_OBSOLETE,
      ]);
    }

    const retrieval = await this.retrieval.retrieveForTopic({
      workspace_id: input.workspace_id,
      opposition_id: input.opposition_id,
      topic_id: input.topic_id,
      manual_source_selection: input.manual_source_selection,
    });
    const warnings = [...retrieval.warnings];
    if (retrieval.primary.length === 0) {
      // Sin fuente primaria: no se persiste nada (SPEC 028-E).
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.NO_SOURCES,
      ]);
    }

    // Acota numero de fuentes y caracteres (SPEC 028-E).
    let sources = retrieval.primary;
    if (sources.length > MAX_QUESTION_SOURCE_REFERENCES) {
      sources = sources.slice(0, MAX_QUESTION_SOURCE_REFERENCES);
      warnings.push('Se han limitado las fuentes analizadas por exceder el maximo.');
    }
    sources = sortByConfidence(sources);

    const styleNote =
      retrieval.secondary.length > 0
        ? `Estilo/cobertura de referencia: ${retrieval.secondary.length} test(s) antiguo(s).`
        : null;

    const existingStatements = new Set(
      (await this.questions.listQuestions()).map((q) =>
        normalizeOptionText(q.statement),
      ),
    );

    const created: Question[] = [];
    const errors: QuestionGenerationErrorCode[] = [];
    const usedSectionIds = new Set<string>();
    const usedReferenceIds = new Set<string>();
    let charsBudget = MAX_QUESTION_SOURCE_CHARS;

    // Reparte el numero pedido entre las fuentes (al menos 1 por fuente usada).
    const perSource = distribute(input.count, sources.length);

    for (let i = 0; i < sources.length && created.length < input.count; i++) {
      const source = sources[i];
      const want = perSource[i];
      if (want <= 0) {
        continue;
      }
      const excerpt = (source.excerpt ?? '').slice(0, Math.max(0, charsBudget));
      if (!isNonEmptyString(excerpt)) {
        continue;
      }
      charsBudget -= excerpt.length;

      const material = await this.materials.findById(source.material_id);
      const candidates = await this.provider.generate({
        text: styleNote ? `${excerpt}\n\n[${styleNote}]` : excerpt,
        reference: null,
        difficulty: input.difficulty,
        count: want,
        topic_title: topic.title,
        previous_feedback: [],
      });

      for (const candidate of candidates) {
        if (created.length >= input.count) {
          break;
        }
        const builtSource = this.buildSource(source, material, candidate, topic.title);
        const candidateErrors = validateGeneratedCandidate(candidate, builtSource);
        if (candidateErrors.length > 0) {
          errors.push(...candidateErrors);
          continue;
        }
        // Anclaje obligatorio: la candidata debe conservar al menos un puntero.
        if (
          !source.material_section_id &&
          !source.source_reference_id &&
          !source.topic_source_reference_id
        ) {
          errors.push(QuestionGenerationErrorCode.SOURCE_REQUIRED);
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
          generation_mode: 'from_material_excerpt',
          created_from_material_id: source.material_id,
          created_from_topic_id: topic.id,
          requested_difficulty: input.difficulty,
          requested_question_count: input.count,
          created_at: this.now(),
        };

        const draft = await this.questions.createQuestion({
          opposition_id: input.opposition_id,
          statement: candidate.statement,
          options: candidate.options.map((o, idx) => ({
            text: o.text,
            is_correct: o.is_correct,
            order: idx,
          })),
          explanation: candidate.explanation,
          source: builtSource,
          topic: topic.title,
          topic_id: topic.id,
          difficulty: candidate.difficulty,
          generation_metadata: metadata,
          material_section_id: source.material_section_id,
          source_reference_id: source.source_reference_id,
          topic_source_reference_id: source.topic_source_reference_id,
        });

        const question = await this.finalizeStatus(draft);
        created.push(question);
        if (source.material_section_id) usedSectionIds.add(source.material_section_id);
        if (source.source_reference_id) usedReferenceIds.add(source.source_reference_id);
      }
    }

    const run = await this.runs.create({
      id: this.generateId(),
      material_id: null,
      topic_id: topic.id,
      mode: 'from_material_excerpt',
      requested_count: input.count,
      created_count: created.length,
      status: created.length === 0 ? 'failed' : errors.length > 0 ? 'partial' : 'completed',
      errors,
      provider: this.provider.name,
      model: this.provider.model,
      feedback_used: false,
      source_strategy: retrieval.strategy,
      source_reference_ids: [...usedReferenceIds],
      material_section_ids: [...usedSectionIds],
      created_at: this.now(),
    });

    return { run, questions: created, warnings };
  }

  // Estado final: pasa la validacion automatica; pasa -> pending_review, falla
  // critico -> needs_fix. NUNCA validated (SPEC 028-E).
  private async finalizeStatus(draft: Question): Promise<Question> {
    if (this.validation) {
      const report = await this.validation.validateQuestion(draft.id);
      const status: QuestionStatus = report.passed ? 'pending_review' : 'needs_fix';
      return this.questions.changeStatus(draft.id, status);
    }
    return this.questions.changeStatus(draft.id, 'pending_review');
  }

  private buildSource(
    source: GroundedSource,
    material: { id: string; title: string; type: Source['type']; status: Source['status'] } | null,
    candidate: GeneratedCandidate,
    topicTitle: string,
  ): Source {
    return {
      id: this.generateId(),
      material_id: source.material_id,
      title: material?.title ?? 'Fuente del tema',
      type: material?.type ?? 'other',
      reference:
        (isNonEmptyString(candidate.source_reference) ? candidate.source_reference : null) ??
        topicTitle,
      // Trazabilidad fiable: solo se conserva el excerpt de la IA si esta
      // CONTENIDO en el fragmento recuperado (la IA genera a partir de ese
      // texto). Si la IA devuelve una cita inventada, se guarda el fragmento
      // recuperado en su lugar (SPEC 028-E, recomendacion de la review).
      excerpt: groundedExcerpt(candidate.source_excerpt, source.excerpt),
      status: material?.status ?? 'active',
    };
  }
}

// Devuelve el excerpt de la IA solo si esta contenido (modulo
// espacios/mayusculas) en el texto recuperado; si no, devuelve el recuperado.
// Exportado para test directo (es la garantia de trazabilidad: nunca se guarda
// una cita inventada por la IA).
export function groundedExcerpt(
  aiExcerpt: string | null | undefined,
  retrieved: string | null | undefined,
): string | null {
  const retrievedText = isNonEmptyString(retrieved) ? retrieved.trim() : null;
  if (isNonEmptyString(aiExcerpt) && retrievedText) {
    const needle = normalizeForMatch(aiExcerpt);
    if (needle.length > 0 && normalizeForMatch(retrievedText).includes(needle)) {
      return aiExcerpt.trim();
    }
  }
  return retrievedText;
}

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Reparte `total` candidatas entre `n` fuentes lo mas uniformemente posible.
function distribute(total: number, n: number): number[] {
  if (n <= 0) {
    return [];
  }
  const base = Math.floor(total / n);
  let rest = total % n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(base + (rest > 0 ? 1 : 0));
    if (rest > 0) rest -= 1;
  }
  return out;
}

function sortByConfidence(sources: GroundedSource[]): GroundedSource[] {
  return [...sources].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
