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
  const generation = new QuestionGenerationService({
    questionService: questions,
    materialRepository,
    topicRepository,
  });
  return { materials, topics, questions, generation };
}

function materialWithText(materials: MaterialService) {
  return materials.createMaterial({
    title: 'Tema 1 - Documento ficticio',
    type: 'syllabus',
    content_text: 'Texto ficticio del tema 1 sobre procedimiento administrativo.',
  });
}

function expectGenError(
  fn: () => unknown,
  code: QuestionGenerationErrorCode,
): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(QuestionGenerationError);
    expect((error as QuestionGenerationError).errors).toContain(code);
    return;
  }
  throw new Error(`Expected QuestionGenerationError (${code}) to be thrown`);
}

describe('QuestionGenerationService - generacion correcta', () => {
  it('genera borradores en pending_review cuando hay tema', () => {
    const { materials, topics, questions, generation } = makeSetup();
    const material = materialWithText(materials);
    const topic = topics.createTopic({ title: 'Tema 1' });

    const { run, questions: created } = generation.generateFromMaterial({
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
    expect(questions.listQuestions()).toHaveLength(3);
  });

  it('genera en draft cuando no hay tema', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);

    const { questions: created } = generation.generateFromMaterial({
      material_id: material.id,
      difficulty: 'medium',
      question_count: 2,
    });

    expect(created.every((q) => q.status === 'draft')).toBe(true);
  });

  it('guarda el fragmento en source.excerpt en modo excerpt', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);

    const { questions: created } = generation.generateFromExcerpt({
      material_id: material.id,
      excerpt: 'Articulo 14 - igualdad ante la ley (ficticio).',
      difficulty: 'hard',
      question_count: 1,
    });

    expect(created[0].source?.excerpt).toContain('Articulo 14');
  });

  it('genera desde texto manual sin material, con fuente temporal', () => {
    const { generation } = makeSetup();

    const { questions: created } = generation.generateFromManualText({
      manual_text: 'Apunte ficticio pegado a mano sobre recursos.',
      difficulty: 'easy',
      question_count: 1,
    });

    expect(created[0].status).toBe('draft');
    expect(created[0].source?.material_id).toBeNull();
    expect(created[0].source?.title).toContain('manual');
  });

  it('no duplica enunciados exactos entre generaciones', () => {
    const { materials, topics, generation } = makeSetup();
    const material = materialWithText(materials);
    const topic = topics.createTopic({ title: 'Tema 1' });

    generation.generateFromMaterial({
      material_id: material.id,
      topic_id: topic.id,
      difficulty: 'easy',
      question_count: 1,
    });
    const second = generation.generateFromMaterial({
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

  it('registra el historial de generacion', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);

    generation.generateFromMaterial({
      material_id: material.id,
      difficulty: 'easy',
      question_count: 2,
    });

    expect(generation.listRuns()).toHaveLength(1);
  });
});

describe('QuestionGenerationService - validaciones', () => {
  it('no genera sin material_id salvo manual_seed', () => {
    const { generation } = makeSetup();
    const request: GenerateQuestionsRequest = {
      mode: 'from_material_text',
      difficulty: 'easy',
      question_count: 2,
    };
    expectGenError(
      () => generation.generate(request),
      QuestionGenerationErrorCode.MATERIAL_REQUIRED,
    );
  });

  it('no genera desde material inexistente', () => {
    const { generation } = makeSetup();
    expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: 'no-existe',
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.MATERIAL_NOT_FOUND,
    );
  });

  it('no genera desde material obsolete', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);
    materials.markObsolete(material.id);

    expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.MATERIAL_OBSOLETE,
    );
  });

  it('no genera desde material sin texto ni fragmento', () => {
    const { materials, generation } = makeSetup();
    const material = materials.createMaterial({
      title: 'Sin texto',
      type: 'notes',
    });

    expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 2,
        }),
      QuestionGenerationErrorCode.CONTENT_REQUIRED,
    );
  });

  it('no genera con dificultad invalida', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);
    expectGenError(
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

  it('no genera con question_count menor que 1', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);
    expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 0,
        }),
      QuestionGenerationErrorCode.INVALID_COUNT,
    );
  });

  it('no genera con question_count mayor que 20', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);
    expectGenError(
      () =>
        generation.generateFromMaterial({
          material_id: material.id,
          difficulty: 'easy',
          question_count: 21,
        }),
      QuestionGenerationErrorCode.MAX_COUNT_EXCEEDED,
    );
  });

  it('no genera desde tema inexistente', () => {
    const { materials, generation } = makeSetup();
    const material = materialWithText(materials);
    expectGenError(
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

  it('no genera desde tema obsolete', () => {
    const { materials, topics, generation } = makeSetup();
    const material = materialWithText(materials);
    const topic = topics.createTopic({ title: 'Tema viejo' });
    topics.markObsolete(topic.id);

    expectGenError(
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
