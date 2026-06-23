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
import type { ExamPatternLearningRepository } from '../repository/examPatternLearningRepository.js';
import type { AIErrorMemoryService } from './aiErrorMemoryService.js';
import type {
  AIQuestionQualityScore,
  QuestionStyleProfile,
} from '../models/examPatternLearning.js';
import {
  assessCopyRisk,
  scoreCandidateQuality,
  formatStyleRules,
} from '../analysis/examPatternMatching.js';

// Limites de la generacion anclada (SPEC 028-E).
export const MAX_QUESTION_SOURCE_CHARS = 20000;
export const MAX_QUESTION_SOURCE_REFERENCES = 20;
// SPEC 028-F: umbrales de anti-copia y calidad (configurables).
export const COPY_RISK_THRESHOLD = 0.85;
export const LOW_QUALITY_THRESHOLD = 0.5;

export interface SourceGroundedGenerationDeps {
  questionService: QuestionService;
  materials: MaterialRepository;
  topics: TopicService;
  retrieval: SourceRetrievalService;
  provider?: QuestionGenerationProvider;
  validationService?: QuestionValidationService;
  runRepository?: GenerationRunRepository;
  // SPEC 028-F: aprendizaje adaptativo (perfil de estilo + memoria de errores +
  // anti-copia + quality scores). Opcionales: sin ellos, se comporta como 028-E.
  learning?: ExamPatternLearningRepository;
  errorMemory?: AIErrorMemoryService;
  copyRiskThreshold?: number;
  lowQualityThreshold?: number;
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
  /** SPEC 028-F: usar el perfil de estilo activo (defecto true). */
  use_style_profile?: boolean;
  /** SPEC 028-F: usar la memoria de errores (defecto true). */
  use_error_memory?: boolean;
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
  private readonly learning?: ExamPatternLearningRepository;
  private readonly errorMemory?: AIErrorMemoryService;
  private readonly copyRiskThreshold: number;
  private readonly lowQualityThreshold: number;
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
    this.learning = deps.learning;
    this.errorMemory = deps.errorMemory;
    this.copyRiskThreshold = deps.copyRiskThreshold ?? COPY_RISK_THRESHOLD;
    this.lowQualityThreshold = deps.lowQualityThreshold ?? LOW_QUALITY_THRESHOLD;
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

    // SPEC 028-F: contexto ADAPTATIVO (perfil de estilo activo + memoria de
    // errores). NO es fuente factual; orienta formato/redaccion. Toggles Yes/No.
    const useStyle = input.use_style_profile !== false;
    const useMemory = input.use_error_memory !== false;
    const profile: QuestionStyleProfile | null =
      this.learning && useStyle
        ? await this.learning.getActiveProfile(input.opposition_id)
        : null;
    const styleRules = profile ? formatStyleRules(profile.rules) : [];
    const fingerprints = profile?.fingerprints ?? [];
    let avoidRules: string[] = [];
    if (this.errorMemory && useMemory) {
      // SPEC 028-F (regla central): la memoria se reconstruye desde el feedback
      // ACTUAL antes de generar, para que el aprendizaje sea automatico (no
      // depende de un boton manual). Acotada a esta oposicion + tema.
      await this.errorMemory.refresh(input.opposition_id, {
        topics: [{ id: input.topic_id }],
        workspaceId: input.workspace_id ?? null,
      });
      avoidRules = await this.errorMemory.getAvoidInstructions(
        input.opposition_id,
        { topic_id: input.topic_id },
      );
    }
    const adaptiveUsed = styleRules.length > 0 || avoidRules.length > 0;
    if (profile) {
      warnings.push(`Perfil de estilo v${profile.version} aplicado.`);
    }
    const pendingScores: AIQuestionQualityScore[] = [];

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
        style_rules: styleRules,
        avoid_rules: avoidRules,
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

        // Revision Codex (bloqueante): la candidata se crea en `draft` y luego se
        // transiciona; si un fallo (p. ej. Supabase) interrumpe esa transicion,
        // NO debe quedar un `draft` huerfano ni abortar el run entero. Cada
        // candidata va en su propio try/catch: el fallo se registra, el draft se
        // remedia a `needs_fix` (nunca queda en `draft`), y el run continua y se
        // crea siempre con estado visible.
        let draft: Question | null = null;
        try {
          draft = await this.questions.createQuestion({
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

          // SPEC 028-F: anti-copia + calidad SOLO en modo adaptativo (con
          // `learning`). Sin el, comportamiento 028-E identico (finalizeStatus).
          let question: Question;
          if (this.learning) {
            const copy = assessCopyRisk(
              candidate.statement,
              fingerprints,
              this.copyRiskThreshold,
            );
            const quality = scoreCandidateQuality({
              grounded: isNonEmptyString(builtSource.excerpt),
              option_count: candidate.options.length,
              statement_length: candidate.statement.length,
              single_correct:
                candidate.options.filter((o) => o.is_correct).length === 1,
              requested_difficulty: input.difficulty,
              candidate_difficulty: candidate.difficulty ?? null,
              rules: profile?.rules ?? null,
            });
            const qualityWarnings = [...quality.warnings];
            if (copy.risk) {
              qualityWarnings.push(
                `copying_risk: parecido alto a un examen antiguo (${copy.score}).`,
              );
            }
            // Riesgo de copia o calidad baja: NUNCA pending_review en silencio.
            if (copy.risk) {
              question = await this.questions.changeStatus(draft.id, 'needs_fix');
              warnings.push(
                'Una candidata se marcó needs_fix por posible copia de un examen antiguo (copying_risk).',
              );
            } else if (quality.overall < this.lowQualityThreshold) {
              question = await this.questions.changeStatus(draft.id, 'needs_fix');
              warnings.push(
                'Una candidata se marcó needs_fix por baja puntuación de calidad.',
              );
            } else {
              question = await this.finalizeStatus(draft);
            }
            pendingScores.push({
              id: this.generateId(),
              question_id: question.id,
              run_id: null,
              workspace_id: input.workspace_id ?? null,
              opposition_id: input.opposition_id,
              source_grounding: quality.source_grounding,
              exam_style_similarity: quality.exam_style_similarity,
              clarity: quality.clarity,
              single_answer_confidence: quality.single_answer_confidence,
              difficulty_fit: quality.difficulty_fit,
              overall: quality.overall,
              warnings: qualityWarnings,
              created_at: this.now(),
              updated_at: this.now(),
            });
          } else {
            question = await this.finalizeStatus(draft);
          }
          created.push(question);

          if (source.material_section_id) usedSectionIds.add(source.material_section_id);
          if (source.source_reference_id) usedReferenceIds.add(source.source_reference_id);
        } catch {
          errors.push(QuestionGenerationErrorCode.PERSIST_FAILED);
          warnings.push(
            'Una candidata no se pudo finalizar de forma fiable y quedó marcada para corrección.',
          );
          // Remedia el borrador huerfano: nunca debe quedar en `draft`.
          if (draft) {
            try {
              await this.questions.changeStatus(draft.id, 'needs_fix');
            } catch {
              // Best-effort: si tampoco se puede, queda registrado en el run.
            }
          }
        }
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
      // SPEC 028-F: registra el uso de contexto adaptativo y el perfil aplicado.
      feedback_used: avoidRules.length > 0,
      source_strategy: retrieval.strategy,
      source_reference_ids: [...usedReferenceIds],
      material_section_ids: [...usedSectionIds],
      style_profile_id: profile?.id ?? null,
      adaptive_context_used: adaptiveUsed,
      created_at: this.now(),
    });

    // Persiste las quality scores con el run ya creado (SPEC 028-F).
    if (this.learning) {
      for (const score of pendingScores) {
        await this.learning.createQualityScore({ ...score, run_id: run.id });
      }
    }

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
