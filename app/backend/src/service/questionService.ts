// Operaciones minimas del banco de preguntas (SPEC 001, seccion 9).
//
// El servicio coordina repositorio y validacion, pero no contiene la logica de
// las reglas de negocio: esa vive en `validation/validateQuestion`. El reloj y
// el generador de ids son inyectables para facilitar los tests.

import { randomUUID } from 'node:crypto';
import type { Difficulty } from '../models/enums.js';
import type { Option } from '../models/option.js';
import type { Question } from '../models/question.js';
import type { Source } from '../models/source.js';
import { QUESTION_STATUSES, type QuestionStatus } from '../models/enums.js';
import type {
  QuestionFilter,
  QuestionRepository,
} from '../repository/questionRepository.js';
import { validateQuestion } from '../validation/validateQuestion.js';
import { QuestionValidationError } from './questionValidationError.js';

export interface OptionInput {
  id?: string;
  text: string;
  is_correct?: boolean;
  order?: number;
}

export interface CreateQuestionInput {
  statement?: string;
  options?: OptionInput[];
  explanation?: string | null;
  source?: Source | null;
  topic?: string | null;
  difficulty?: Difficulty | null;
}

export interface EditQuestionInput {
  statement?: string;
  options?: OptionInput[];
  explanation?: string | null;
  source?: Source | null;
  topic?: string | null;
  difficulty?: Difficulty | null;
}

export interface QuestionServiceOptions {
  generateId?: () => string;
  now?: () => Date;
}

export class QuestionService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly repository: QuestionRepository,
    options: QuestionServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 9.1 Crear pregunta. Siempre nace en `draft` y no exige cumplir todas las
  // reglas de validacion todavia.
  createQuestion(input: CreateQuestionInput): Question {
    const timestamp = this.now();
    const options = this.buildOptions(input.options ?? []);
    const question: Question = {
      id: this.generateId(),
      statement: input.statement ?? '',
      options,
      correct_answer: deriveCorrectAnswer(options),
      explanation: input.explanation ?? null,
      source: input.source ?? null,
      topic: input.topic ?? null,
      difficulty: input.difficulty ?? null,
      status: 'draft',
      created_at: timestamp,
      updated_at: timestamp,
    };
    return this.repository.create(question);
  }

  // 9.2 Listar preguntas, con filtros opcionales sencillos.
  listQuestions(filter: QuestionFilter = {}): Question[] {
    return this.repository.findAll(filter);
  }

  // 9.3 Ver una pregunta por id.
  getQuestion(id: string): Question | null {
    return this.repository.findById(id);
  }

  // 9.4 Editar pregunta. Actualiza siempre `updated_at`. Pasar `null` en un
  // campo opcional lo limpia; omitirlo lo deja intacto.
  editQuestion(id: string, changes: EditQuestionInput): Question {
    const existing = this.requireQuestion(id);
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
  changeStatus(id: string, newStatus: QuestionStatus): Question {
    if (!QUESTION_STATUSES.includes(newStatus)) {
      throw new Error(`Unknown question status: ${newStatus}`);
    }
    const existing = this.requireQuestion(id);

    if (newStatus === 'validated') {
      const result = validateQuestion(existing);
      if (!result.valid) {
        throw new QuestionValidationError(result.errors);
      }
    }

    const updated: Question = {
      ...existing,
      status: newStatus,
      updated_at: this.now(),
    };
    return this.repository.save(updated);
  }

  private requireQuestion(id: string): Question {
    const question = this.repository.findById(id);
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
