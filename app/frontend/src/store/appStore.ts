// Cablea los servicios del backend (SPEC 001-010) en el navegador (SPEC 009:
// adapter en el navegador, sin API). Todo el estado vive en memoria por sesion.
// La logica de negocio NO se reimplementa aqui: solo se instancia y se usa.

import {
  InMemoryMaterialRepository,
  MaterialService,
  PdfMaterialService,
  NaivePdfTextExtractor,
  InMemoryFileStorage,
  InMemoryTopicRepository,
  InMemoryTopicMaterialLinkRepository,
  type TopicMaterialLinkRepository,
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
  InMemoryUserRepository,
  UserService,
  InMemoryOppositionRepository,
  InMemoryOppositionAccessRepository,
  OppositionService,
  InMemoryWorkspaceRepository,
  InMemoryWorkspaceMemberRepository,
  WorkspaceService,
  PlatformService,
  type PracticeTest,
  type Opposition,
} from '@backend';

// Credenciales sembradas para entrar rapido en la demo (ficticias).
export const SEED_ADMIN = { email: 'admin@testopo.dev', password: 'admin1234' };
export const SEED_STUDENT = {
  email: 'alumno@testopo.dev',
  password: 'alumno1234',
};

export interface AppStore {
  users: UserService;
  workspaces: WorkspaceService;
  oppositions: OppositionService;
  materials: MaterialService;
  pdfMaterials: PdfMaterialService;
  /** Vinculos material-tema (SPEC 003/012): para mostrar temas asociados. */
  topicMaterialLinks: TopicMaterialLinkRepository;
  topics: TopicService;
  questions: QuestionService;
  generation: QuestionGenerationService;
  validation: QuestionValidationService;
  review: QuestionReviewService;
  testGenerator: TestGeneratorService;
  attempts: TestAttemptService;
  /** Facade de acceso: la UI usa esto para operaciones sensibles (SPEC 011). */
  platform: PlatformService;
  /** Tests creados en esta sesion (registro de conveniencia para la UI). */
  createdTests: PracticeTest[];
}

export function createAppStore(seed = true): AppStore {
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const questionRepo = new InMemoryQuestionRepository();
  const testRepo = new InMemoryTestRepository();
  const testQuestionRepo = new InMemoryTestQuestionRepository();
  const userRepo = new InMemoryUserRepository();
  const oppositionRepo = new InMemoryOppositionRepository();
  const accessRepo = new InMemoryOppositionAccessRepository();
  const workspaceRepo = new InMemoryWorkspaceRepository();
  const workspaceMemberRepo = new InMemoryWorkspaceMemberRepository();

  const users = new UserService(userRepo);
  const workspaces = new WorkspaceService(workspaceRepo, workspaceMemberRepo);
  const oppositions = new OppositionService(
    oppositionRepo,
    accessRepo,
    workspaceMemberRepo,
  );
  const materials = new MaterialService(materialRepo);
  const topicMaterialLinkRepo = new InMemoryTopicMaterialLinkRepository();
  const pdfMaterials = new PdfMaterialService({
    materials: materialRepo,
    topics: topicRepo,
    topicMaterialLinks: topicMaterialLinkRepo,
    oppositions: oppositionRepo,
    storage: new InMemoryFileStorage(),
    extractor: new NaivePdfTextExtractor(),
  });
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
  });
  const questions = new QuestionService(questionRepo, {
    resolveMaterialStatus: (id) => materials.getMaterial(id)?.status ?? null,
    resolveTopicStatus: (id) => topics.getTopic(id)?.status ?? null,
    resolveMaterialOpposition: (id) =>
      materials.getMaterial(id)?.opposition_id ?? null,
    resolveTopicOpposition: (id) => topics.getTopic(id)?.opposition_id ?? null,
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
  const platform = new PlatformService({
    oppositionRepository: oppositionRepo,
    workspaceMembers: workspaceMemberRepo,
    oppositions,
    materials,
    pdfMaterials,
    topics,
    questions,
    generation,
    review,
    testGenerator,
    attempts,
  });

  const store: AppStore = {
    users,
    workspaces,
    oppositions,
    materials,
    pdfMaterials,
    topicMaterialLinks: topicMaterialLinkRepo,
    topics,
    questions,
    generation,
    validation,
    review,
    testGenerator,
    attempts,
    platform,
    createdTests: [],
  };

  if (seed) {
    seedFixtures(store);
  }
  return store;
}

// Datos ficticios para probar el flujo completo desde el primer momento.
// Nada de esto es material real (la constitucion lo prohibe).
function seedFixtures(store: AppStore): Opposition {
  const admin = store.users.createUser({
    name: 'Administrador',
    email: SEED_ADMIN.email,
    password: SEED_ADMIN.password,
    role: 'admin',
  });
  const student = store.users.createUser({
    name: 'Estudiante',
    email: SEED_STUDENT.email,
    password: SEED_STUDENT.password,
    role: 'student',
  });

  // Workspace por defecto (SPEC 011): el admin es owner; el estudiante, miembro.
  const workspace = store.workspaces.createOrganizationWorkspace(admin, {
    name: 'Workspace MVP',
    slug: 'workspace-mvp',
  });
  store.workspaces.addMember(admin, {
    workspace_id: workspace.id,
    user_id: student.id,
    role: 'student',
  });

  const opposition = store.oppositions.createOpposition(admin, {
    workspace_id: workspace.id,
    title: 'Oposicion MVP',
    slug: 'oposicion-mvp',
    description: 'Oposicion de ejemplo para la demo.',
  });
  store.oppositions.grantAccess(admin, {
    user_id: student.id,
    opposition_id: opposition.id,
  });

  const oppositionId = opposition.id;
  const material = store.materials.createMaterial({
    opposition_id: oppositionId,
    title: 'Tema 1 - Constitucion (ficticio)',
    type: 'syllabus',
    status: 'active',
    reference: 'Tema 1',
    content_text:
      'Texto ficticio del tema 1 sobre derechos fundamentales y organizacion.',
    description: 'Material de ejemplo para la demo.',
  });

  const block = store.topics.createTopic({
    opposition_id: oppositionId,
    title: 'Tema 1 - Constitucion',
    code: 'T1',
    order: 0,
  });
  store.topics.createTopic({
    opposition_id: oppositionId,
    title: 'Derechos fundamentales',
    code: 'T1.1',
    parent_id: block.id,
    order: 0,
  });
  const topic2 = store.topics.createTopic({
    opposition_id: oppositionId,
    title: 'Tema 2 - Procedimiento administrativo',
    code: 'T2',
    order: 1,
  });

  const difficulties = ['easy', 'medium', 'hard'] as const;
  const makeQuestion = (n: number, topicId: string, topicText: string) =>
    store.questions.createQuestion({
      opposition_id: oppositionId,
      statement: `Pregunta ficticia ${n}: cual es la afirmacion correcta sobre ${topicText}?`,
      // Textos neutros: el enunciado de la opcion NO debe revelar cual es la
      // correcta (la respuesta solo se muestra tras enviar el test).
      options: [
        { text: `${topicText}: opcion A (pregunta ${n})`, is_correct: true },
        { text: `${topicText}: opcion B (pregunta ${n})`, is_correct: false },
        { text: `${topicText}: opcion C (pregunta ${n})`, is_correct: false },
        { text: `${topicText}: opcion D (pregunta ${n})`, is_correct: false },
      ],
      explanation: `La opcion A se deduce del material ficticio sobre ${topicText}.`,
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

  for (let n = 1; n <= 8; n++) {
    const useTopic2 = n > 5;
    const q = makeQuestion(
      n,
      useTopic2 ? topic2.id : block.id,
      useTopic2 ? 'el procedimiento administrativo' : 'los derechos fundamentales',
    );
    store.questions.changeStatus(q.id, 'validated');
  }
  for (let n = 9; n <= 10; n++) {
    const q = makeQuestion(n, block.id, 'los derechos fundamentales');
    store.questions.changeStatus(q.id, 'pending_review');
  }

  return opposition;
}
