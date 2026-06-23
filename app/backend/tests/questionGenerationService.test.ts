import { describe, expect, it } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { QuestionGenerationService } from '../src/service/questionGenerationService.js';
import { QuestionGenerationError } from '../src/generation/questionGenerationError.js';
import { QuestionGenerationErrorCode } from '../src/generation/generationErrors.js';
import type { GenerateQuestionsRequest } from '../src/generation/generationTypes.js';
import { TEST_OPPOSITION_ID } from './helpers.js';

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
  const generation = new QuestionGenerationService({
    questionService: questions,
    materialRepository,
    topicRepository,
  });
  return { materials, topics, questions, generation };
}

async function materialWithText(materials: MaterialService) {
  return await materials.createMaterial({
    opposition_id: TEST_OPPOSITION_ID,
    title: 'Tema 1 - Documento ficticio',
    type: 'syllabus',
    content_text: 'Texto ficticio del tema 1 sobre procedimiento administrativo.',
  });
}

async function expectGenError(
  fn: () => unknown,
  code: QuestionGenerationErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(QuestionGenerationError);
    expect((error as QuestionGenerationError).errors).toContain(code);
    return;
  }
  throw new Error(`Expected QuestionGenerationError (${code}) to be thrown`);
}

describe('QuestionGenerationService - generacion correcta', () => {
  it('genera borradores en pending_review cuando hay tema', async () => {
    const { materials, topics, questions, generation } = await makeSetup();
    const material = await materialWithText(materials);
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });

    const { run, questions: created } = await generation.generateFromMaterial({
      material_id: material.id,
      topic_id: topic.id,
      difficulty: 'easy',
      question_count: 3,
    });

    expect(created).toHaveLength(3);
    expect(run.created_count).toBe(3);
    expect(run.status).toBe('completed');
    for (const q of created) {
      expect(q.status).toBe('pending_review');
      expect(q.status).not.toBe('validated');
      expect(q.source?.material_id).toBe(material.id);
      expect(q.topic_id).toBe(topic.id);
      expect(q.explanation).toBeTruthy();
      expect(q.options.filter((o) => o.is_correct)).toHaveLength(1);
      expect(q.correct_answer).toBe(
        q.options.find((o) => o.is_correct)?.id,
      );
      expect(q.generation_metadata?.created_from_material_id).toBe(material.id);
    }
    // Se guardan en el banco de preguntas existente.
    expect(await questions.listQuestions()).toHaveLength(3);
  });

  it('genera en draft cuando no hay tema', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);

    const { questions: created } = await generation.generateFromMaterial({
      material_id: material.id,
      difficulty: 'medium',
      question_count: 2,
    });

    expect(created.every((q) => q.status === 'draft')).toBe(true);
  });

  it('guarda el fragmento en source.excerpt en modo excerpt', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);

    const { questions: created } = await generation.generateFromExcerpt({
      material_id: material.id,
      excerpt: 'procedimiento administrativo',
      difficulty: 'hard',
      question_count: 1,
    });

    expect(created[0].source?.excerpt).toContain('procedimiento administrativo');
    // Revision Codex (R1-B1): la generacion expuesta desde fragmento nunca deja
    // candidatas en `draft` (quedan pending_review aunque no haya tema).
    expect(created.every((q) => q.status === 'pending_review')).toBe(true);
  });

  it('rechaza un fragmento que NO pertenece al material (R1-B1)', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);

    await expect(
      generation.generateFromExcerpt({
        material_id: material.id,
        excerpt: 'Fragmento inventado que no aparece en el documento real.',
        difficulty: 'easy',
        question_count: 1,
      }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining(['QUESTION_GENERATION_EXCERPT_NOT_IN_SOURCE']),
    });
  });

  it('genera desde texto manual sin material, con fuente temporal', async () => {
    const { generation } = await makeSetup();

    const { questions: created } = await generation.generateFromManualText({
      manual_text: 'Apunte ficticio pegado a mano sobre recursos.',
      opposition_id: TEST_OPPOSITION_ID,
      difficulty: 'easy',
      question_count: 1,
    });

    expect(created[0].status).toBe('draft');
    expect(created[0].source?.material_id).toBeNull();
    expect(created[0].source?.title).toContain('manual');
  });

  it('no duplica enunciados exactos entre generaciones', async () => {
    const { materials, topics, generation } = await makeSetup();
    const material = await materialWithText(materials);
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });

    await generation.generateFromMaterial({
      material_id: material.id,
      topic_id: topic.id,
      difficulty: 'easy',
      question_count: 1,
    });
    const second = await generation.generateFromMaterial({
      material_id: material.id,
      topic_id: topic.id,
      difficulty: 'easy',
      question_count: 1,
    });

    expect(second.questions).toHaveLength(0);
    expect(second.run.status).toBe('failed');
    expect(second.run.errors).toContain(
      QuestionGenerationErrorCode.DUPLICATE_STATEMENT,
    );
  });

  it('registra el historial de generacion', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);

    await generation.generateFromMaterial({
      material_id: material.id,
      difficulty: 'easy',
      question_count: 2,
    });

    expect(await generation.listRuns()).toHaveLength(1);
  });
});

describe('QuestionGenerationService - validaciones', () => {
  it('no genera sin material_id salvo manual_seed', async () => {
    const { generation } = await makeSetup();
    const request: GenerateQuestionsRequest = {
      mode: 'from_material_text',
      difficulty: 'easy',
      question_count: 2,
    };
    await expectGenError(
      () => generation.generate(request),
      QuestionGenerationErrorCode.MATERIAL_REQUIRED,
    );
  });

  it('no genera desde material inexistente', async () => {
    const { generation } = await makeSetup();
    await expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: 'no-existe',
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.MATERIAL_NOT_FOUND,
    );
  });

  it('no genera desde material obsolete', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);
    await materials.markObsolete(material.id);

    await expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.MATERIAL_OBSOLETE,
    );
  });

  it('no genera desde material sin texto ni fragmento', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materials.createMaterial({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Sin texto',
      type: 'notes',
    });

    await expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.CONTENT_REQUIRED,
    );
  });

  it('no genera con dificultad invalida', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);
    await expectGenError(
      () =>
        generation.generate({
          mode: 'from_material_text',
          material_id: material.id,
          difficulty: 'extrema' as GenerateQuestionsRequest['difficulty'],
          question_count: 2,
        }),
      QuestionGenerationErrorCode.INVALID_DIFFICULTY,
    );
  });

  it('no genera con question_count menor que 1', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);
    await expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 0,
        }),
      QuestionGenerationErrorCode.INVALID_COUNT,
    );
  });

  it('no genera con question_count mayor que 20', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);
    await expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 21,
        }),
      QuestionGenerationErrorCode.MAX_COUNT_EXCEEDED,
    );
  });

  it('no genera desde tema inexistente', async () => {
    const { materials, generation } = await makeSetup();
    const material = await materialWithText(materials);
    await expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          topic_id: 'no-existe',
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.TOPIC_NOT_FOUND,
    );
  });

  it('no genera desde tema obsolete', async () => {
    const { materials, topics, generation } = await makeSetup();
    const material = await materialWithText(materials);
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema viejo' });
    await topics.markObsolete(topic.id);

    await expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          topic_id: topic.id,
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.TOPIC_OBSOLETE,
    );
  });
});
