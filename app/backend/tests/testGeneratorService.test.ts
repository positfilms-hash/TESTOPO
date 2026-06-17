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
import { validInput, TEST_OPPOSITION_ID } from './helpers.js';

let seq = 0;

async function makeSetup() {
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(questionRepository, {
    resolveMaterialStatus: async (id) => (await materials.getMaterial(id))?.status ?? null,
    resolveTopicStatus: async (id) => (await topics.getTopic(id))?.status ?? null,
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
async function makeValidated(
  questions: QuestionService,
  overrides: Partial<CreateQuestionInput> = {},
) {
  const q = await questions.createQuestion(
    validInput({ statement: `Pregunta ficticia numero ${++seq}`, ...overrides }),
  );
  return await questions.changeStatus(q.id, 'validated');
}

async function makeWithStatus(
  questions: QuestionService,
  status: QuestionStatus,
) {
  const q = await questions.createQuestion(
    validInput({ statement: `Pregunta ficticia numero ${++seq}` }),
  );
  if (status !== 'draft') {
    await questions.changeStatus(q.id, status);
  }
  return (await questions.getQuestion(q.id))!;
}

async function expectTestError(
  fn: () => unknown,
  code: TestGenerationErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TestGenerationError);
    expect((error as TestGenerationError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected TestGenerationError (${code})`);
}

describe('TestGeneratorService - creacion y validacion', () => {
  it('crea un test aleatorio con preguntas validadas', async () => {
    const { questions, generator } = await makeSetup();
    const validated = [
      await makeValidated(questions),
      await makeValidated(questions),
      await makeValidated(questions),
    ];
    const validatedIds = new Set(validated.map((q) => q.id));

    const { test, questions: items } = await generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID,
      question_count: 3,
    });

    expect(test.status).toBe('created');
    expect(test.mode).toBe('random');
    expect(items).toHaveLength(3);
    expect(items.every((i) => validatedIds.has(i.question_id))).toBe(true);
  });

  it('excluye preguntas no validadas (draft/pending_review/needs_fix/rejected/obsolete)', async () => {
    const { questions, generator } = await makeSetup();
    const validated = await makeValidated(questions);
    const excluded = [
      await makeWithStatus(questions, 'draft'),
      await makeWithStatus(questions, 'pending_review'),
      await makeWithStatus(questions, 'needs_fix'),
      await makeWithStatus(questions, 'rejected'),
      await makeWithStatus(questions, 'obsolete'),
    ];

    const { questions: items } = await generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID,
      question_count: 1,
    });
    const selectedIds = items.map((i) => i.question_id);

    expect(selectedIds).toEqual([validated.id]);
    for (const q of excluded) {
      expect(selectedIds).not.toContain(q.id);
    }
  });

  it('falla si no hay suficientes preguntas validadas', async () => {
    const { questions, generator } = await makeSetup();
    await makeValidated(questions);
    await expectTestError(
      () => generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 5 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });

  it('falla con question_count menor que 1', async () => {
    const { generator } = await makeSetup();
    await expectTestError(
      () => generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 0 }),
      TestGenerationErrorCode.INVALID_QUESTION_COUNT,
    );
  });

  it('falla con question_count mayor que 100', async () => {
    const { generator } = await makeSetup();
    await expectTestError(
      () => generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 101 }),
      TestGenerationErrorCode.MAX_QUESTION_COUNT_EXCEEDED,
    );
  });

  it('un test no contiene preguntas duplicadas', async () => {
    const { questions, generator } = await makeSetup();
    for (let i = 0; i < 5; i++) await makeValidated(questions);
    const { questions: items } = await generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID,
      question_count: 5,
    });
    const ids = items.map((i) => i.question_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TestGeneratorService - filtros', () => {
  it('crea un test filtrando por tema', async () => {
    const { topics, questions, generator } = await makeSetup();
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });
    const inTopic = [
      await makeValidated(questions, { topic_id: topic.id }),
      await makeValidated(questions, { topic_id: topic.id }),
    ];
    await makeValidated(questions); // sin topic_id, no debe entrar
    const inTopicIds = new Set(inTopic.map((q) => q.id));

    const { test, questions: items } = await generator.createTestByTopic({ opposition_id: TEST_OPPOSITION_ID,
      topic_id: topic.id,
      question_count: 2,
    });

    expect(test.mode).toBe('by_topic');
    expect(items.every((i) => inTopicIds.has(i.question_id))).toBe(true);
  });

  it('crea un test filtrando por dificultad', async () => {
    const { questions, generator } = await makeSetup();
    await makeValidated(questions, { difficulty: 'easy' });
    const hard = await makeValidated(questions, { difficulty: 'hard' });

    const { questions: items } = await generator.createTestByDifficulty({ opposition_id: TEST_OPPOSITION_ID,
      difficulty: 'hard',
      question_count: 1,
    });

    expect(items.map((i) => i.question_id)).toEqual([hard.id]);
  });

  it('crea un test con dificultad mixed', async () => {
    const { questions, generator } = await makeSetup();
    for (let i = 0; i < 5; i++)
      await makeValidated(questions, { difficulty: 'easy' });
    for (let i = 0; i < 5; i++)
      await makeValidated(questions, { difficulty: 'medium' });
    for (let i = 0; i < 5; i++)
      await makeValidated(questions, { difficulty: 'hard' });

    const { questions: items } = await generator.createMixedTest({ opposition_id: TEST_OPPOSITION_ID,
      difficulty: 'mixed',
      question_count: 10,
    });

    expect(items).toHaveLength(10);
    expect(new Set(items.map((i) => i.question_id)).size).toBe(10);
  });

  it('falla si el tema no existe', async () => {
    const { generator } = await makeSetup();
    await expectTestError(
      () =>
        generator.createTestByTopic({ opposition_id: TEST_OPPOSITION_ID,
          topic_id: 'no-existe',
          question_count: 1,
        }),
      TestGenerationErrorCode.TOPIC_NOT_FOUND,
    );
  });

  it('falla si el tema esta obsoleto', async () => {
    const { topics, generator } = await makeSetup();
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema viejo' });
    await topics.markObsolete(topic.id);
    await expectTestError(
      () =>
        generator.createTestByTopic({ opposition_id: TEST_OPPOSITION_ID,
          topic_id: topic.id,
          question_count: 1,
        }),
      TestGenerationErrorCode.TOPIC_OBSOLETE,
    );
  });
});

describe('TestGeneratorService - exclusiones por obsolescencia', () => {
  it('excluye preguntas con material obsoleto', async () => {
    const { materials, questions, generator } = await makeSetup();
    const material = await materials.createMaterial({
      opposition_id: TEST_OPPOSITION_ID,
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
    await makeValidated(questions, { source }); // valida con material activo
    await materials.markObsolete(material.id); // luego el material se vuelve obsoleto

    await expectTestError(
      () => generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 1 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });

  it('excluye preguntas con tema obsoleto', async () => {
    const { topics, questions, generator } = await makeSetup();
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });
    await makeValidated(questions, { topic_id: topic.id }); // valida con tema activo
    await topics.markObsolete(topic.id);

    await expectTestError(
      () => generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 1 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });

  it('excluye preguntas con fuente obsoleta', async () => {
    const { questions, generator } = await makeSetup();
    const q = await makeValidated(questions);
    // La fuente se vuelve obsoleta despues de validar (editar no revalida).
    await questions.editQuestion(q.id, {
      source: {
        id: 'src',
        title: 'Norma derogada',
        type: 'law',
        reference: 'Ley ficticia',
        status: 'obsolete',
      },
    });
    await expectTestError(
      () => generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 1 }),
      TestGenerationErrorCode.NOT_ENOUGH_VALIDATED_QUESTIONS,
    );
  });
});

describe('TestGeneratorService - consulta y cancelacion', () => {
  it('consulta un test sin exponer la respuesta correcta', async () => {
    const { questions, generator } = await makeSetup();
    await makeValidated(questions);
    const { test } = await generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 1 });

    const view = await generator.getTest(test.id);

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

  it('cancela un test', async () => {
    const { questions, generator } = await makeSetup();
    await makeValidated(questions);
    const { test } = await generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 1 });

    expect((await generator.cancelTest(test.id)).status).toBe('cancelled');
  });
});
