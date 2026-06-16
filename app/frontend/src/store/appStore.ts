// Cablea los servicios del backend (SPEC 001-008) en el navegador (SPEC 009:
// adapter en el navegador, sin API). Todo el estado vive en memoria por sesion.
// La logica de negocio NO se reimplementa aqui: solo se instancia y se usa.

import {
  InMemoryMaterialRepository,
  MaterialService,
  InMemoryTopicRepository,
  TopicService,
  InMemoryQuestionRepository,
  QuestionService,
  QuestionGenerationService,
  QuestionValidationService,
  QuestionReviewService,
  InMemoryTestRepository,
  InMemoryTestQuestionRepository,
  TestGeneratorService,
  TestAttemptService,
  type PracticeTest,
} from '@backend';

export interface AppStore {
  materials: MaterialService;
  topics: TopicService;
  questions: QuestionService;
  generation: QuestionGenerationService;
  validation: QuestionValidationService;
  review: QuestionReviewService;
  testGenerator: TestGeneratorService;
  attempts: TestAttemptService;
  /** Tests creados en esta sesion (registro de conveniencia para la UI). */
  createdTests: PracticeTest[];
}

export function createAppStore(seed = true): AppStore {
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const questionRepo = new InMemoryQuestionRepository();
  const testRepo = new InMemoryTestRepository();
  const testQuestionRepo = new InMemoryTestQuestionRepository();

  const materials = new MaterialService(materialRepo);
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
  });
  const questions = new QuestionService(questionRepo, {
    resolveMaterialStatus: (id) => materials.getMaterial(id)?.status ?? null,
    resolveTopicStatus: (id) => topics.getTopic(id)?.status ?? null,
  });
  const generation = new QuestionGenerationService({
    questionService: questions,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
  });
  const validation = new QuestionValidationService({
    questionService: questions,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
  });
  const review = new QuestionReviewService({
    questionService: questions,
    validationService: validation,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
  });
  const testGenerator = new TestGeneratorService({
    questionService: questions,
    topicRepository: topicRepo,
    materialRepository: materialRepo,
    testRepository: testRepo,
    testQuestionRepository: testQuestionRepo,
  });
  const attempts = new TestAttemptService({
    testRepository: testRepo,
    testQuestionRepository: testQuestionRepo,
    questionService: questions,
    testGenerator,
  });

  const store: AppStore = {
    materials,
    topics,
    questions,
    generation,
    validation,
    review,
    testGenerator,
    attempts,
    createdTests: [],
  };

  if (seed) {
    seedFixtures(store);
  }
  return store;
}

// Datos ficticios para poder probar el flujo completo desde el primer momento.
// Nada de esto es material real (la constitucion lo prohibe).
function seedFixtures(store: AppStore): void {
  const material = store.materials.createMaterial({
    title: 'Tema 1 - Constitucion (ficticio)',
    type: 'syllabus',
    status: 'active',
    reference: 'Tema 1',
    content_text:
      'Texto ficticio del tema 1 sobre derechos fundamentales y organizacion.',
    description: 'Material de ejemplo para la demo.',
  });
  store.materials.createMaterial({
    title: 'Ley ficticia 1/2000 (ejemplo)',
    type: 'law',
    status: 'active',
    reference: 'Ley ficticia',
    content_text: 'Articulado ficticio de ejemplo.',
  });

  const block = store.topics.createTopic({
    title: 'Tema 1 - Constitucion',
    code: 'T1',
    order: 0,
  });
  store.topics.createTopic({
    title: 'Derechos fundamentales',
    code: 'T1.1',
    parent_id: block.id,
    order: 0,
  });
  const topic2 = store.topics.createTopic({
    title: 'Tema 2 - Procedimiento administrativo',
    code: 'T2',
    order: 1,
  });

  const difficulties = ['easy', 'medium', 'hard'] as const;
  const makeQuestion = (n: number, topicId: string, topicText: string) =>
    store.questions.createQuestion({
      statement: `Pregunta ficticia ${n}: cual es la afirmacion correcta sobre ${topicText}?`,
      options: [
        { text: `Afirmacion correcta ${n}`, is_correct: true },
        { text: `Afirmacion incorrecta ${n}-A`, is_correct: false },
        { text: `Afirmacion incorrecta ${n}-B`, is_correct: false },
        { text: `Afirmacion incorrecta ${n}-C`, is_correct: false },
      ],
      explanation: `La afirmacion correcta ${n} se deduce del material ficticio sobre ${topicText}.`,
      source: {
        id: `src-${n}`,
        material_id: material.id,
        title: material.title,
        type: 'syllabus',
        reference: 'Tema 1',
        excerpt: 'Fragmento ficticio de apoyo.',
        status: 'active',
      },
      topic: topicText,
      topic_id: topicId,
      difficulty: difficulties[n % 3],
    });

  // 8 preguntas validadas (suficientes para crear un test) y algunas pendientes.
  for (let n = 1; n <= 8; n++) {
    const useTopic2 = n > 5;
    const q = makeQuestion(
      n,
      useTopic2 ? topic2.id : block.id,
      useTopic2 ? 'el procedimiento administrativo' : 'los derechos fundamentales',
    );
    store.questions.changeStatus(q.id, 'validated');
  }
  // 2 preguntas pendientes de revision para mostrar el flujo de revision.
  for (let n = 9; n <= 10; n++) {
    const q = makeQuestion(n, block.id, 'los derechos fundamentales');
    store.questions.changeStatus(q.id, 'pending_review');
  }
}
