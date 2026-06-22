// Autorizacion del OCR en el facade (SPEC 030): solo gestion (owner/admin) puede
// lanzar/reintentar/consultar OCR; el alumno queda denegado. Si no hay proveedor
// OCR cableado, el facade lo indica con un error claro.

import { describe, expect, it } from 'vitest';
import {
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
  MaterialOcrService,
  InMemoryMaterialOcrRepository,
  PlaceholderPdfPageRenderService,
  MockOcrProvider,
  AccessError,
  OcrError,
  OcrErrorCode,
  type MaterialOcrService as MaterialOcrServiceType,
} from '../src/index.js';

async function makeSetup(withOcr: boolean) {
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
  const materials = new MaterialService(materialRepo);
  const pdfMaterials = new PdfMaterialService({
    materials: materialRepo,
    topics: topicRepo,
    topicMaterialLinks: new InMemoryTopicMaterialLinkRepository(),
    oppositions: oppositionRepo,
    storage: new InMemoryFileStorage(),
    extractor: new StubPdfTextExtractor(),
  });
  const topics = new TopicService(topicRepo, { materialRepository: materialRepo });
  const materialImport = new MaterialImportService({
    materials: materialRepo,
    topics,
    topicMaterialLinks: new InMemoryTopicMaterialLinkRepository(),
    oppositions: oppositionRepo,
    storage: new InMemoryFileStorage(),
    extractor: new StubPdfTextExtractor(),
    zipReader: new FflateZipReader(),
    batches: new InMemoryMaterialImportBatchRepository(),
    items: new InMemoryMaterialImportItemRepository(),
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
  let materialOcr: MaterialOcrServiceType | undefined;
  if (withOcr) {
    materialOcr = new MaterialOcrService({
      materials: materialRepo,
      storage: new InMemoryFileStorage(),
      ocrRepository: new InMemoryMaterialOcrRepository(),
      renderService: new PlaceholderPdfPageRenderService(),
      provider: new MockOcrProvider(),
    });
  }
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
    testGenerator,
    attempts,
    materialOcr,
  });
  return { users, workspaces, oppositions, platform };
}

async function orgSetup(withOcr: boolean) {
  const ctx = await makeSetup(withOcr);
  const admin = await ctx.users.createUser({ email: 'admin@test.com', password: 'x', role: 'admin' });
  const student = await ctx.users.createUser({ email: 'student@test.com', password: 'y', role: 'student' });
  const ws = await ctx.workspaces.createOrganizationWorkspace(admin, { name: 'Academia', slug: 'academia' });
  await ctx.workspaces.addMember(admin, { workspace_id: ws.id, user_id: student.id, role: 'student' });
  const opp = await ctx.oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Auxiliar',
    slug: 'auxiliar',
  });
  const material = await ctx.platform.createMaterial(admin, {
    opposition_id: opp.id,
    title: 'Escaneo',
    type: 'syllabus',
    content_text: 'Texto ficticio del material.',
  });
  return { ...ctx, admin, student, opp, material };
}

describe('PlatformService - OCR autorizacion', () => {
  it('el alumno NO puede lanzar OCR', async () => {
    const { platform, student, material } = await orgSetup(true);
    await expect(platform.startMaterialOcr(student, material.id)).rejects.toBeInstanceOf(AccessError);
  });

  it('el alumno NO puede reintentar ni consultar OCR', async () => {
    const { platform, student, material } = await orgSetup(true);
    await expect(platform.retryMaterialOcr(student, material.id)).rejects.toBeInstanceOf(AccessError);
    await expect(platform.getMaterialOcrStatus(student, material.id)).rejects.toBeInstanceOf(AccessError);
  });

  it('sin proveedor OCR cableado, el facade lo indica con un error claro', async () => {
    const { platform, admin, material } = await orgSetup(false);
    await expect(platform.startMaterialOcr(admin, material.id)).rejects.toMatchObject({
      code: OcrErrorCode.PROVIDER_NOT_CONFIGURED,
    });
  });

  it('el gestor consulta el estado OCR (aun sin run previo)', async () => {
    const { platform, admin, material } = await orgSetup(true);
    const status = await platform.getMaterialOcrStatus(admin, material.id);
    expect(status.run).toBeNull();
    expect(status.material_id).toBe(material.id);
    // OcrError no se lanza en el camino feliz del gestor.
    expect(OcrError).toBeDefined();
  });
});
