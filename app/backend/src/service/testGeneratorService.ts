// Generador de tests de practica (SPEC 007).
//
// Selecciona preguntas del banco (SPEC 001) para construir tests. Regla central:
// SOLO preguntas `validated`; ademas excluye las vinculadas a fuente, material
// (SPEC 002) o tema (SPEC 003) obsoletos. No altera el estado de las preguntas.
//
// La aleatoriedad usa un RNG inyectable (para tests deterministas) y admite una
// `random_seed` reproducible que se guarda en los filtros del test.

import { randomUUID } from 'node:crypto';
import type { Difficulty } from '../models/enums.js';
import { isRequestedDifficulty } from '../models/generationMetadata.js';
import type { Question } from '../models/question.js';
import {
  isTestMode,
  type PracticeTest,
  type TestDifficulty,
  type TestMode,
} from '../models/practiceTest.js';
import type { PracticeTestQuestion } from '../models/practiceTestQuestion.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicRepository } from '../repository/topicRepository.js';
import type { TestRepository } from '../repository/testRepository.js';
import type { TestQuestionRepository } from '../repository/testQuestionRepository.js';
import { InMemoryTestRepository } from '../repository/inMemoryTestRepository.js';
import { InMemoryTestQuestionRepository } from '../repository/inMemoryTestQuestionRepository.js';
import { QuestionService } from './questionService.js';
import {
  DEFAULT_TEST_QUESTION_COUNT,
  MAX_TEST_QUESTION_COUNT,
  MIN_TEST_QUESTION_COUNT,
  TestGenerationErrorCode,
} from '../test/testErrors.js';
import { TestGenerationError } from '../test/testGenerationError.js';
import {
  assertSameOpposition,
  requireOpposition,
} from '../access/oppositionGuards.js';

export interface GenerateTestRequest {
  mode: TestMode;
  /** Oposicion del test (SPEC 010). Obligatorio. */
  opposition_id?: string;
  title?: string;
  question_count?: number;
  topic_id?: string | null;
  difficulty?: TestDifficulty | null;
  random_seed?: number | null;
}

export interface GeneratedTest {
  test: PracticeTest;
  questions: PracticeTestQuestion[];
}

// Vista para el alumno: NO incluye `is_correct` ni `correct_answer` (SPEC 007,
// 11.5: la respuesta correcta no debe mostrarse durante la realizacion).
export interface StudentOptionView {
  id: string;
  text: string;
  order: number;
}
export interface StudentQuestionView {
  question_id: string;
  /** Id de la pregunta dentro del test; necesario para registrar la respuesta. */
  test_question_id: string;
  order: number;
  statement: string;
  options: StudentOptionView[];
  topic: string | null;
  topic_id: string | null;
  difficulty: Difficulty | null;
}
export interface TestView {
  test: PracticeTest;
  questions: StudentQuestionView[];
}

export interface TestGeneratorServiceOptions {
  questionService: QuestionService;
  topicRepository: TopicRepository;
  materialRepository: MaterialRepository;
  testRepository?: TestRepository;
  testQuestionRepository?: TestQuestionRepository;
  generateId?: () => string;
  now?: () => Date;
  random?: () => number;
}

export class TestGeneratorService {
  private readonly questions: QuestionService;
  private readonly topics: TopicRepository;
  private readonly materials: MaterialRepository;
  private readonly tests: TestRepository;
  private readonly testQuestions: TestQuestionRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;
  private readonly random: () => number;

  constructor(options: TestGeneratorServiceOptions) {
    this.questions = options.questionService;
    this.topics = options.topicRepository;
    this.materials = options.materialRepository;
    this.tests = options.testRepository ?? new InMemoryTestRepository();
    this.testQuestions =
      options.testQuestionRepository ?? new InMemoryTestQuestionRepository();
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  createRandomTest(input: {
    opposition_id?: string;
    question_count?: number;
    title?: string;
  }): GeneratedTest {
    return this.generate({ ...input, mode: 'random' });
  }

  createTestByTopic(input: {
    opposition_id?: string;
    topic_id: string;
    question_count?: number;
    title?: string;
  }): GeneratedTest {
    return this.generate({ ...input, mode: 'by_topic' });
  }

  createTestByDifficulty(input: {
    opposition_id?: string;
    difficulty: TestDifficulty;
    question_count?: number;
    title?: string;
  }): GeneratedTest {
    return this.generate({ ...input, mode: 'by_difficulty' });
  }

  createMixedTest(input: {
    opposition_id?: string;
    topic_id?: string | null;
    difficulty?: TestDifficulty | null;
    question_count?: number;
    title?: string;
  }): GeneratedTest {
    return this.generate({ ...input, mode: 'mixed' });
  }

  generate(request: GenerateTestRequest): GeneratedTest {
    const oppositionId = requireOpposition(request.opposition_id);
    const count = request.question_count ?? DEFAULT_TEST_QUESTION_COUNT;
    this.validateRequest(request, count);

    const topic = this.resolveTopicFilter(request.topic_id ?? null);
    if (topic) {
      // El tema debe pertenecer a la oposicion del test (SPEC 010, 17.1).
      assertSameOpposition(topic.opposition_id, oppositionId);
    }
    const difficulty = request.difficulty ?? null;

    // Solo preguntas de esta oposicion (pool por oposicion, SPEC 010, 17.3).
    let pool = this.eligibleQuestions().filter(
      (q) => q.opposition_id === oppositionId,
    );
    if (request.topic_id) {
      pool = pool.filter((q) => q.topic_id === request.topic_id);
    }
    if (difficulty && difficulty !== 'mixed') {
      pool = pool.filter((q) => q.difficulty === difficulty);
    }

    const rng = createRng(request.random_seed ?? null, this.random);
    const selected =
      difficulty === 'mixed'
        ? this.selectMixed(pool, count, rng)
        : sample(pool, count, rng);

    if (selected.length < count) {
      throw new TestGenerationError([
        TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
      ]);
    }
    // Garantias defensivas (la seleccion sin reemplazo ya las cumple).
    if (new Set(selected.map((q) => q.id)).size !== selected.length) {
      throw new TestGenerationError([
        TestGenerationErrorCode.DUPLICATE_QUESTION_NOT_ALLOWED,
      ]);
    }
    if (selected.some((q) => q.status !== 'validated')) {
      throw new TestGenerationError([
        TestGenerationErrorCode.ONLY_VALIDATED_QUESTIONS_ALLOWED,
      ]);
    }

    const timestamp = this.now();
    const test = this.tests.create({
      id: this.generateId(),
      opposition_id: oppositionId,
      title: request.title?.trim() || defaultTitle(request.mode),
      mode: request.mode,
      status: 'created',
      question_count: count,
      filters: {
        topic_id: request.topic_id ?? null,
        difficulty,
        question_count: count,
        random_seed: request.random_seed ?? null,
      },
      created_at: timestamp,
      updated_at: timestamp,
    });

    const questions = selected.map((question, index) =>
      this.testQuestions.create({
        id: this.generateId(),
        test_id: test.id,
        question_id: question.id,
        order: index,
        options_order: shuffle(
          question.options.map((option) => option.id),
          rng,
        ),
        created_at: timestamp,
      }),
    );

    return { test, questions };
  }

  // 11.5 Consultar test (vista de alumno, sin respuestas correctas).
  getTest(testId: string): TestView {
    const test = this.tests.findById(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    const questions = this.testQuestions
      .findByTest(testId)
      .map((item) => this.toStudentView(item))
      .filter((view): view is StudentQuestionView => view !== null);
    return { test, questions };
  }

  // 11.6 Cancelar test. No borra preguntas ni banco.
  cancelTest(testId: string): PracticeTest {
    const test = this.tests.findById(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    return this.tests.save({
      ...test,
      status: 'cancelled',
      updated_at: this.now(),
    });
  }

  private validateRequest(request: GenerateTestRequest, count: number): void {
    const errors: TestGenerationErrorCode[] = [];
    if (!Number.isInteger(count) || count < MIN_TEST_QUESTION_COUNT) {
      errors.push(TestGenerationErrorCode.INVALID_QUESTION_COUNT);
    } else if (count > MAX_TEST_QUESTION_COUNT) {
      errors.push(TestGenerationErrorCode.MAX_QUESTION_COUNT_EXCEEDED);
    }
    if (!isTestMode(request.mode)) {
      errors.push(TestGenerationErrorCode.INVALID_MODE);
    }
    if (
      request.difficulty !== null &&
      request.difficulty !== undefined &&
      !isRequestedDifficulty(request.difficulty)
    ) {
      errors.push(TestGenerationErrorCode.INVALID_DIFFICULTY);
    }
    if (errors.length > 0) {
      throw new TestGenerationError(errors);
    }
  }

  private resolveTopicFilter(topicId: string | null) {
    if (!topicId) {
      return null;
    }
    const topic = this.topics.findById(topicId);
    if (!topic) {
      throw new TestGenerationError([TestGenerationErrorCode.TOPIC_NOT_FOUND]);
    }
    if (topic.status === 'obsolete') {
      throw new TestGenerationError([TestGenerationErrorCode.TOPIC_OBSOLETE]);
    }
    return topic;
  }

  // Preguntas elegibles: validadas y no vinculadas a fuente/material/tema
  // obsoleto (ni a material/tema inexistente, por trazabilidad).
  private eligibleQuestions(): Question[] {
    return this.questions
      .listQuestions()
      .filter((question) => this.isEligible(question));
  }

  private isEligible(question: Question): boolean {
    if (question.status !== 'validated') {
      return false;
    }
    const source = question.source;
    if (source) {
      if (source.status === 'obsolete') {
        return false;
      }
      if (source.material_id) {
        const material = this.materials.findById(source.material_id);
        if (!material || material.status === 'obsolete') {
          return false;
        }
      }
    }
    if (question.topic_id) {
      const topic = this.topics.findById(question.topic_id);
      if (!topic || topic.status === 'obsolete') {
        return false;
      }
    }
    return true;
  }

  // Distribucion mixta 40/40/20; si falta de una dificultad, completa con las
  // disponibles para alcanzar el numero solicitado (SPEC 007, 10.6).
  private selectMixed(
    pool: Question[],
    count: number,
    rng: () => number,
  ): Question[] {
    const easyN = Math.round(count * 0.4);
    const mediumN = Math.round(count * 0.4);
    const hardN = Math.max(0, count - easyN - mediumN);

    const picked: Question[] = [
      ...sample(byDifficulty(pool, 'easy'), easyN, rng),
      ...sample(byDifficulty(pool, 'medium'), mediumN, rng),
      ...sample(byDifficulty(pool, 'hard'), hardN, rng),
    ];

    if (picked.length < count) {
      const pickedIds = new Set(picked.map((q) => q.id));
      const remaining = pool.filter((q) => !pickedIds.has(q.id));
      picked.push(...sample(remaining, count - picked.length, rng));
    }
    return picked;
  }

  private toStudentView(
    item: PracticeTestQuestion,
  ): StudentQuestionView | null {
    const question = this.questions.getQuestion(item.question_id);
    if (!question) {
      return null;
    }
    const options: StudentOptionView[] = [];
    item.options_order.forEach((optionId, index) => {
      const option = question.options.find((o) => o.id === optionId);
      if (option) {
        options.push({ id: option.id, text: option.text, order: index });
      }
    });
    return {
      question_id: question.id,
      test_question_id: item.id,
      order: item.order,
      statement: question.statement,
      options,
      topic: question.topic,
      topic_id: question.topic_id ?? null,
      difficulty: question.difficulty,
    };
  }
}

function byDifficulty(pool: Question[], difficulty: Difficulty): Question[] {
  return pool.filter((question) => question.difficulty === difficulty);
}

// Muestreo sin reemplazo de hasta `n` elementos.
function sample<T>(items: T[], n: number, rng: () => number): T[] {
  if (n <= 0) {
    return [];
  }
  return shuffle(items, rng).slice(0, Math.min(n, items.length));
}

// Barajado Fisher-Yates sobre una copia.
function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// RNG determinista (LCG) si hay seed; si no, usa el generador inyectado.
function createRng(seed: number | null, fallback: () => number): () => number {
  if (seed === null) {
    return fallback;
  }
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function defaultTitle(mode: TestMode): string {
  switch (mode) {
    case 'by_topic':
      return 'Test por tema';
    case 'by_difficulty':
      return 'Test por dificultad';
    case 'mixed':
      return 'Test mixto';
    case 'random':
    default:
      return 'Test aleatorio';
  }
}
