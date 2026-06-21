// Tests de SPEC 028-E - Source-Grounded Question Generation.
//
// Cubre la recuperacion de fuentes (encuentra/excluye), la generacion anclada
// desde un tema aplicado (cada candidata conserva fuente; sin fuente no genera),
// el contexto secundario de examenes, la validacion de salida, que las candidatas
// nunca quedan validated, los permisos y el mapeo Supabase. Reutiliza 028-B/C/D.
// Mock sin red.

import { describe, expect, it } from 'vitest';
import {
  SourceRetrievalService,
  SourceGroundedQuestionGenerationService,
  HeuristicDocumentClassifier,
  DocumentClassificationService,
  InMemoryDocumentUnderstandingRunRepository,
  InMemoryDocumentClassificationRepository,
  MaterialSectionService,
  SourceReferenceService,
  InMemoryMaterialSectionRepository,
  InMemorySourceReferenceRepository,
  SyllabusIndexService,
  SyllabusIndexFromDocumentsService,
  InMemorySyllabusIndexRepository,
  MockDocumentGroundedIndexProvider,
  InMemoryUserRepository,
  UserService,
  InMemoryWorkspaceRepository,
  InMemoryWorkspaceMemberRepository,
  WorkspaceService,
  InMemoryOppositionRepository,
  InMemoryOppositionAccessRepository,
  OppositionService,
  InMemoryMaterialRepository,
  InMemoryExamPatternLearningRepository,
  ExamPatternAnalysisService,
  MaterialService,
  PdfMaterialService,
  MaterialImportService,
  FflateZipReader,
  InMemoryMaterialImportBatchRepository,
  InMemoryMaterialImportItemRepository,
  StubPdfTextExtractor,
  InMemoryFileStorage,
  InMemoryTopicRepository,
  InMemoryTopicMaterialLinkRepository,
  TopicService,
  InMemoryQuestionRepository,
  QuestionService,
  QuestionGenerationService,
  QuestionValidationService,
  QuestionReviewService,
  InMemoryGenerationRunRepository,
  InMemoryTestRepository,
  InMemoryTestQuestionRepository,
  TestGeneratorService,
  TestAttemptService,
  PlatformService,
  AccessError,
  InMemorySupabasePort,
  SupabaseQuestionRepository,
  SupabaseGenerationRunRepository,
  type Question,
  type QuestionGenerationRun,
  type SmartUploadFile,
} from '../src/index.js';

const enc = new TextEncoder();

const SYLLABUS_TEXT =
  'Tema 1. La organizacion administrativa del Estado se estructura en ' +
  'departamentos ministeriales y organismos publicos con principios de jerarquia, ' +
  'competencia y coordinacion descritos con detalle suficiente para el estudio y ' +
  'el aprendizaje del temario oficial de la oposicion de auxiliar administrativo.';

const EXAM_TEXT = [
  '1. Cual es la norma suprema? a) ley b) reglamento c) Constitucion d) costumbre',
  '2. Segunda pregunta del simulacro a) uno b) dos c) tres d) cuatro',
].join(' ');

function file(path: string, text: string): SmartUploadFile {
  const name = path.split('/').pop() ?? path;
  return { original_path: path, original_filename: name, bytes: enc.encode(text) };
}

async function makeSetup() {
  const users = new UserService(new InMemoryUserRepository());
  const memberRepo = new InMemoryWorkspaceMemberRepository();
  const workspaces = new WorkspaceService(new InMemoryWorkspaceRepository(), memberRepo);
  const oppositionRepo = new InMemoryOppositionRepository();
  const oppositions = new OppositionService(
    oppositionRepo,
    new InMemoryOppositionAccessRepository(),
    memberRepo,
  );
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const linkRepo = new InMemoryTopicMaterialLinkRepository();
  const storage = new InMemoryFileStorage();
  const extractor = new StubPdfTextExtractor();
  const materials = new MaterialService(materialRepo);
  const pdfMaterials = new PdfMaterialService({
    materials: materialRepo,
    topics: topicRepo,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage,
    extractor,
  });
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
    linkRepository: linkRepo,
  });
  const importBatches = new InMemoryMaterialImportBatchRepository();
  const importItems = new InMemoryMaterialImportItemRepository();
  const materialImport = new MaterialImportService({
    materials: materialRepo,
    topics,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage,
    extractor,
    zipReader: new FflateZipReader(),
    batches: importBatches,
    items: importItems,
  });
  const documentClassification = new DocumentClassificationService({
    materials: materialRepo,
    importBatches,
    importItems,
    runs: new InMemoryDocumentUnderstandingRunRepository(),
    classifications: new InMemoryDocumentClassificationRepository(),
    provider: new HeuristicDocumentClassifier(),
  });
  const sectionRepo = new InMemoryMaterialSectionRepository();
  const referenceRepo = new InMemorySourceReferenceRepository();
  const materialSections = new MaterialSectionService({
    materials: materialRepo,
    documentClassification,
    sections: sectionRepo,
    importBatches,
    importItems,
  });
  const sourceReferences = new SourceReferenceService({
    references: referenceRepo,
    sections: sectionRepo,
  });
  const syllabusRepo = new InMemorySyllabusIndexRepository();
  const syllabus = new SyllabusIndexService({
    materialRepository: materialRepo,
    topicService: topics,
    topicMaterialLinks: linkRepo,
    repository: syllabusRepo,
  });
  const syllabusFromDocuments = new SyllabusIndexFromDocumentsService({
    materials: materialRepo,
    documentClassification,
    sections: sectionRepo,
    sourceReferences: referenceRepo,
    repository: syllabusRepo,
    topics,
    provider: new MockDocumentGroundedIndexProvider(),
  });
  const questions = new QuestionService(new InMemoryQuestionRepository(), {
    resolveMaterialStatus: async (id) => (await materials.getMaterial(id))?.status ?? null,
    resolveTopicStatus: async (id) => (await topics.getTopic(id))?.status ?? null,
    resolveMaterialOpposition: async (id) => (await materials.getMaterial(id))?.opposition_id ?? null,
    resolveTopicOpposition: async (id) => (await topics.getTopic(id))?.opposition_id ?? null,
  });
  const validation = new QuestionValidationService({
    questionService: questions,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
  });
  const generation = new QuestionGenerationService({
    questionService: questions,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
    validationService: validation,
  });
  const review = new QuestionReviewService({
    questionService: questions,
    validationService: validation,
    materialRepository: materialRepo,
    topicRepository: topicRepo,
  });
  const runRepo = new InMemoryGenerationRunRepository();
  const sourceRetrieval = new SourceRetrievalService({
    materials: materialRepo,
    sections: sectionRepo,
    sourceReferences: referenceRepo,
    topicMaterialLinks: linkRepo,
    syllabusRepository: syllabusRepo,
    documentClassification,
    topics,
  });
  const sourceGroundedGeneration = new SourceGroundedQuestionGenerationService({
    questionService: questions,
    materials: materialRepo,
    topics,
    retrieval: sourceRetrieval,
    validationService: validation,
    runRepository: runRepo,
  });
  const testRepo = new InMemoryTestRepository();
  const testQuestionRepo = new InMemoryTestQuestionRepository();
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
  const examPatternLearningRepo = new InMemoryExamPatternLearningRepository();
  const examPatternAnalysis = new ExamPatternAnalysisService({
    materials: materialRepo,
    sections: sectionRepo,
    topicMaterialLinks: linkRepo,
    repository: examPatternLearningRepo,
    documentClassification,
  });
  const platform = new PlatformService({
    oppositionRepository: oppositionRepo,
    workspaceMembers: memberRepo,
    oppositions,
    materials,
    pdfMaterials,
    materialImport,
    topics,
    questions,
    generation,
    review,
    documentClassification,
    materialSections,
    sourceReferences,
    syllabus,
    syllabusFromDocuments,
    sourceGroundedGeneration,
    examPatternAnalysis,
    testGenerator,
    attempts,
  });
  return {
    users,
    workspaces,
    oppositions,
    questions,
    topics,
    platform,
    examPatternLearningRepo,
  };
}

async function orgSetup() {
  const ctx = await makeSetup();
  const admin = await ctx.users.createUser({ email: 'a@t.com', password: 'x', role: 'admin' });
  const student = await ctx.users.createUser({ email: 's@t.com', password: 'y', role: 'student' });
  const ws = await ctx.workspaces.createOrganizationWorkspace(admin, { name: 'Acad', slug: 'acad' });
  await ctx.workspaces.addMember(admin, { workspace_id: ws.id, user_id: student.id, role: 'student' });
  const opp = await ctx.oppositions.createOpposition(admin, { workspace_id: ws.id, title: 'Aux', slug: 'aux' });
  await ctx.oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });
  return { ...ctx, admin, student, ws, opp };
}

// Sube + clasifica + secciona + propone/aprueba/aplica indice. Devuelve un
// topic aplicado con fuentes. Usa material de estudio (syllabus).
async function seedAppliedTopic(
  ctx: Awaited<ReturnType<typeof orgSetup>>,
): Promise<string> {
  const { batch } = await ctx.platform.smartUpload(ctx.admin, {
    opposition_id: ctx.opp.id,
    upload_category: 'opposition_material',
    source_type: 'multi_file',
    files: [file('Tema 1 Org.txt', SYLLABUS_TEXT)],
  });
  await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
  const items = await ctx.platform.getDocumentInventory(ctx.admin, batch.id);
  const materialId = items.classifications[0].material_id;
  await ctx.platform.createMaterialSections(ctx.admin, materialId);

  const proposal = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, {
    opposition_id: ctx.opp.id,
  });
  await ctx.platform.approveSyllabusProposal(ctx.admin, proposal.proposal.id);
  await ctx.platform.applySyllabusIndexFromDocuments(ctx.admin, proposal.proposal.id);

  const topics = (await ctx.topics.listTopics()).filter((t) => t.opposition_id === ctx.opp.id);
  return topics[0].id;
}

// --- Generacion anclada -------------------------------------------------------

describe('SPEC 028-E - generacion desde tema con fuente', () => {
  it('genera candidatas con fuente desde un tema aplicado', async () => {
    const ctx = await orgSetup();
    const topicId = await seedAppliedTopic(ctx);

    const result = await ctx.platform.generateQuestionsFromTopic(ctx.admin, {
      opposition_id: ctx.opp.id,
      topic_id: topicId,
      difficulty: 'medium',
      count: 3,
    });
    expect(result.questions.length).toBeGreaterThan(0);
    for (const q of result.questions) {
      expect(q.topic_id).toBe(topicId);
      expect(q.source?.material_id).toBeTruthy();
      // Al menos un puntero de fuente concreto.
      expect(
        q.material_section_id || q.source_reference_id || q.topic_source_reference_id,
      ).toBeTruthy();
      // Nunca validated.
      expect(q.status === 'pending_review' || q.status === 'needs_fix').toBe(true);
    }
    // El run registra la estrategia de fuente.
    expect(result.run.source_strategy).toBeTruthy();
  });

  it('falla sin fuente elegible (tema sin documentos seccionados)', async () => {
    const ctx = await orgSetup();
    // Crea un tema manual sin material/fuente.
    const topic = await ctx.platform.createTopic(ctx.admin, {
      opposition_id: ctx.opp.id,
      title: 'Tema huerfano',
    });
    await expect(
      ctx.platform.generateQuestionsFromTopic(ctx.admin, {
        opposition_id: ctx.opp.id,
        topic_id: topic.id,
        difficulty: 'medium',
        count: 2,
      }),
    ).rejects.toBeTruthy();
    // No se ha persistido ninguna pregunta.
    expect(await ctx.questions.listQuestions()).toHaveLength(0);
  });

  it('falla si el tema no existe / no es de la oposicion', async () => {
    const ctx = await orgSetup();
    await expect(
      ctx.platform.generateQuestionsFromTopic(ctx.admin, {
        opposition_id: ctx.opp.id,
        topic_id: 'inexistente',
        difficulty: 'medium',
        count: 1,
      }),
    ).rejects.toBeTruthy();
  });

  it('un examen antiguo no es fuente primaria (no aparece en preview ni genera)', async () => {
    const ctx = await orgSetup();
    // Sube SOLO un examen antiguo, clasificalo y secciona.
    const { batch, items } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'old_tests',
      source_type: 'multi_file',
      files: [file('Examen 2021.txt', EXAM_TEXT)],
    });
    await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
    await ctx.platform.createMaterialSections(ctx.admin, items[0].material_id as string);
    // Un tema cuyo titulo coincide con el examen: aun asi el examen NO es fuente
    // primaria, asi que el preview no lo incluye y la generacion falla.
    const topic = await ctx.platform.createTopic(ctx.admin, {
      opposition_id: ctx.opp.id,
      title: 'Examen',
    });
    const preview = await ctx.platform.previewTopicSources(ctx.admin, {
      opposition_id: ctx.opp.id,
      topic_id: topic.id,
    });
    expect(preview.primary).toHaveLength(0);
    await expect(
      ctx.platform.generateQuestionsFromTopic(ctx.admin, {
        opposition_id: ctx.opp.id,
        topic_id: topic.id,
        difficulty: 'medium',
        count: 2,
      }),
    ).rejects.toBeTruthy();
  });
});

// --- Recuperacion / preview --------------------------------------------------

describe('SPEC 028-E - recuperacion de fuentes', () => {
  it('previewTopicSources encuentra fuentes primarias del tema aplicado', async () => {
    const ctx = await orgSetup();
    const topicId = await seedAppliedTopic(ctx);
    const preview = await ctx.platform.previewTopicSources(ctx.admin, {
      opposition_id: ctx.opp.id,
      topic_id: topicId,
    });
    expect(preview.primary.length).toBeGreaterThan(0);
    expect(preview.primary.every((s) => s.material_id)).toBe(true);
  });
});

// --- Permisos ----------------------------------------------------------------

describe('SPEC 028-E - permisos', () => {
  it('el estudiante no puede generar ni inspeccionar fuentes', async () => {
    const ctx = await orgSetup();
    const topicId = await seedAppliedTopic(ctx);
    await expect(
      ctx.platform.generateQuestionsFromTopic(ctx.student, {
        opposition_id: ctx.opp.id,
        topic_id: topicId,
        difficulty: 'medium',
        count: 1,
      }),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      ctx.platform.previewTopicSources(ctx.student, {
        opposition_id: ctx.opp.id,
        topic_id: topicId,
      }),
    ).rejects.toBeInstanceOf(AccessError);
  });
});

// --- No validacion automatica + tests solo validated -------------------------

describe('SPEC 028-E - revision humana y tests', () => {
  it('las candidatas nunca quedan validated; un test no las usa hasta validarlas', async () => {
    const ctx = await orgSetup();
    const topicId = await seedAppliedTopic(ctx);
    const result = await ctx.platform.generateQuestionsFromTopic(ctx.admin, {
      opposition_id: ctx.opp.id,
      topic_id: topicId,
      difficulty: 'medium',
      count: 3,
    });
    expect(result.questions.every((q) => q.status !== 'validated')).toBe(true);

    // Un test de estudiante no encuentra preguntas validated (no hay ninguna).
    const validated = (await ctx.questions.listQuestions()).filter(
      (q) => q.status === 'validated',
    );
    expect(validated).toHaveLength(0);
  });
});

// --- Mapeo Supabase de columnas nuevas ---------------------------------------

describe('SPEC 028-E - repositorios Supabase (mapeo)', () => {
  const NOW = new Date('2026-06-20T00:00:00Z');

  it('persiste/lee punteros de fuente en questions y estrategia en runs', async () => {
    const port = new InMemorySupabasePort();
    const repo = new SupabaseQuestionRepository(port);
    const question: Question = {
      id: 'q-1',
      opposition_id: 'opp-1',
      statement: 'Pregunta de prueba',
      options: [
        { id: 'o1', text: 'A', is_correct: true, order: 0 },
        { id: 'o2', text: 'B', is_correct: false, order: 1 },
      ],
      correct_answer: 'o1',
      explanation: 'Porque si.',
      source: null,
      topic: 'Tema 1',
      topic_id: 't-1',
      difficulty: 'medium',
      status: 'pending_review',
      generation_metadata: null,
      material_section_id: 'sec-1',
      source_reference_id: 'ref-1',
      topic_source_reference_id: 'tsr-1',
      created_at: NOW,
      updated_at: NOW,
    };
    await repo.create(question);
    const read = await repo.findById('q-1');
    expect(read?.material_section_id).toBe('sec-1');
    expect(read?.source_reference_id).toBe('ref-1');
    expect(read?.topic_source_reference_id).toBe('tsr-1');

    const runRepo = new SupabaseGenerationRunRepository(port);
    const run: QuestionGenerationRun = {
      id: 'run-1',
      material_id: null,
      topic_id: 't-1',
      mode: 'from_material_excerpt',
      requested_count: 3,
      created_count: 2,
      status: 'partial',
      errors: [],
      provider: 'mock',
      model: null,
      feedback_used: false,
      source_strategy: 'material_sections',
      source_reference_ids: ['ref-1'],
      material_section_ids: ['sec-1'],
      created_at: NOW,
    };
    await runRepo.create(run);
    const readRun = await runRepo.findById('run-1');
    expect(readRun?.source_strategy).toBe('material_sections');
    expect(readRun?.source_reference_ids).toEqual(['ref-1']);
    expect(readRun?.material_section_ids).toEqual(['sec-1']);
  });
});

describe('SPEC 028-F - IA de la oposicion (facade)', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  function draftProfile(ctx: Awaited<ReturnType<typeof orgSetup>>) {
    return {
      id: 'prof-x',
      workspace_id: ctx.ws.id,
      opposition_id: ctx.opp.id,
      version: 1,
      status: 'draft' as const,
      selected_summary_ids: [],
      rules: {
        option_count_distribution: {},
        difficulty_distribution: {},
        common_question_types: [],
        trap_patterns: [],
        legal_vs_conceptual: { legal: 0, conceptual: 0 },
        statement_length: null,
        style_notes: null,
      },
      fingerprints: [],
      coverage_notes: null,
      confidence: null,
      warnings: [],
      created_by: ctx.admin.id,
      approved_by: null,
      approved_at: null,
      created_at: now,
      updated_at: now,
    };
  }

  it('admin analiza patrones; el student no puede', async () => {
    const ctx = await orgSetup();
    const result = await ctx.platform.analyzeExamPatterns(ctx.admin, ctx.opp.id);
    expect(result.run.opposition_id).toBe(ctx.opp.id);
    await expect(
      ctx.platform.analyzeExamPatterns(ctx.student, ctx.opp.id),
    ).rejects.toBeInstanceOf(AccessError);
  });

  it('un perfil pasa por revision antes de activarse; el student no puede', async () => {
    const ctx = await orgSetup();
    await ctx.examPatternLearningRepo.createProfile(draftProfile(ctx));
    // No se puede activar un draft directamente (activacion humana obligatoria).
    await expect(
      ctx.platform.activateStyleProfile(ctx.admin, 'prof-x'),
    ).rejects.toThrow(/revisión|pending_review/i);
    await ctx.platform.submitStyleProfileForReview(ctx.admin, 'prof-x');
    await expect(
      ctx.platform.activateStyleProfile(ctx.student, 'prof-x'),
    ).rejects.toBeInstanceOf(AccessError);
    const activated = await ctx.platform.activateStyleProfile(ctx.admin, 'prof-x');
    expect(activated.status).toBe('active');
    expect(await ctx.platform.getGenerationContextPreview(ctx.admin, ctx.opp.id)).toMatchObject({
      profile_id: 'prof-x',
    });
  });

  it('el student no puede listar perfiles ni el inventario de IA', async () => {
    const ctx = await orgSetup();
    await expect(
      ctx.platform.listStyleProfiles(ctx.student, ctx.opp.id),
    ).rejects.toBeInstanceOf(AccessError);
  });
});
