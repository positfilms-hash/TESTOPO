// SPEC 019 - permisos del indice de temario via PlatformService.
// Owner/admin pueden crear/aprobar/aplicar; student no (acceso denegado).

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
  InMemorySyllabusIndexRepository,
  SyllabusIndexService,
  PlatformService,
  AccessError,
  AccessErrorCode,
} from '../src/index.js';

async function makeSetup() {
  const users = new UserService(new InMemoryUserRepository());
  const memberRepo = new InMemoryWorkspaceMemberRepository();
  const workspaces = new WorkspaceService(
    new InMemoryWorkspaceRepository(),
    memberRepo,
  );
  const oppositionRepo = new InMemoryOppositionRepository();
  const oppositions = new OppositionService(
    oppositionRepo,
    new InMemoryOppositionAccessRepository(),
    memberRepo,
  );
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const linkRepo = new InMemoryTopicMaterialLinkRepository();
  const materials = new MaterialService(materialRepo);
  const pdfMaterials = new PdfMaterialService({
    materials: materialRepo,
    topics: topicRepo,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage: new InMemoryFileStorage(),
    extractor: new StubPdfTextExtractor(),
  });
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
    linkRepository: linkRepo,
  });
  const materialImport = new MaterialImportService({
    materials: materialRepo,
    topics,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage: new InMemoryFileStorage(),
    extractor: new StubPdfTextExtractor(),
    zipReader: new FflateZipReader(),
    batches: new InMemoryMaterialImportBatchRepository(),
    items: new InMemoryMaterialImportItemRepository(),
  });
  const questions = new QuestionService(new InMemoryQuestionRepository());
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
  const syllabus = new SyllabusIndexService({
    materialRepository: materialRepo,
    topicService: topics,
    topicMaterialLinks: linkRepo,
    repository: new InMemorySyllabusIndexRepository(),
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
    syllabus,
    testGenerator,
    attempts,
  });
  return { users, workspaces, oppositions, platform };
}

async function orgSetup() {
  const ctx = await makeSetup();
  const admin = await ctx.users.createUser({
    email: 'admin@test.com',
    password: 'x',
    role: 'admin',
  });
  const student = await ctx.users.createUser({
    email: 'student@test.com',
    password: 'y',
    role: 'student',
  });
  const ws = await ctx.workspaces.createOrganizationWorkspace(admin, {
    name: 'Academia',
    slug: 'academia',
  });
  await ctx.workspaces.addMember(admin, {
    workspace_id: ws.id,
    user_id: student.id,
    role: 'student',
  });
  const opp = await ctx.oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Auxiliar',
    slug: 'auxiliar',
  });
  await ctx.oppositions.grantAccess(admin, {
    user_id: student.id,
    opposition_id: opp.id,
  });
  const material = await ctx.platform.createMaterial(admin, {
    opposition_id: opp.id,
    title: 'Temario',
    type: 'syllabus',
    content_text: 'Texto ficticio del temario para indexar.',
  });
  return { ...ctx, admin, student, opp, material };
}

describe('SPEC 019 - permisos PlatformService', () => {
  it('admin/owner puede proponer indice de temario', async () => {
    const { platform, admin, opp } = await orgSetup();
    const detail = await platform.proposeSyllabusIndex(admin, {
      opposition_id: opp.id,
    });
    expect(detail.proposal.opposition_id).toBe(opp.id);
    expect(detail.proposal.status).toBe('pending_review');
  });

  it('student no puede proponer indice de temario', async () => {
    const { platform, student, opp } = await orgSetup();
    try {
      await platform.proposeSyllabusIndex(student, { opposition_id: opp.id });
      throw new Error('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(AccessError);
      expect((error as AccessError).codes).toContain(
        AccessErrorCode.WORKSPACE_ACCESS_DENIED,
      );
    }
  });

  it('student no puede aplicar una propuesta', async () => {
    const { platform, admin, student, opp } = await orgSetup();
    const detail = await platform.proposeSyllabusIndex(admin, {
      opposition_id: opp.id,
    });
    await platform.approveSyllabusProposal(admin, detail.proposal.id);
    try {
      await platform.applySyllabusProposal(student, detail.proposal.id);
      throw new Error('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(AccessError);
    }
  });
});
