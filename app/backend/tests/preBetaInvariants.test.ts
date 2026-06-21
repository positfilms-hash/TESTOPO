// SPEC 027 - Release gate pre-beta: invariantes criticos consolidados en un solo
// sitio. Si algo aqui falla, la beta NO sale (ver docs/qa/pre-beta-release-blockers.md).
// No duplica logica de producto: ejercita el facade PlatformService en modo memory.

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
  TestAttemptError,
  AccessError,
} from '../src/index.js';

async function makeWorld() {
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
  });

  const admin = await users.createUser({ email: 'a@t.com', password: 'x', role: 'admin' });
  const studentA = await users.createUser({ email: 'sa@t.com', password: 'y', role: 'student' });
  const studentB = await users.createUser({ email: 'sb@t.com', password: 'z', role: 'student' });
  const ws = await workspaces.createOrganizationWorkspace(admin, { name: 'Academia', slug: 'academia' });
  for (const u of [studentA, studentB]) {
    await workspaces.addMember(admin, { workspace_id: ws.id, user_id: u.id, role: 'student' });
  }
  const opp = await oppositions.createOpposition(admin, { workspace_id: ws.id, title: 'Aux', slug: 'aux' });
  await oppositions.grantAccess(admin, { user_id: studentA.id, opposition_id: opp.id });
  // studentB NO recibe acceso a `opp`.

  const material = await materials.createMaterial({
    opposition_id: opp.id, title: 'Tema', type: 'syllabus', status: 'active',
    content_text: 'Texto ficticio del material.',
  });

  // Pool: 3 validated + 1 pending_review (no validada) en la misma oposicion.
  const makeQ = async (n: number, validate: boolean) => {
    const q = await questions.createQuestion({
      opposition_id: opp.id,
      statement: `Pregunta ${n} ficticia suficientemente larga`,
      options: [
        { text: 'A', is_correct: true }, { text: 'B', is_correct: false },
        { text: 'C', is_correct: false }, { text: 'D', is_correct: false },
      ],
      explanation: 'Explicacion ficticia suficientemente larga.',
      source: { id: `s${n}`, title: 'Fuente', type: 'syllabus', reference: 'Tema 1', status: 'active' },
      topic: 'Tema 1', difficulty: 'easy',
    });
    if (validate) await questions.changeStatus(q.id, 'validated');
    return q;
  };
  const validated = [await makeQ(1, true), await makeQ(2, true), await makeQ(3, true)];
  const pending = await makeQ(4, false); // queda en draft/pending, NO validada

  return { platform, admin, studentA, studentB, opp, material, questions, validated, pending };
}

describe('SPEC 027 - release gate pre-beta', () => {
  it('BLOCKER: un test solo contiene preguntas validated (excluye no validadas)', async () => {
    const { platform, studentA, opp, validated } = await makeWorld();
    const validatedIds = new Set(validated.map((q) => q.id));
    const { test } = await platform.createTest(studentA, {
      mode: 'random', opposition_id: opp.id, question_count: 3,
    });
    const view = await platform.getTest(studentA, test.id);
    expect(view.questions).toHaveLength(3);
    expect(view.questions.every((q) => validatedIds.has(q.question_id))).toBe(true);
  });

  it('BLOCKER: el student no ve revision/correcta antes de enviar, si despues', async () => {
    const { platform, studentA, opp } = await makeWorld();
    const { test } = await platform.createTest(studentA, {
      mode: 'random', opposition_id: opp.id, question_count: 2,
    });
    const attempt = await platform.startAttempt(studentA, test.id);
    await expect(platform.getReview(studentA, attempt.id)).rejects.toThrow(TestAttemptError);
    await platform.submitAttempt(studentA, attempt.id);
    const reviewItem = (await platform.getReview(studentA, attempt.id)).questions[0];
    expect(reviewItem.correct_option_id).not.toBeNull();
    expect(reviewItem.explanation).toBeTruthy();
  });

  it('BLOCKER: un student no ve los resultados de otro usuario', async () => {
    const { platform, studentA, studentB, opp } = await makeWorld();
    const { test } = await platform.createTest(studentA, {
      mode: 'random', opposition_id: opp.id, question_count: 1,
    });
    const attempt = await platform.startAttempt(studentA, test.id);
    await platform.submitAttempt(studentA, attempt.id);
    await expect(platform.getResult(studentB, attempt.id)).rejects.toThrow(AccessError);
  });

  it('BLOCKER: el student no puede crear test en oposicion no autorizada', async () => {
    const { platform, studentB, opp } = await makeWorld();
    await expect(
      platform.createTest(studentB, { mode: 'random', opposition_id: opp.id, question_count: 1 }),
    ).rejects.toThrow(AccessError);
  });

  it('BLOCKER: el student no puede generar preguntas (solo gestor)', async () => {
    const { platform, studentA, material } = await makeWorld();
    await expect(
      platform.generateFromMaterial(studentA, {
        material_id: material.id, difficulty: 'easy', question_count: 2,
      }),
    ).rejects.toThrow(AccessError);
  });

  it('BLOCKER: la IA nunca crea preguntas validated', async () => {
    const { platform, admin, material } = await makeWorld();
    const result = await platform.generateFromMaterial(admin, {
      material_id: material.id, difficulty: 'easy', question_count: 3,
    });
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions.every((q) => q.status !== 'validated')).toBe(true);
  });
});
