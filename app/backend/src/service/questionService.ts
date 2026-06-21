// Operaciones minimas del banco de preguntas (SPEC 001, seccion 9).
//
// El servicio coordina repositorio y validacion, pero no contiene la logica de
// las reglas de negocio: esa vive en `validation/validateQuestion`. El reloj y
// el generador de ids son inyectables para facilitar los tests.

import { randomUUID } from 'node:crypto';
import type {
  Difficulty,
  MaterialStatus,
  TopicStatus,
} from '../models/enums.js';
import type { Option } from '../models/option.js';
import type { Question } from '../models/question.js';
import type { Source } from '../models/source.js';
import type { GenerationMetadata } from '../models/generationMetadata.js';
import { QUESTION_STATUSES, type QuestionStatus } from '../models/enums.js';
import type {
  QuestionFilter,
  QuestionRepository,
} from '../repository/questionRepository.js';
import { validateQuestion } from '../validation/validateQuestion.js';
import { ValidationErrorCode } from '../validation/errors.js';
import { QuestionValidationError } from './questionValidationError.js';
import {
  assertSameOpposition,
  requireOpposition,
} from '../access/oppositionGuards.js';

export interface OptionInput {
  id?: string;
  text: string;
  is_correct?: boolean;
  order?: number;
}

export interface CreateQuestionInput {
  opposition_id?: string;
  statement?: string;
  options?: OptionInput[];
  explanation?: string | null;
  source?: Source | null;
  topic?: string | null;
  topic_id?: string | null;
  difficulty?: Difficulty | null;
  generation_metadata?: GenerationMetadata | null;
  // Punteros de fuente concretos (SPEC 028-E). Aditivos.
  material_section_id?: string | null;
  source_reference_id?: string | null;
  topic_source_reference_id?: string | null;
}

export interface EditQuestionInput {
  statement?: string;
  options?: OptionInput[];
  explanation?: string | null;
  source?: Source | null;
  topic?: string | null;
  topic_id?: string | null;
  difficulty?: Difficulty | null;
}

export interface QuestionServiceOptions {
  generateId?: () => string;
  now?: () => Date;
  /**
   * Resolutor opcional del estado de un material registrado (SPEC 002). Si se
   * proporciona, una pregunta cuya fuente apunte (`source.material_id`) a un
   * material `obsolete` no podra pasar a `validated`. Devuelve `null` si el
   * material no existe. Se inyecta como funcion para no acoplar el banco de
   * preguntas al repositorio de material.
   */
  resolveMaterialStatus?: (
    materialId: string,
  ) => Promise<MaterialStatus | null>;
  /**
   * Resolutor opcional del estado de un tema registrado (SPEC 003). Si se
   * proporciona, una pregunta vinculada (`topic_id`) a un tema `obsolete` no
   * podra pasar a `validated`. Devuelve `null` si el tema no existe.
   */
  resolveTopicStatus?: (topicId: string) => Promise<TopicStatus | null>;
  /**
   * Resolutor opcional de la oposicion de un material (SPEC 010). Si se
   * proporciona, no se puede crear una pregunta cuya fuente apunte a material
   * de otra oposicion. Devuelve `null` si el material no existe.
   */
  resolveMaterialOpposition?: (materialId: string) => Promise<string | null>;
  /** Resolutor opcional de la oposicion de un tema (SPEC 010). */
  resolveTopicOpposition?: (topicId: string) => Promise<string | null>;
}

export class QuestionService {
  private readonly generateId: () => string;
  private readonly now: () => Date;
  private readonly resolveMaterialStatus?: (
    materialId: string,
  ) => Promise<MaterialStatus | null>;
  private readonly resolveTopicStatus?: (
    topicId: string,
  ) => Promise<TopicStatus | null>;
  private readonly resolveMaterialOpposition?: (
    materialId: string,
  ) => Promise<string | null>;
  private readonly resolveTopicOpposition?: (
    topicId: string,
  ) => Promise<string | null>;

  constructor(
    private readonly repository: QuestionRepository,
    options: QuestionServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
    this.resolveMaterialStatus = options.resolveMaterialStatus;
    this.resolveTopicStatus = options.resolveTopicStatus;
    this.resolveMaterialOpposition = options.resolveMaterialOpposition;
    this.resolveTopicOpposition = options.resolveTopicOpposition;
  }

  // 9.1 Crear pregunta. Siempre nace en `draft` y no exige cumplir todas las
  // reglas de validacion todavia.
  async createQuestion(input: CreateQuestionInput): Promise<Question> {
    const oppositionId = requireOpposition(input.opposition_id);
    // Integridad: la fuente/material y el tema deben ser de la misma oposicion.
    const materialId = input.source?.material_id;
    if (materialId && this.resolveMaterialOpposition) {
      const materialOpposition = await this.resolveMaterialOpposition(materialId);
      if (materialOpposition) {
        assertSameOpposition(materialOpposition, oppositionId);
      }
    }
    if (input.topic_id && this.resolveTopicOpposition) {
      const topicOpposition = await this.resolveTopicOpposition(input.topic_id);
      if (topicOpposition) {
        assertSameOpposition(topicOpposition, oppositionId);
      }
    }

    const timestamp = this.now();
    const options = this.buildOptions(input.options ?? []);
    const question: Question = {
      id: this.generateId(),
      opposition_id: oppositionId,
      statement: input.statement ?? '',
      options,
      correct_answer: deriveCorrectAnswer(options),
      explanation: input.explanation ?? null,
      source: input.source ?? null,
      topic: input.topic ?? null,
      topic_id: input.topic_id ?? null,
      difficulty: input.difficulty ?? null,
      generation_metadata: input.generation_metadata ?? null,
      material_section_id: input.material_section_id ?? null,
      source_reference_id: input.source_reference_id ?? null,
      topic_source_reference_id: input.topic_source_reference_id ?? null,
      status: 'draft',
      created_at: timestamp,
      updated_at: timestamp,
    };
    return this.repository.create(question);
  }

  // 9.2 Listar preguntas, con filtros opcionales sencillos.
  async listQuestions(filter: QuestionFilter = {}): Promise<Question[]> {
    return this.repository.findAll(filter);
  }

  // 9.3 Ver una pregunta por id.
  async getQuestion(id: string): Promise<Question | null> {
    return this.repository.findById(id);
  }

  // 9.4 Editar pregunta. Actualiza siempre `updated_at`. Pasar `null` en un
  // campo opcional lo limpia; omitirlo lo deja intacto.
  async editQuestion(id: string, changes: EditQuestionInput): Promise<Question> {
    const existing = await this.requireQuestion(id);
    const options = changes.options
      ? this.buildOptions(changes.options)
      : existing.options;
    const updated: Question = {
      ...existing,
      statement: changes.statement ?? existing.statement,
      options,
      correct_answer: deriveCorrectAnswer(options),
      explanation:
        changes.explanation !== undefined
          ? changes.explanation
          : existing.explanation,
      source: changes.source !== undefined ? changes.source : existing.source,
      topic: changes.topic !== undefined ? changes.topic : existing.topic,
      topic_id:
        changes.topic_id !== undefined ? changes.topic_id : existing.topic_id,
      difficulty:
        changes.difficulty !== undefined
          ? changes.difficulty
          : existing.difficulty,
      updated_at: this.now(),
    };
    return this.repository.save(updated);
  }

  // 9.5 Cambiar estado. Si el destino es `validated`, se ejecuta la validacion
  // completa y, si falla, se rechaza el cambio con errores claros.
  async changeStatus(id: string, newStatus: QuestionStatus): Promise<Question> {
    if (!QUESTION_STATUSES.includes(newStatus)) {
      throw new Error(`Unknown question status: ${newStatus}`);
    }
    const existing = await this.requireQuestion(id);

    if (newStatus === 'validated') {
      const result = validateQuestion(existing);
      if (!result.valid) {
        throw new QuestionValidationError(result.errors);
      }
      await this.assertSourceMaterialUsable(existing);
      await this.assertTopicUsable(existing);
    }

    const updated: Question = {
      ...existing,
      status: newStatus,
      updated_at: this.now(),
    };
    return this.repository.save(updated);
  }

  // SPEC 002 (reforzado en SPEC 004): si la fuente esta vinculada a un material
  // registrado (`source.material_id`), la pregunta no puede validarse si el
  // material no se puede resolver o esta `obsolete`. La trazabilidad fuerte
  // exige poder confirmar que el material sigue vigente.
  private async assertSourceMaterialUsable(question: Question): Promise<void> {
    const materialId = question.source?.material_id;
    if (!materialId) {
      return;
    }
    const status = this.resolveMaterialStatus
      ? await this.resolveMaterialStatus(materialId)
      : null;
    if (status === null || status === 'obsolete') {
      throw new QuestionValidationError([
        ValidationErrorCode.SOURCE_MATERIAL_OBSOLETE,
      ]);
    }
  }

  // SPEC 003 (reforzado en SPEC 004): si la pregunta esta vinculada (`topic_id`)
  // a un tema registrado, no puede validarse si el tema no se puede resolver o
  // esta `obsolete`.
  private async assertTopicUsable(question: Question): Promise<void> {
    const topicId = question.topic_id;
    if (!topicId) {
      return;
    }
    const status = this.resolveTopicStatus
      ? await this.resolveTopicStatus(topicId)
      : null;
    if (status === null || status === 'obsolete') {
      throw new QuestionValidationError([ValidationErrorCode.TOPIC_OBSOLETE]);
    }
  }

  private async requireQuestion(id: string): Promise<Question> {
    const question = await this.repository.findById(id);
    if (!question) {
      throw new Error(`Question not found: ${id}`);
    }
    return question;
  }

  private buildOptions(options: OptionInput[]): Option[] {
    return options.map((option, index) => ({
      id: option.id ?? this.generateId(),
      text: option.text,
      is_correct: option.is_correct ?? false,
      order: option.order ?? index,
    }));
  }
}

// `correct_answer` se deriva de la unica opcion marcada como correcta para
// mantener una sola fuente de verdad (`is_correct`). Si no hay exactamente una,
// queda `null` y la validacion lo bloqueara al intentar pasar a `validated`.
function deriveCorrectAnswer(options: Option[]): string | null {
  const correct = options.filter((option) => option.is_correct);
  return correct.length === 1 ? correct[0].id : null;
}
