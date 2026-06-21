// Cablea los servicios del backend (SPEC 001-010) en el navegador (SPEC 009:
// adapter en el navegador, sin API). Todo el estado vive en memoria por sesion.
// La logica de negocio NO se reimplementa aqui: solo se instancia y se usa.

import {
  MaterialService,
  PdfMaterialService,
  MaterialImportService,
  FflateZipReader,
  PdfJsTextExtractor,
  InMemoryFileStorage,
  type TopicMaterialLinkRepository,
  TopicService,
  QuestionService,
  QuestionGenerationService,
  QuestionValidationService,
  QuestionReviewService,
  QuestionFeedbackService,
  SyllabusIndexService,
  DocumentClassificationService,
  createDocumentClassificationProvider,
  MaterialSectionService,
  SourceReferenceService,
  SyllabusIndexFromDocumentsService,
  createDocumentGroundedIndexProvider,
  SourceRetrievalService,
  SourceGroundedQuestionGenerationService,
  ExamPatternAnalysisService,
  AIErrorMemoryService,
  createCoreRepositories,
  type SupabaseClientPort,
  type PersistenceMode,
  TestGeneratorService,
  TestAttemptService,
  SupabaseStudentAttemptGateway,
  SupabaseSafeQuestionRepository,
  UserService,
  OppositionService,
  WorkspaceService,
  PlatformService,
  type PracticeTest,
} from '@backend';
import { isSupabaseConfigured, getSupabase } from '../auth/supabaseClient.js';
import { createSupabasePort, requestedPersistenceMode } from './supabaseGateway.js';
// URL del worker de PDF.js resuelta por Vite (el extractor real corre en el
// navegador con su propio worker; en Node/tests pdfjs usa el fake worker).
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

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
  materialImport: MaterialImportService;
  /** Vinculos material-tema (SPEC 003/012/017): materiales por tema. */
  topicMaterialLinks: TopicMaterialLinkRepository;
  topics: TopicService;
  questions: QuestionService;
  generation: QuestionGenerationService;
  validation: QuestionValidationService;
  review: QuestionReviewService;
  /** Resumen de feedback de revision (SPEC 018.4). */
  feedback: QuestionFeedbackService;
  /** Indice de temario con IA (SPEC 019). */
  syllabus: SyllabusIndexService;
  /** Clasificacion documental e inventario (SPEC 028-B). */
  documentClassification: DocumentClassificationService;
  /** Secciones de material y referencias de fuente (SPEC 028-C). */
  materialSections: MaterialSectionService;
  sourceReferences: SourceReferenceService;
  /** Indice de temario anclado a documentos (SPEC 028-D). */
  syllabusFromDocuments: SyllabusIndexFromDocumentsService;
  /** Generacion de preguntas anclada a fuentes (SPEC 028-E). */
  sourceGroundedGeneration: SourceGroundedQuestionGenerationService;
  /** SPEC 028-F: análisis de patrones de examen y memoria de errores IA. */
  examPatternAnalysis: ExamPatternAnalysisService;
  aiErrorMemory: AIErrorMemoryService;
  testGenerator: TestGeneratorService;
  attempts: TestAttemptService;
  /** Facade de acceso: la UI usa esto para operaciones sensibles (SPEC 011). */
  platform: PlatformService;
  /** Tests creados en esta sesion (registro de conveniencia para la UI). */
  createdTests: PracticeTest[];
  /** Modo de persistencia efectivo del bloque cuenta/espacios (SPEC 020). */
  persistence: PersistenceMode;
}

export function createAppStore(seed = true): AppStore {
  // SPEC 020-024: practicamente todo el MVP puede ir a Supabase (cuenta,
  // oposiciones, materiales/temario, banco de preguntas, tests/intentos). Por
  // defecto memoria (la demo no toca Supabase). Supabase solo si
  // VITE_APP_PERSISTENCE_MODE=supabase y configurado.
  let supabasePort: SupabaseClientPort | undefined;
  if (requestedPersistenceMode().toLowerCase() === 'supabase' && isSupabaseConfigured()) {
    supabasePort = createSupabasePort(getSupabase());
  }
  const core = createCoreRepositories({
    persistence: requestedPersistenceMode(),
    supabase: supabasePort ?? null,
  });
  const workspaceMemberRepo = core.workspaceMembers;
  const oppositionRepo = core.oppositions;
  const accessRepo = core.oppositionAccess;
  const materialRepo = core.materials;
  const topicRepo = core.topics;
  const topicMaterialLinkRepo = core.topicMaterialLinks;
  const questionRepo = core.questions;
  const feedbackRepo = core.questionFeedback;
  const testRepo = core.tests;
  const testQuestionRepo = core.testQuestions;

  const users = new UserService(core.users);
  const workspaces = new WorkspaceService(core.workspaces, core.workspaceMembers);
  const oppositions = new OppositionService(
    oppositionRepo,
    accessRepo,
    workspaceMemberRepo,
  );
  const materials = new MaterialService(materialRepo);
  // Almacenamiento y extractor compartidos para que PDFs subidos e importados
  // vivan en el mismo sitio (SPEC 012/017).
  const fileStorage = new InMemoryFileStorage();
  // Extractor real (PDF.js): resuelve streams comprimidos, fuentes embebidas y
  // ToUnicode. En el navegador necesita la URL del worker de pdfjs (la resuelve
  // Vite con `?url`).
  const pdfExtractor = new PdfJsTextExtractor({ workerSrc: pdfWorkerUrl });
  const pdfMaterials = new PdfMaterialService({
    materials: materialRepo,
    topics: topicRepo,
    topicMaterialLinks: topicMaterialLinkRepo,
    oppositions: oppositionRepo,
    storage: fileStorage,
    extractor: pdfExtractor,
  });
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
    linkRepository: topicMaterialLinkRepo,
  });
  const materialImport = new MaterialImportService({
    materials: materialRepo,
    topics,
    topicMaterialLinks: topicMaterialLinkRepo,
    oppositions: oppositionRepo,
    storage: fileStorage,
    extractor: pdfExtractor,
    zipReader: new FflateZipReader(),
    batches: core.importBatches,
    items: core.importItems,
  });
  const questions = new QuestionService(questionRepo, {
    resolveMaterialStatus: async (id) =>
      (await materials.getMaterial(id))?.status ?? null,
    resolveTopicStatus: async (id) => (await topics.getTopic(id))?.status ?? null,
    resolveMaterialOpposition: async (id) =>
      (await materials.getMaterial(id))?.opposition_id ?? null,
    resolveTopicOpposition: async (id) =>
      (await topics.getTopic(id))?.opposition_id ?? null,
  });
  const validation = new QuestionValidationService({
    questionService: questions,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
    // SPEC 023: los informes de validacion se persisten via el factory.
    reportRepository: core.questionValidationReports,
  });
  const feedback = new QuestionFeedbackService({
    feedbackRepository: feedbackRepo,
    questionService: questions,
  });
  // Generacion IA (SPEC 018.4): valida cada borrador y usa el feedback previo.
  // El proveedor se queda en mock en el navegador (sin claves en el bundle).
  const generation = new QuestionGenerationService({
    questionService: questions,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
    validationService: validation,
    feedbackService: feedback,
    // SPEC 023: el historial de generacion se persiste via el factory.
    runRepository: core.generationRuns,
  });
  const review = new QuestionReviewService({
    questionService: questions,
    validationService: validation,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
    feedbackRepository: feedbackRepo,
    // SPEC 023: el historial de revision se persiste via el factory.
    reviewRepository: core.questionReviews,
  });
  // Indice de temario con IA (SPEC 019): proveedor mock en el navegador. El repo
  // se comparte con el indice anclado a documentos (SPEC 028-D) y, desde la
  // migracion del indice, persiste en Supabase via el factory (o InMemory).
  const syllabusRepo = core.syllabusIndex;
  const syllabus = new SyllabusIndexService({
    materialRepository: materialRepo,
    topicService: topics,
    topicMaterialLinks: topicMaterialLinkRepo,
    repository: syllabusRepo,
  });
  // Clasificacion documental e inventario (SPEC 028-B): proveedor heuristico en
  // el navegador (sin red); persistencia via el factory (core).
  const documentClassification = new DocumentClassificationService({
    materials: materialRepo,
    importBatches: core.importBatches,
    importItems: core.importItems,
    runs: core.documentRuns,
    classifications: core.documentClassifications,
    provider: createDocumentClassificationProvider(),
  });
  // Secciones de material y referencias de fuente (SPEC 028-C).
  const materialSections = new MaterialSectionService({
    materials: materialRepo,
    documentClassification,
    sections: core.materialSections,
    importBatches: core.importBatches,
    importItems: core.importItems,
  });
  const sourceReferences = new SourceReferenceService({
    references: core.sourceReferences,
    sections: core.materialSections,
  });
  // Indice de temario anclado a documentos clasificados (SPEC 028-D): reutiliza
  // el repo de SPEC 019 y conecta clasificacion + secciones + fuentes.
  const syllabusFromDocuments = new SyllabusIndexFromDocumentsService({
    materials: materialRepo,
    documentClassification,
    sections: core.materialSections,
    sourceReferences: core.sourceReferences,
    repository: syllabusRepo,
    topics,
    provider: createDocumentGroundedIndexProvider(),
  });
  // Generacion de preguntas anclada a fuentes (SPEC 028-E): recupera fuentes del
  // tema (028-C/D) y reutiliza el generador + validacion existentes.
  const sourceRetrieval = new SourceRetrievalService({
    materials: materialRepo,
    sections: core.materialSections,
    sourceReferences: core.sourceReferences,
    topicMaterialLinks: topicMaterialLinkRepo,
    syllabusRepository: syllabusRepo,
    documentClassification,
    topics,
  });
  // SPEC 028-F: aprendizaje de patrones de examen (Fase 1) + memoria de errores
  // (Fase 2). El generador 028-E usa el perfil de estilo activo + memoria como
  // CONTEXTO adaptativo (no factual) y aplica anti-copia + quality scores.
  const resolveWorkspaceId = async (oppositionId: string) =>
    (await oppositionRepo.findById(oppositionId))?.workspace_id ?? null;
  const examPatternAnalysis = new ExamPatternAnalysisService({
    materials: materialRepo,
    sections: core.materialSections,
    topicMaterialLinks: topicMaterialLinkRepo,
    repository: core.examPatternLearning,
    documentClassification,
    resolveWorkspaceId,
  });
  const aiErrorMemory = new AIErrorMemoryService({
    repository: core.examPatternLearning,
    feedback,
    resolveWorkspaceId,
  });
  const sourceGroundedGeneration = new SourceGroundedQuestionGenerationService({
    questionService: questions,
    materials: materialRepo,
    topics,
    retrieval: sourceRetrieval,
    validationService: validation,
    runRepository: core.generationRuns,
    learning: core.examPatternLearning,
    errorMemory: aiErrorMemory,
  });
  // SPEC 029: el flujo de ALUMNO (generar/responder) lee de una fuente SANEADA
  // (vistas sin solucion) en Supabase, para que el alumno no pueda leer
  // `correct_answer`/`is_correct` por API directa (BUG-001). En memory usa el
  // banco completo en memoria (sin RLS). La correccion/revision (que si leen el
  // secreto) van por RPC SECURITY DEFINER via el gateway.
  const studentQuestions = supabasePort
    ? new QuestionService(new SupabaseSafeQuestionRepository(supabasePort))
    : questions;
  const testGenerator = new TestGeneratorService({
    questionService: studentQuestions,
    topicRepository: topicRepo,
    materialRepository: materialRepo,
    testRepository: testRepo,
    testQuestionRepository: testQuestionRepo,
  });
  const attempts = new TestAttemptService({
    testRepository: testRepo,
    testQuestionRepository: testQuestionRepo,
    questionService: studentQuestions,
    testGenerator,
    // SPEC 024: intentos y respuestas se persisten via el factory.
    attemptRepository: core.testAttempts,
    answerRepository: core.testAnswers,
    studentGateway: supabasePort
      ? new SupabaseStudentAttemptGateway(supabasePort)
      : undefined,
  });
  const platform = new PlatformService({
    oppositionRepository: oppositionRepo,
    workspaceMembers: workspaceMemberRepo,
    oppositions,
    materials,
    pdfMaterials,
    materialImport,
    topics,
    questions,
    generation,
    review,
    feedback,
    syllabus,
    documentClassification,
    materialSections,
    sourceReferences,
    syllabusFromDocuments,
    sourceGroundedGeneration,
    examPatternAnalysis,
    aiErrorMemory,
    testGenerator,
    attempts,
  });

  const store: AppStore = {
    users,
    workspaces,
    oppositions,
    materials,
    pdfMaterials,
    materialImport,
    topicMaterialLinks: topicMaterialLinkRepo,
    topics,
    questions,
    generation,
    validation,
    review,
    feedback,
    syllabus,
    documentClassification,
    materialSections,
    sourceReferences,
    syllabusFromDocuments,
    sourceGroundedGeneration,
    examPatternAnalysis,
    aiErrorMemory,
    testGenerator,
    attempts,
    platform,
    createdTests: [],
    persistence: core.mode,
  };

  void seed;
  return store;
}

// Datos ficticios para probar el flujo completo desde el primer momento.
// Nada de esto es material real (la constitucion lo prohibe). Async (SPEC 018.3):
// lo ejecuta el StoreProvider al arrancar antes de mostrar la app.
export async function seedDemoData(store: AppStore): Promise<void> {
  const admin = await store.users.createUser({
    name: 'Administrador',
    email: SEED_ADMIN.email,
    password: SEED_ADMIN.password,
    role: 'admin',
  });
  const student = await store.users.createUser({
    name: 'Estudiante',
    email: SEED_STUDENT.email,
    password: SEED_STUDENT.password,
    role: 'student',
  });

  // Workspace por defecto (SPEC 011): el admin es owner; el estudiante, miembro.
  const workspace = await store.workspaces.createOrganizationWorkspace(admin, {
    name: 'Workspace MVP',
    slug: 'workspace-mvp',
  });
  await store.workspaces.addMember(admin, {
    workspace_id: workspace.id,
    user_id: student.id,
    role: 'student',
  });

  const opposition = await store.oppositions.createOpposition(admin, {
    workspace_id: workspace.id,
    title: 'Oposicion MVP',
    slug: 'oposicion-mvp',
    description: 'Oposicion de ejemplo para la demo.',
  });
  await store.oppositions.grantAccess(admin, {
    user_id: student.id,
    opposition_id: opposition.id,
  });

  const oppositionId = opposition.id;
  const material = await store.materials.createMaterial({
    opposition_id: oppositionId,
    title: 'Tema 1 - Constitucion (ficticio)',
    type: 'syllabus',
    status: 'active',
    reference: 'Tema 1',
    content_text:
      'Texto ficticio del tema 1 sobre derechos fundamentales y organizacion.',
    description: 'Material de ejemplo para la demo.',
  });

  const block = await store.topics.createTopic({
    opposition_id: oppositionId,
    title: 'Tema 1 - Constitucion',
    code: 'T1',
    order: 0,
  });
  await store.topics.createTopic({
    opposition_id: oppositionId,
    title: 'Derechos fundamentales',
    code: 'T1.1',
    parent_id: block.id,
    order: 0,
  });
  const topic2 = await store.topics.createTopic({
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
    const q = await makeQuestion(
      n,
      useTopic2 ? topic2.id : block.id,
      useTopic2 ? 'el procedimiento administrativo' : 'los derechos fundamentales',
    );
    await store.questions.changeStatus(q.id, 'validated');
  }
  for (let n = 9; n <= 10; n++) {
    const q = await makeQuestion(n, block.id, 'los derechos fundamentales');
    await store.questions.changeStatus(q.id, 'pending_review');
  }
}
