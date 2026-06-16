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
import { TestGeneratorService } from '../src/service/testGeneratorService.js';
import { TestGenerationError } from '../src/test/testGenerationError.js';
import { TestGenerationErrorCode } from '../src/test/testErrors.js';
import type { QuestionStatus } from '../src/models/enums.js';
import type { Source } from '../src/models/source.js';
import { validInput } from './helpers.js';

let seq = 0;

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
  // RNG determinista (LCG) para que los tests sean reproducibles.
  let s = 1;
  const random = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const generator = new TestGeneratorService({
    questionService: questions,
    topicRepository,
    materialRepository,
    random,
  });
  return { materials, topics, questions, generator };
}

// Crea una pregunta valida y la deja en estado `validated` (pasando el gate).
function makeValidated(
  questions: QuestionService,
  overrides: Partial<CreateQuestionInput> = {},
) {
  const q = questions.createQuestion(
    validInput({ statement: `Pregunta ficticia numero ${++seq}`, ...overrides }),
  );
  return questions.changeStatus(q.id, 'validated');
}

function makeWithStatus(
  questions: QuestionService,
  status: QuestionStatus,
) {
  const q = questions.createQuestion(
    validInput({ statement: `Pregunta ficticia numero ${++seq}` }),
  );
  if (status !== 'draft') {
    questions.changeStatus(q.id, status);
  }
  return questions.getQuestion(q.id)!;
}

function expectTestError(
  fn: () => unknown,
  code: TestGenerationErrorCode,
): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TestGenerationError);
    expect((error as TestGenerationError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected TestGenerationError (${code})`);
}

describe('TestGeneratorService - creacion y validacion', () => {
  it('crea un test aleatorio con preguntas validadas', () => {
    const { questions, generator } = makeSetup();
    const validated = [
      makeValidated(questions),
      makeValidated(questions),
      makeValidated(questions),
    ];
    const validatedIds = new Set(validated.map((q) => q.id));

    const { test, questions: items } = generator.createRandomTest({
      question_count: 3,
    });

    expect(test.status).toBe('created');
    expect(test.mode).toBe('random');
    expect(items).toHaveLength(3);
    expect(items.every((i) => validatedIds.has(i.question_id))).toBe(true);
  });

  it('excluye preguntas no validadas (draft/pending_review/needs_fix/rejected/obsolete)', () => {
    const { questions, generator } = makeSetup();
    const validated = makeValidated(questions);
    const excluded = [
      makeWithStatus(questions, 'draft'),
      makeWithStatus(questions, 'pending_review'),
      makeWithStatus(questions, 'needs_fix'),
      makeWithStatus(questions, 'rejected'),
      makeWithStatus(questions, 'obsolete'),
    ];

    const { questions: items } = generator.createRandomTest({
      question_count: 1,
    });
    const selectedIds = items.map((i) => i.question_id);

    expect(selectedIds).toEqual([validated.id]);
    for (const q of excluded) {
      expect(selectedIds).not.toContain(q.id);
    }
  });

  it('falla si no hay suficientes preguntas validadas', () => {
    const { questions, generator } = makeSetup();
    makeValidated(questions);
    expectTestError(
      () => generator.createRandomTest({ question_count: 5 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });

  it('falla con question_count menor que 1', () => {
    const { generator } = makeSetup();
    expectTestError(
      () => generator.createRandomTest({ question_count: 0 }),
      TestGenerationErrorCode.INVALID_QUESTION_COUNT,
    );
  });

  it('falla con question_count mayor que 100', () => {
    const { generator } = makeSetup();
    expectTestError(
      () => generator.createRandomTest({ question_count: 101 }),
      TestGenerationErrorCode.MAX_QUESTION_COUNT_EXCEEDED,
    );
  });

  it('un test no contiene preguntas duplicadas', () => {
    const { questions, generator } = makeSetup();
    for (let i = 0; i < 5; i++) makeValidated(questions);
    const { questions: items } = generator.createRandomTest({
      question_count: 5,
    });
    const ids = items.map((i) => i.question_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TestGeneratorService - filtros', () => {
  it('crea un test filtrando por tema', () => {
    const { topics, questions, generator } = makeSetup();
    const topic = topics.createTopic({ title: 'Tema 1' });
    const inTopic = [
      makeValidated(questions, { topic_id: topic.id }),
      makeValidated(questions, { topic_id: topic.id }),
    ];
    makeValidated(questions); // sin topic_id, no debe entrar
    const inTopicIds = new Set(inTopic.map((q) => q.id));

    const { test, questions: items } = generator.createTestByTopic({
      topic_id: topic.id,
      question_count: 2,
    });

    expect(test.mode).toBe('by_topic');
    expect(items.every((i) => inTopicIds.has(i.question_id))).toBe(true);
  });

  it('crea un test filtrando por dificultad', () => {
    const { questions, generator } = makeSetup();
    makeValidated(questions, { difficulty: 'easy' });
    const hard = makeValidated(questions, { difficulty: 'hard' });

    const { questions: items } = generator.createTestByDifficulty({
      difficulty: 'hard',
      question_count: 1,
    });

    expect(items.map((i) => i.question_id)).toEqual([hard.id]);
  });

  it('crea un test con dificultad mixed', () => {
    const { questions, generator } = makeSetup();
    for (let i = 0; i < 5; i++)
      makeValidated(questions, { difficulty: 'easy' });
    for (let i = 0; i < 5; i++)
      makeValidated(questions, { difficulty: 'medium' });
    for (let i = 0; i < 5; i++)
      makeValidated(questions, { difficulty: 'hard' });

    const { questions: items } = generator.createMixedTest({
      difficulty: 'mixed',
      question_count: 10,
    });

    expect(items).toHaveLength(10);
    expect(new Set(items.map((i) => i.question_id)).size).toBe(10);
  });

  it('falla si el tema no existe', () => {
    const { generator } = makeSetup();
    expectTestError(
      () =>
        generator.createTestByTopic({
          topic_id: 'no-existe',
          question_count: 1,
        }),
      TestGenerationErrorCode.TOPIC_NOT_FOUND,
    );
  });

  it('falla si el tema esta obsoleto', () => {
    const { topics, generator } = makeSetup();
    const topic = topics.createTopic({ title: 'Tema viejo' });
    topics.markObsolete(topic.id);
    expectTestError(
      () =>
        generator.createTestByTopic({
          topic_id: topic.id,
          question_count: 1,
        }),
      TestGenerationErrorCode.TOPIC_OBSOLETE,
    );
  });
});

describe('TestGeneratorService - exclusiones por obsolescencia', () => {
  it('excluye preguntas con material obsoleto', () => {
    const { materials, questions, generator } = makeSetup();
    const material = materials.createMaterial({
      title: 'Material ficticio',
      type: 'syllabus',
      content_text: 'texto',
    });
    const source: Source = {
      id: 'src',
      material_id: material.id,
      title: 'Material ficticio',
      type: 'syllabus',
      reference: 'Tema 1',
      excerpt: 'fragmento',
      status: 'active',
    };
    makeValidated(questions, { source }); // valida con material activo
    materials.markObsolete(material.id); // luego el material se vuelve obsoleto

    expectTestError(
      () => generator.createRandomTest({ question_count: 1 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });

  it('excluye preguntas con tema obsoleto', () => {
    const { topics, questions, generator } = makeSetup();
    const topic = topics.createTopic({ title: 'Tema 1' });
    makeValidated(questions, { topic_id: topic.id }); // valida con tema activo
    topics.markObsolete(topic.id);

    expectTestError(
      () => generator.createRandomTest({ question_count: 1 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });

  it('excluye preguntas con fuente obsoleta', () => {
    const { questions, generator } = makeSetup();
    const q = makeValidated(questions);
    // La fuente se vuelve obsoleta despues de validar (editar no revalida).
    questions.editQuestion(q.id, {
      source: {
        id: 'src',
        title: 'Norma derogada',
        type: 'law',
        reference: 'Ley ficticia',
        status: 'obsolete',
      },
    });
    expectTestError(
      () => generator.createRandomTest({ question_count: 1 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });
});

describe('TestGeneratorService - consulta y cancelacion', () => {
  it('consulta un test sin exponer la respuesta correcta', () => {
    const { questions, generator } = makeSetup();
    makeValidated(questions);
    const { test } = generator.createRandomTest({ question_count: 1 });

    const view = generator.getTest(test.id);

    expect(view.test.id).toBe(test.id);
    expect(view.questions).toHaveLength(1);
    const option = view.questions[0].options[0] as unknown as Record<
      string,
      unknown
    >;
    expect(option.is_correct).toBeUndefined();
    expect(
      (view.questions[0] as unknown as Record<string, unknown>)
        .correct_answer,
    ).toBeUndefined();
  });

  it('cancela un test', () => {
    const { questions, generator } = makeSetup();
    makeValidated(questions);
    const { test } = generator.createRandomTest({ question_count: 1 });

    expect(generator.cancelTest(test.id).status).toBe('cancelled');
  });
});
