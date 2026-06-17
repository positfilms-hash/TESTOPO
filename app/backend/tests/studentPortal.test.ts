// Tests de SPEC 013 - Student Portal: reglas criticas de acceso del estudiante,
// verificadas a traves del facade PlatformService (que ya centraliza el
// control de acceso por rol de workspace + acceso a oposicion). No se duplica
// logica: el portal reutiliza SPEC 007/008/010/011/012.

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
  NaivePdfTextExtractor,
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

function makeSetup() {
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
    extractor: new NaivePdfTextExtractor(),
  });
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
  });
  const materialImport = new MaterialImportService({
    materials: materialRepo,
    topics,
    topicMaterialLinks: new InMemoryTopicMaterialLinkRepository(),
    oppositions: oppositionRepo,
    storage: new InMemoryFileStorage(),
    extractor: new NaivePdfTextExtractor(),
    zipReader: new FflateZipReader(),
    batches: new InMemoryMaterialImportBatchRepository(),
    items: new InMemoryMaterialImportItemRepository(),
  });
  const questions = new QuestionService(new InMemoryQuestionRepository(), {
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

  const admin = users.createUser({
    email: 'admin@test.com',
    password: 'x',
    role: 'admin',
  });
  const student = users.createUser({
    email: 'student@test.com',
    password: 'y',
    role: 'student',
  });
  const other = users.createUser({
    email: 'other@test.com',
    password: 'z',
    role: 'student',
  });
  const ws = workspaces.createOrganizationWorkspace(admin, {
    name: 'Academia',
    slug: 'academia',
  });
  for (const u of [student, other]) {
    workspaces.addMember(admin, {
      workspace_id: ws.id,
      user_id: u.id,
      role: 'student',
    });
  }
  // Oposicion autorizada para `student` (no para `other`).
  const opp = oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Auxiliar',
    slug: 'auxiliar',
  });
  oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });
  oppositions.grantAccess(admin, { user_id: other.id, opposition_id: opp.id });
  // Segunda oposicion: `student` NO tiene acceso.
  const opp2 = oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Gestion',
    slug: 'gestion',
  });

  // Pool validado en la oposicion autorizada.
  for (let i = 0; i < 5; i++) {
    const q = questions.createQuestion({
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
    questions.changeStatus(q.id, 'validated');
  }

  // Material activo y material obsoleto en la oposicion autorizada.
  const activeMaterial = materials.createMaterial({
    opposition_id: opp.id,
    title: 'Tema activo',
    type: 'syllabus',
    status: 'active',
    content_text: 'Texto del material activo.',
  });
  const obsoleteMaterial = materials.createMaterial({
    opposition_id: opp.id,
    title: 'Tema obsoleto',
    type: 'syllabus',
    status: 'obsolete',
    content_text: 'Texto del material obsoleto.',
  });

  return {
    platform,
    admin,
    student,
    other,
    opp,
    opp2,
    activeMaterial,
    obsoleteMaterial,
    oppositions,
  };
}

describe('SPEC 013 - oposiciones del estudiante', () => {
  it('ve solo sus oposiciones autorizadas', () => {
    const { oppositions, student, opp } = makeSetup();
    const list = oppositions.listForUser(student);
    expect(list.map((o) => o.id)).toEqual([opp.id]);
  });

  it('puede entrar en una oposicion autorizada', () => {
    const { oppositions, student, opp } = makeSetup();
    expect(oppositions.getOpposition(student, opp.id).id).toBe(opp.id);
  });

  it('no puede entrar en una oposicion no autorizada', () => {
    const { oppositions, student, opp2 } = makeSetup();
    expect(() => oppositions.getOpposition(student, opp2.id)).toThrow(
      AccessError,
    );
  });
});

describe('SPEC 013 - material del estudiante', () => {
  it('ve solo material activo (no obsoleto)', () => {
    const { platform, student, opp, activeMaterial } = makeSetup();
    const list = platform.listMaterials(student, opp.id);
    expect(list.map((m) => m.id)).toEqual([activeMaterial.id]);
  });

  it('no puede ver el detalle de material no activo', () => {
    const { platform, student, obsoleteMaterial } = makeSetup();
    expect(() => platform.getMaterial(student, obsoleteMaterial.id)).toThrow(
      AccessError,
    );
  });

  it('puede ver el detalle de material activo', () => {
    const { platform, student, activeMaterial } = makeSetup();
    expect(platform.getMaterial(student, activeMaterial.id).id).toBe(
      activeMaterial.id,
    );
  });
});

describe('SPEC 013 - el estudiante no puede administrar', () => {
  it('no puede subir PDF', () => {
    const { platform, student, opp } = makeSetup();
    expect(() =>
      platform.uploadPdf(student, {
        opposition_id: opp.id,
        title: 'X',
        type: 'syllabus',
        file: {
          original_filename: 'x.pdf',
          mime_type: 'application/pdf',
          bytes: new Uint8Array([1, 2, 3]),
        },
      }),
    ).toThrow(AccessError);
  });

  it('no puede generar preguntas', () => {
    const { platform, student, activeMaterial } = makeSetup();
    expect(() =>
      platform.generateFromMaterial(student, {
        material_id: activeMaterial.id,
        difficulty: 'easy',
        question_count: 2,
      }),
    ).toThrow(AccessError);
  });

  it('no puede importar material (subida multiple ni ZIP) - SPEC 017', () => {
    const { platform, student, opp } = makeSetup();
    expect(() =>
      platform.importFilesToTopic(student, {
        opposition_id: opp.id,
        topic_id: 't',
        files: [{ original_filename: 'a.pdf', bytes: new Uint8Array([1]) }],
      }),
    ).toThrow(AccessError);
    expect(() =>
      platform.importZip(student, {
        opposition_id: opp.id,
        zip: { original_filename: 'z.zip', bytes: new Uint8Array([1]) },
      }),
    ).toThrow(AccessError);
  });
});

describe('SPEC 013 - tests y resultados del estudiante', () => {
  it('puede crear test en oposicion autorizada con preguntas de esa oposicion', () => {
    const { platform, student, opp } = makeSetup();
    const { test } = platform.createTest(student, {
      mode: 'random',
      opposition_id: opp.id,
      question_count: 3,
    });
    expect(test.opposition_id).toBe(opp.id);
    const view = platform.getTest(student, test.id);
    expect(view.questions.length).toBe(3);
  });

  it('no puede crear test en oposicion no autorizada', () => {
    const { platform, student, opp2 } = makeSetup();
    expect(() =>
      platform.createTest(student, {
        mode: 'random',
        opposition_id: opp2.id,
        question_count: 1,
      }),
    ).toThrow(AccessError);
  });

  it('no puede ver la revision antes de enviar el test', () => {
    const { platform, student, opp } = makeSetup();
    const { test } = platform.createTest(student, {
      mode: 'random',
      opposition_id: opp.id,
      question_count: 2,
    });
    const attempt = platform.startAttempt(student, test.id);
    expect(() => platform.getReview(student, attempt.id)).toThrow(
      TestAttemptError,
    );
  });

  it('ve resultado y revision (con explicacion y fuente) despues de enviar', () => {
    const { platform, student, opp } = makeSetup();
    const { test } = platform.createTest(student, {
      mode: 'random',
      opposition_id: opp.id,
      question_count: 2,
    });
    const attempt = platform.startAttempt(student, test.id);
    platform.submitAttempt(student, attempt.id);

    const result = platform.getResult(student, attempt.id);
    expect(result.total_questions).toBe(2);

    const reviewItem = platform.getReview(student, attempt.id).questions[0];
    expect(reviewItem.explanation).toBeTruthy();
    expect(reviewItem.correct_option_id).not.toBeNull();
    expect(reviewItem.source_reference).toBe('Tema 1');
  });

  it('no puede ver resultados de otro estudiante', () => {
    const { platform, student, other, opp } = makeSetup();
    const { test } = platform.createTest(student, {
      mode: 'random',
      opposition_id: opp.id,
      question_count: 1,
    });
    const attempt = platform.startAttempt(student, test.id);
    platform.submitAttempt(student, attempt.id);
    expect(() => platform.getResult(other, attempt.id)).toThrow(AccessError);
  });

  it('listMyResults solo devuelve los intentos enviados del propio usuario', () => {
    const { platform, student, other, opp } = makeSetup();
    // student envia uno; other crea pero no envia.
    const a = platform.createTest(student, {
      mode: 'random',
      opposition_id: opp.id,
      question_count: 1,
    });
    const attempt = platform.startAttempt(student, a.test.id);
    platform.submitAttempt(student, attempt.id);

    const b = platform.createTest(other, {
      mode: 'random',
      opposition_id: opp.id,
      question_count: 1,
    });
    platform.startAttempt(other, b.test.id); // sin enviar

    const mine = platform.listMyResults(student);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.attempt_id).toBe(attempt.id);
    expect(mine[0]?.test_title).toBeTruthy();

    expect(platform.listMyResults(other)).toHaveLength(0);
  });
});
