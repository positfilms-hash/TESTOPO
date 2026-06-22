// SPEC 032 - Simplified Syllabus Generation Page (orquestacion backend).
//
// `PlatformService.generateSyllabusForOpposition` compone los pasos YA existentes
// en un solo flujo controlado: clasifica el material de la oposicion, crea las
// secciones que falten en el material ELEGIBLE (texto nativo o de OCR), y propone
// el indice anclado a documentos. No aplica nada (revision humana). Cubre: sin
// material, texto nativo, texto de OCR utilizable, aviso de OCR con advertencias,
// exclusion de obsoleto/ilegible, no-auto-aplicar, regeneracion segura,
// autorizacion y aislamiento del alumno. Sin red (mock determinista).

import { describe, expect, it } from 'vitest';
import {
  MockDocumentGroundedIndexProvider,
  SyllabusIndexFromDocumentsService,
  SyllabusIndexService,
  InMemorySyllabusIndexRepository,
  HeuristicDocumentClassifier,
  DocumentClassificationService,
  InMemoryDocumentUnderstandingRunRepository,
  InMemoryDocumentClassificationRepository,
  MaterialSectionService,
  SourceReferenceService,
  InMemoryMaterialSectionRepository,
  InMemorySourceReferenceRepository,
  InMemoryUserRepository,
  UserService,
  InMemoryWorkspaceRepository,
  InMemoryWorkspaceMemberRepository,
  WorkspaceService,
  InMemoryOppositionRepository,
  InMemoryOppositionAccessRepository,
  OppositionService,
  InMemoryMaterialRepository,
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
  InMemoryTestRepository,
  InMemoryTestQuestionRepository,
  TestGeneratorService,
  TestAttemptService,
  PlatformService,
  AccessError,
  type Material,
  type ExtractionStatus,
  type SmartUploadFile,
} from '../src/index.js';

const enc = new TextEncoder();

const SYLLABUS_TEXT =
  'Tema 1. La organizacion administrativa del Estado y sus principios generales ' +
  'de jerarquia y competencia descritos con detalle suficiente para el estudio. ' +
  'Tema 2. El procedimiento administrativo comun, los plazos y los recursos que ' +
  'pueden interponer los interesados ante la administracion publica espanola.';

const EXAM_TEXT = [
  '1. Cual es la norma suprema? a) ley b) reglamento c) Constitucion d) costumbre',
  '2. Segunda pregunta del simulacro a) uno b) dos c) tres d) cuatro',
].join(' ');

function file(path: string, text: string): SmartUploadFile {
  const name = path.split('/').pop() ?? path;
  return { original_path: path, original_filename: name, bytes: enc.encode(text) };
}

function makeSetup() {
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
    testGenerator,
    attempts,
  });
  return { users, workspaces, oppositions, questions, topics, platform, materialRepo };
}

async function orgSetup() {
  const ctx = makeSetup();
  const admin = await ctx.users.createUser({ email: 'a@t.com', password: 'x', role: 'admin' });
  const student = await ctx.users.createUser({ email: 's@t.com', password: 'y', role: 'student' });
  const ws = await ctx.workspaces.createOrganizationWorkspace(admin, { name: 'Acad', slug: 'acad' });
  await ctx.workspaces.addMember(admin, { workspace_id: ws.id, user_id: student.id, role: 'student' });
  const opp = await ctx.oppositions.createOpposition(admin, { workspace_id: ws.id, title: 'Aux', slug: 'aux' });
  await ctx.oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });
  return { ...ctx, admin, student, ws, opp };
}

// Sube material crudo SIN clasificar ni seccionar: el orquestador hace todo.
async function upload(
  ctx: Awaited<ReturnType<typeof orgSetup>>,
  filename: string,
  text: string,
  category: 'opposition_material' | 'old_tests' = 'opposition_material',
): Promise<string> {
  const { items } = await ctx.platform.smartUpload(ctx.admin, {
    opposition_id: ctx.opp.id,
    upload_category: category,
    source_type: 'multi_file',
    files: [file(filename, text)],
  });
  return items[0].material_id as string;
}

// Crea directamente un material con un estado de extraccion dado (p. ej. OCR).
async function seedMaterial(
  ctx: Awaited<ReturnType<typeof orgSetup>>,
  over: Partial<Material> & { extraction_status: ExtractionStatus },
): Promise<string> {
  const now = new Date('2026-06-22T00:00:00Z');
  const id = over.id ?? `mat-${Math.random().toString(36).slice(2)}`;
  await ctx.materialRepo.create({
    opposition_id: ctx.opp.id,
    title: over.title ?? 'Tema 1 OCR',
    description: null,
    type: 'syllabus',
    status: 'active',
    original_filename: over.original_filename ?? 'tema1.pdf',
    mime_type: 'application/pdf',
    size_bytes: 10,
    storage_path: null,
    content_text: over.content_text ?? SYLLABUS_TEXT,
    reference: null,
    file_extension: 'pdf',
    created_at: now,
    updated_at: now,
    ...over,
    id,
  } as Material);
  return id;
}

describe('SPEC 032 - generateSyllabusForOpposition (flujo unico)', () => {
  it('sin material elegible no puede generar (solo examenes)', async () => {
    const ctx = await orgSetup();
    await upload(ctx, 'Examen 2021.txt', EXAM_TEXT, 'old_tests');
    await expect(
      ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id),
    ).rejects.toBeTruthy();
  });

  it('clasifica, secciona y propone desde texto nativo en un solo paso', async () => {
    const ctx = await orgSetup();
    await upload(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const detail = await ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id);
    expect(detail.proposal.status).toBe('pending_review');
    expect(detail.nodes.length).toBeGreaterThanOrEqual(1);
    expect(detail.node_sources.some((s) => s.is_primary)).toBe(true);
    // No aplica: ningun tema en el Topic Map todavia.
    const topics = (await ctx.topics.listTopics()).filter((t) => t.opposition_id === ctx.opp.id);
    expect(topics).toHaveLength(0);
    // No genera preguntas ni tests.
    expect(await ctx.questions.listQuestions()).toHaveLength(0);
  });

  it('el texto recuperado por OCR (completed_ocr) es material elegible', async () => {
    const ctx = await orgSetup();
    await seedMaterial(ctx, { extraction_status: 'completed_ocr', title: 'Tema 1 escaneado' });
    const detail = await ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id);
    expect(detail.nodes.length).toBeGreaterThanOrEqual(1);
    expect(detail.node_sources.some((s) => s.is_primary)).toBe(true);
  });

  it('el OCR con advertencias es elegible pero arrastra un aviso', async () => {
    const ctx = await orgSetup();
    await seedMaterial(ctx, {
      extraction_status: 'completed_ocr_with_warnings',
      title: 'Tema 1 OCR dudoso',
    });
    const detail = await ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id);
    expect(detail.nodes.length).toBeGreaterThanOrEqual(1);
    expect((detail.run?.warnings ?? []).join(' ')).toMatch(/OCR/i);
  });

  it('excluye material ilegible (ocr_failed) y obsoleto', async () => {
    const ctx = await orgSetup();
    await seedMaterial(ctx, { extraction_status: 'ocr_failed', title: 'Roto', content_text: SYLLABUS_TEXT });
    await seedMaterial(ctx, { extraction_status: 'completed', status: 'obsolete', title: 'Viejo' });
    // Solo hay material no utilizable u obsoleto: no se puede generar.
    await expect(
      ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id),
    ).rejects.toBeTruthy();
  });

  it('regenerar crea una propuesta nueva sin borrar la anterior ni aplicar temas', async () => {
    const ctx = await orgSetup();
    await upload(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const first = await ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id);
    const second = await ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id);
    expect(second.proposal.id).not.toBe(first.proposal.id);
    const proposals = await ctx.platform.listSyllabusProposals(ctx.admin, ctx.opp.id);
    expect(proposals.length).toBeGreaterThanOrEqual(2);
    // La propuesta previa sigue accesible (no se borro).
    const prev = await ctx.platform.getSyllabusIndexProposalDetail(ctx.admin, first.proposal.id);
    expect(prev.proposal.id).toBe(first.proposal.id);
    // Sigue sin aplicar temas automaticamente.
    const topics = (await ctx.topics.listTopics()).filter((t) => t.opposition_id === ctx.opp.id);
    expect(topics).toHaveLength(0);
  });

  it('aplicar exige aprobacion explicita (no se aplica solo con generar)', async () => {
    const ctx = await orgSetup();
    await upload(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const detail = await ctx.platform.generateSyllabusForOpposition(ctx.admin, ctx.opp.id);
    await expect(
      ctx.platform.applySyllabusIndexFromDocuments(ctx.admin, detail.proposal.id),
    ).rejects.toBeTruthy();
    await ctx.platform.approveSyllabusProposal(ctx.admin, detail.proposal.id);
    const result = await ctx.platform.applySyllabusIndexFromDocuments(ctx.admin, detail.proposal.id);
    expect(result.created_topic_ids.length).toBeGreaterThan(0);
  });

  it('el alumno no puede generar el temario', async () => {
    const ctx = await orgSetup();
    await upload(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    await expect(
      ctx.platform.generateSyllabusForOpposition(ctx.student, ctx.opp.id),
    ).rejects.toBeInstanceOf(AccessError);
  });

  it('un gestor no puede generar en una oposicion de otro workspace', async () => {
    const ctx = await orgSetup();
    const admin2 = await ctx.users.createUser({ email: 'a2@t.com', password: 'z', role: 'admin' });
    const ws2 = await ctx.workspaces.createOrganizationWorkspace(admin2, { name: 'Otra', slug: 'otra' });
    const opp2 = await ctx.oppositions.createOpposition(admin2, { workspace_id: ws2.id, title: 'B', slug: 'b' });
    await expect(
      ctx.platform.generateSyllabusForOpposition(ctx.admin, opp2.id),
    ).rejects.toBeInstanceOf(AccessError);
  });
});
