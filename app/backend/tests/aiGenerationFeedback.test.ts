// SPEC 018.4 - AI Question Generation & Review Feedback Loop.
//
// Cubre los tests obligatorios de la spec (seccion 25): la IA genera borradores
// que nunca nacen `validated`, pasan por validacion automatica, el feedback de
// revision se guarda/resume y se inyecta en futuras generaciones, y el modo
// mock funciona sin API externa.

import { describe, expect, it, vi } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { InMemoryQuestionReviewFeedbackRepository } from '../src/repository/inMemoryQuestionReviewFeedbackRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { QuestionValidationService } from '../src/service/questionValidationService.js';
import { QuestionGenerationService } from '../src/service/questionGenerationService.js';
import { QuestionReviewService } from '../src/service/questionReviewService.js';
import { QuestionFeedbackService } from '../src/service/questionFeedbackService.js';
import { QuestionGenerationError } from '../src/generation/questionGenerationError.js';
import { QuestionGenerationErrorCode } from '../src/generation/generationErrors.js';
import { validateGeneratedCandidate } from '../src/generation/validateGeneration.js';
import { createQuestionGenerationProvider } from '../src/generation/createQuestionGenerationProvider.js';
import { AnthropicQuestionGenerationProvider } from '../src/generation/anthropicQuestionGenerationProvider.js';
import type {
  GeneratedCandidate,
  GenerationContext,
  QuestionGenerationProvider,
} from '../src/generation/generationTypes.js';
import { TEST_OPPOSITION_ID } from './helpers.js';

interface Setup {
  materials: MaterialService;
  topics: TopicService;
  questions: QuestionService;
  validation: QuestionValidationService;
  feedbackRepo: InMemoryQuestionReviewFeedbackRepository;
  feedbackService: QuestionFeedbackService;
  review: QuestionReviewService;
  makeGeneration: (
    provider?: QuestionGenerationProvider,
  ) => QuestionGenerationService;
}

function makeSetup(): Setup {
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(questionRepository, {
    resolveMaterialStatus: async (id) =>
      (await materials.getMaterial(id))?.status ?? null,
    resolveTopicStatus: async (id) => (await topics.getTopic(id))?.status ?? null,
  });
  const validation = new QuestionValidationService({
    questionService: questions,
    materialRepository,
    topicRepository,
  });
  const feedbackRepo = new InMemoryQuestionReviewFeedbackRepository();
  const feedbackService = new QuestionFeedbackService({
    feedbackRepository: feedbackRepo,
    questionService: questions,
  });
  const review = new QuestionReviewService({
    questionService: questions,
    validationService: validation,
    materialRepository,
    topicRepository,
    feedbackRepository: feedbackRepo,
  });
  const makeGeneration = (provider?: QuestionGenerationProvider) =>
    new QuestionGenerationService({
      questionService: questions,
      materialRepository,
      topicRepository,
      validationService: validation,
      feedbackService,
      provider,
    });
  return {
    materials,
    topics,
    questions,
    validation,
    feedbackRepo,
    feedbackService,
    review,
    makeGeneration,
  };
}

async function materialWithText(materials: MaterialService) {
  return materials.createMaterial({
    opposition_id: TEST_OPPOSITION_ID,
    title: 'Tema 1 - Documento ficticio',
    type: 'syllabus',
    content_text: 'Texto ficticio del tema 1 sobre procedimiento administrativo.',
  });
}

// Proveedor que devuelve candidatos fijos (para forzar casos concretos).
function stubProvider(
  candidates: GeneratedCandidate[],
): QuestionGenerationProvider {
  return {
    version: 'stub-1',
    name: 'stub',
    model: null,
    async generate(): Promise<GeneratedCandidate[]> {
      return candidates.map((c) => structuredClone(c));
    },
  };
}

function goodCandidate(
  overrides: Partial<GeneratedCandidate> = {},
): GeneratedCandidate {
  return {
    statement: 'Enunciado ficticio suficientemente largo para validar',
    options: [
      { text: 'Opcion correcta', is_correct: true },
      { text: 'Opcion incorrecta A', is_correct: false },
      { text: 'Opcion incorrecta B', is_correct: false },
    ],
    explanation: 'Explicacion suficientemente larga de la respuesta correcta.',
    difficulty: 'easy',
    ...overrides,
  };
}

describe('SPEC 018.4 - generacion IA', () => {
  it('el modo mock genera preguntas en pending_review, nunca validated', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const topic = await s.topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });

    const { run, questions: created } = await s
      .makeGeneration()
      .generateFromMaterial({
        material_id: material.id,
        topic_id: topic.id,
        difficulty: 'easy',
        question_count: 3,
      });

    expect(created).toHaveLength(3);
    expect(run.provider).toBe('mock');
    expect(run.model).toBeNull();
    for (const q of created) {
      expect(q.status).toBe('pending_review');
      expect(q.status).not.toBe('validated');
    }
  });

  it('si la pregunta tiene errores criticos queda en needs_fix', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const topic = await s.topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });
    // Opciones duplicadas: pasa el filtro formal del candidato pero la
    // compuerta de calidad lo marca como error critico (DUPLICATE_OPTIONS).
    const provider = stubProvider([
      goodCandidate({
        options: [
          { text: 'Opcion repetida', is_correct: true },
          { text: 'Opcion repetida', is_correct: false },
          { text: 'Otra opcion', is_correct: false },
        ],
      }),
    ]);

    const { questions: created } = await s
      .makeGeneration(provider)
      .generateFromMaterial({
        material_id: material.id,
        topic_id: topic.id,
        difficulty: 'easy',
        question_count: 1,
      });

    expect(created).toHaveLength(1);
    expect(created[0].status).toBe('needs_fix');
  });

  it('no genera preguntas sin material (modo material)', async () => {
    const s = makeSetup();
    await expect(
      s.makeGeneration().generate({
        mode: 'from_material_text',
        difficulty: 'easy',
        question_count: 2,
      }),
    ).rejects.toBeInstanceOf(QuestionGenerationError);
  });

  it('descarta candidatos sin explicacion (no se crean)', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const provider = stubProvider([goodCandidate({ explanation: '' })]);

    const { run, questions: created } = await s
      .makeGeneration(provider)
      .generateFromMaterial({
        material_id: material.id,
        difficulty: 'easy',
        question_count: 1,
      });

    expect(created).toHaveLength(0);
    expect(run.errors).toContain(
      QuestionGenerationErrorCode.EXPLANATION_REQUIRED,
    );
  });

  it('descarta candidatos con mas de una respuesta correcta', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const provider = stubProvider([
      goodCandidate({
        options: [
          { text: 'Correcta 1', is_correct: true },
          { text: 'Correcta 2', is_correct: true },
          { text: 'Incorrecta', is_correct: false },
        ],
      }),
    ]);

    const { run, questions: created } = await s
      .makeGeneration(provider)
      .generateFromMaterial({
        material_id: material.id,
        difficulty: 'easy',
        question_count: 1,
      });

    expect(created).toHaveLength(0);
    expect(run.errors).toContain(QuestionGenerationErrorCode.INVALID_OUTPUT);
  });

  it('un candidato sin fuente falla la validacion de generacion', () => {
    const errors = validateGeneratedCandidate(goodCandidate(), null);
    expect(errors).toContain(QuestionGenerationErrorCode.SOURCE_REQUIRED);
  });

  it('no supera el maximo configurable de preguntas por generacion', async () => {
    const generation = new QuestionGenerationService({
      questionService: new QuestionService(new InMemoryQuestionRepository()),
      materialRepository: new InMemoryMaterialRepository(),
      provider: stubProvider([goodCandidate()]),
      config: { max_input_chars: 20000, max_question_count: 5 },
    });
    await expect(
      generation.generate({
        mode: 'manual_seed',
        opposition_id: TEST_OPPOSITION_ID,
        manual_text: 'texto ficticio',
        difficulty: 'easy',
        question_count: 6,
      }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining([
        QuestionGenerationErrorCode.MAX_COUNT_EXCEEDED,
      ]),
    });
  });
});

describe('SPEC 018.4 - feedback de revision', () => {
  it('al marcar needs_fix puede registrarse motivo y se guarda', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const topic = await s.topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });
    const { questions: created } = await s
      .makeGeneration()
      .generateFromMaterial({
        material_id: material.id,
        topic_id: topic.id,
        difficulty: 'easy',
        question_count: 1,
      });
    const question = created[0];

    const result = await s.review.markNeedsFix(question.id, {
      feedback: [
        { feedback_type: 'explanation_weak', comment: 'Explicacion floja' },
      ],
    });

    expect(result.feedback).toHaveLength(1);
    const stored = await s.review.listFeedback(question.id);
    expect(stored).toHaveLength(1);
    expect(stored[0].feedback_type).toBe('explanation_weak');
    expect(stored[0].severity).toBe('medium'); // por defecto del tipo
    expect(stored[0].review_id).toBe(result.review.id);
  });

  it('al rechazar una pregunta puede registrarse motivo critico', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const topic = await s.topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });
    const { questions: created } = await s
      .makeGeneration()
      .generateFromMaterial({
        material_id: material.id,
        topic_id: topic.id,
        difficulty: 'easy',
        question_count: 1,
      });

    await s.review.reject(created[0].id, {
      feedback: [{ feedback_type: 'source_missing' }],
    });

    const stored = await s.review.listFeedback(created[0].id);
    expect(stored[0].feedback_type).toBe('source_missing');
    expect(stored[0].severity).toBe('critical');
  });

  it('resume el feedback por tipo para la generacion', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const topic = await s.topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });
    const { questions: created } = await s
      .makeGeneration()
      .generateFromMaterial({
        material_id: material.id,
        topic_id: topic.id,
        difficulty: 'easy',
        question_count: 2,
      });

    await s.review.markNeedsFix(created[0].id, {
      feedback: [{ feedback_type: 'ambiguous_question', comment: 'Ambigua' }],
    });
    await s.review.markNeedsFix(created[1].id, {
      feedback: [{ feedback_type: 'ambiguous_question' }],
    });

    const summary = await s.feedbackService.getFeedbackSummaryForGeneration({
      opposition_id: TEST_OPPOSITION_ID,
    });
    expect(summary).toHaveLength(1);
    expect(summary[0].feedback_type).toBe('ambiguous_question');
    expect(summary[0].count).toBe(2);
    expect(summary[0].example_comments).toEqual(['Ambigua']);
  });

  it('incluye el feedback previo en el input del proveedor', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const topic = await s.topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });
    // 1) Generacion inicial y feedback en una de sus preguntas.
    const first = await s.makeGeneration().generateFromMaterial({
      material_id: material.id,
      topic_id: topic.id,
      difficulty: 'easy',
      question_count: 1,
    });
    await s.review.markNeedsFix(first.questions[0].id, {
      feedback: [{ feedback_type: 'too_easy' }],
    });

    // 2) Segunda generacion con un proveedor espia que captura el contexto.
    let captured: GenerationContext | null = null;
    const spy: QuestionGenerationProvider = {
      version: 'spy-1',
      name: 'spy',
      model: null,
      async generate(ctx: GenerationContext): Promise<GeneratedCandidate[]> {
        captured = ctx;
        return [goodCandidate({ statement: 'Otro enunciado ficticio distinto' })];
      },
    };
    const second = await s.makeGeneration(spy).generateFromMaterial({
      material_id: material.id,
      topic_id: topic.id,
      difficulty: 'easy',
      question_count: 1,
    });

    expect(captured).not.toBeNull();
    const feedback = captured!.previous_feedback ?? [];
    expect(feedback.some((f) => f.feedback_type === 'too_easy')).toBe(true);
    expect(second.run.feedback_used).toBe(true);
  });
});

describe('SPEC 018.4 - proveedor configurable', () => {
  it('por defecto devuelve el proveedor mock', () => {
    const provider = createQuestionGenerationProvider({});
    expect(provider.name).toBe('mock');
    expect(provider.model).toBeNull();
  });

  it('anthropic sin clave lanza error', () => {
    expect(() =>
      createQuestionGenerationProvider({ AI_PROVIDER: 'anthropic' }),
    ).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('proveedor desconocido lanza error', () => {
    expect(() =>
      createQuestionGenerationProvider({ AI_PROVIDER: 'otro' }),
    ).toThrow(/no soportado/);
  });

  it('anthropic con clave usa fetch, parsea JSON e incluye el feedback', async () => {
    let capturedBody = '';
    const fakeFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return {
        ok: true,
        async json() {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  questions: [
                    {
                      statement: 'Pregunta IA ficticia',
                      options: [
                        { text: 'A', is_correct: true },
                        { text: 'B', is_correct: false },
                      ],
                      explanation: 'Porque A.',
                      difficulty: 'medium',
                      source_excerpt: 'Fragmento exacto citado por la IA.',
                      source_reference: 'Articulo 1.2',
                    },
                  ],
                }),
              },
            ],
          };
        },
        async text() {
          return '';
        },
      } as unknown as Response;
    });

    const provider = new AnthropicQuestionGenerationProvider({
      apiKey: 'test-key',
      model: 'claude-opus-4-8',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    const candidates = await provider.generate({
      text: 'material ficticio',
      reference: null,
      difficulty: 'medium',
      count: 1,
      topic_title: 'Tema 1',
      previous_feedback: [
        { feedback_type: 'ambiguous_question', count: 2, severity: 'high' },
      ],
    });

    expect(fakeFetch).toHaveBeenCalledOnce();
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-opus-4-8');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].statement).toBe('Pregunta IA ficticia');
    expect(candidates[0].options.filter((o) => o.is_correct)).toHaveLength(1);
    expect(candidates[0].source_excerpt).toBe('Fragmento exacto citado por la IA.');
    expect(candidates[0].source_reference).toBe('Articulo 1.2');
    expect(capturedBody).toContain('ambiguous_question');
    expect(capturedBody).toContain('source_excerpt');
  });

  it('conserva el fragmento/referencia de la IA en la fuente de la pregunta', async () => {
    const s = makeSetup();
    const material = await materialWithText(s.materials);
    const topic = await s.topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });
    const provider = stubProvider([
      goodCandidate({
        source_excerpt: 'Fragmento exacto usado por la IA',
        source_reference: 'Tema 1, apartado 3',
      }),
    ]);

    const { questions: created } = await s
      .makeGeneration(provider)
      .generateFromMaterial({
        material_id: material.id,
        topic_id: topic.id,
        difficulty: 'easy',
        question_count: 1,
      });

    expect(created).toHaveLength(1);
    expect(created[0].source?.excerpt).toBe('Fragmento exacto usado por la IA');
    expect(created[0].source?.reference).toBe('Tema 1, apartado 3');
  });
});
