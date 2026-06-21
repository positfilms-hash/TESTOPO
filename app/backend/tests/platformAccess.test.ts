// Tests de acceso del facade PlatformService (remediacion SPEC 011): el control
// se decide por ROL DE WORKSPACE, habilita Premium personal y protege los
// resultados de cada usuario.

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
  return { users, workspaces, oppositions, questions, platform };
}

async function expectAccessError(fn: () => unknown, code: AccessErrorCode): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AccessError);
    expect((error as AccessError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected AccessError (${code})`);
}

describe('PlatformService - Premium personal', () => {
  it('el owner de un workspace personal gestiona su contenido aunque su rol global sea student', async () => {
    const { users, workspaces, oppositions, platform } = await makeSetup();
    const premium = await users.createUser({
      email: 'premium@test.com',
      password: 'x',
      role: 'student', // rol GLOBAL student; aun asi es owner de su workspace
    });
    const ws = await workspaces.createPersonalWorkspace(premium, {
      name: 'Mi preparacion',
      slug: 'mi-preparacion',
      plan: 'premium',
    });
    const opp = await oppositions.createOpposition(premium, {
      workspace_id: ws.id,
      title: 'Mi oposicion',
      slug: 'mi-oposicion',
    });

    const material = await platform.createMaterial(premium, {
      opposition_id: opp.id,
      title: 'Apuntes',
      type: 'notes',
      content_text: 'Texto ficticio de apuntes propios.',
    });
    const result = await platform.generateFromExcerpt(premium, {
      material_id: material.id,
      excerpt: 'Fragmento concreto de apuntes para generar preguntas.',
      difficulty: 'easy',
      question_count: 2,
    });
    expect(result.questions.length).toBeGreaterThan(0);
  });
});

describe('PlatformService - estudiante', () => {
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
    const other = await ctx.users.createUser({
      email: 'other@test.com',
      password: 'z',
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
    // Pool validado en la oposicion.
    for (let i = 0; i < 3; i++) {
      const q = await ctx.questions.createQuestion({
        opposition_id: opp.id,
        statement: `Pregunta ${i} ficticia sobre el tema`,
        options: [
          { text: 'Opcion A', is_correct: true },
          { text: 'Opcion B', is_correct: false },
          { text: 'Opcion C', is_correct: false },
          { text: 'Opcion D', is_correct: false },
        ],
        explanation: 'Explicacion ficticia suficientemente larga.',
        source: {
          id: `s${i}`,
          title: 'Fuente',
          type: 'syllabus',
          reference: 'Tema 1',
          status: 'active',
        },
        topic: 'Tema 1',
        difficulty: 'easy',
      });
      await ctx.questions.changeStatus(q.id, 'validated');
    }
    return { ...ctx, admin, student, other, ws, opp };
  }

  it('un estudiante no puede gestionar material', async () => {
    const { platform, student, opp } = await orgSetup();
    await expectAccessError(
      () =>
        platform.createMaterial(student, {
          opposition_id: opp.id,
          title: 'X',
          type: 'notes',
        }),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });

  it('un estudiante crea test, lo realiza y ve solo sus propios resultados', async () => {
    const { platform, student, other, opp } = await orgSetup();
    const { test } = await platform.createTest(student, {
      mode: 'random',
      opposition_id: opp.id,
      question_count: 2,
    });
    const attempt = await platform.startAttempt(student, test.id);
    const result = await platform.submitAttempt(student, attempt.id);
    expect(result.status).toBe('submitted');
    expect((await platform.getResult(student, attempt.id)).attempt_id).toBe(attempt.id);

    // Otro usuario no puede ver el resultado ajeno.
    await expectAccessError(
      () => platform.getResult(other, attempt.id),
      AccessErrorCode.ACCESS_DENIED,
    );
  });

  it('un estudiante sin acceso a la oposicion no puede crear test', async () => {
    const { platform, other, opp } = await orgSetup();
    await expectAccessError(
      () =>
        platform.createTest(other, {
          mode: 'random',
          opposition_id: opp.id,
          question_count: 1,
        }),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });
});
