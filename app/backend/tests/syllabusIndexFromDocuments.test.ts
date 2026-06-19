// Tests de SPEC 028-D - AI Syllabus Index From Classified Documents.
//
// Cubre la seleccion de fuentes (primarias/secundarias/excluidas), la validacion
// estricta de la salida del proveedor, el ciclo de revision/aprobacion/
// aplicacion con referencias de fuente, los permisos y el aislamiento. Reutiliza
// SPEC 019 (repo + ciclo) y 028-B/028-C (clasificacion + secciones). El mock no
// hace llamadas externas y no se generan preguntas ni tests.

import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import {
  SyllabusIndexFromDocumentsService,
  validateGroundedOutput,
  MockDocumentGroundedIndexProvider,
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
  AccessError,
  type Material,
  type TopicService as TopicServiceType,
  type GroundedIndexOutput,
  type DocumentGroundedIndexProvider,
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
  const extractor = new NaivePdfTextExtractor();
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
  return { users, workspaces, oppositions, questions, topics, platform };
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

// Sube, clasifica y secciona un documento; devuelve el material_id.
async function seedDoc(
  ctx: Awaited<ReturnType<typeof orgSetup>>,
  filename: string,
  text: string,
  category: 'opposition_material' | 'old_tests' = 'opposition_material',
): Promise<string> {
  const { batch, items } = await ctx.platform.smartUpload(ctx.admin, {
    opposition_id: ctx.opp.id,
    upload_category: category,
    source_type: 'multi_file',
    files: [file(filename, text)],
  });
  await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
  const materialId = items[0].material_id as string;
  await ctx.platform.createMaterialSections(ctx.admin, materialId);
  return materialId;
}

// --- Propuesta anclada a documentos ------------------------------------------

describe('SPEC 028-D - propuesta con fuente', () => {
  it('propone temas desde documentos primarios, con node sources sellados', async () => {
    const ctx = await orgSetup();
    await seedDoc(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const detail = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, {
      opposition_id: ctx.opp.id,
    });
    expect(detail.proposal.status).toBe('pending_review');
    expect(detail.nodes.length).toBeGreaterThanOrEqual(1);
    expect(detail.node_sources.length).toBeGreaterThan(0);
    expect(detail.node_sources.every((s) => s.opposition_id === ctx.opp.id)).toBe(true);
    expect(detail.node_sources.some((s) => s.is_primary)).toBe(true);
  });

  it('los examenes antiguos son contexto secundario, no fuente de un tema', async () => {
    const ctx = await orgSetup();
    await seedDoc(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const examId = await seedDoc(ctx, 'Examen 2021.txt', EXAM_TEXT, 'old_tests');
    const detail = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, {
      opposition_id: ctx.opp.id,
    });
    expect(detail.node_sources.every((s) => s.material_id !== examId)).toBe(true);
    expect((detail.run?.warnings ?? []).join(' ')).toMatch(/contexto/i);
  });

  it('falla si no hay documentos primarios (solo examenes)', async () => {
    const ctx = await orgSetup();
    await seedDoc(ctx, 'Examen 2021.txt', EXAM_TEXT, 'old_tests');
    await expect(
      ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, {
        opposition_id: ctx.opp.id,
      }),
    ).rejects.toBeTruthy();
  });

  it('un documento ambiguous corregido a clase util si entra', async () => {
    const ctx = await orgSetup();
    const zip = zipSync({
      'Carpeta rara/dudoso.txt': new Uint8Array(
        enc.encode('lorem ipsum dolor sit amet consectetur largo suficiente para analizar.'),
      ),
    });
    const { batch, items } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'mixed',
      source_type: 'zip',
      zip: { original_filename: 'mix.zip', bytes: zip },
    });
    const { classifications } = await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
    expect(classifications[0].classification).toBe('ambiguous');
    await ctx.platform.correctDocumentClassification(
      ctx.admin,
      classifications[0].id,
      'syllabus_material',
    );
    await ctx.platform.createMaterialSections(ctx.admin, items[0].material_id as string);

    const detail = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, {
      opposition_id: ctx.opp.id,
    });
    expect(detail.nodes.length).toBeGreaterThanOrEqual(1);
  });
});

// --- Validacion de la salida del proveedor -----------------------------------

describe('SPEC 028-D - validacion de salida', () => {
  const sectionIndex = new Map<string, unknown>([['sec-1', {}]]);
  const materialIndex = new Map([
    ['mat-1', { classification: 'syllabus_material' as const }],
    ['exam-1', { classification: 'old_exam_or_test' as const }],
  ]);

  function out(topics: GroundedIndexOutput['topics']): GroundedIndexOutput {
    return { title: 't', summary: 's', topics, warnings: [], provider: 'mock', model: null };
  }

  it('rechaza un nodo sin fuentes', () => {
    const errors = validateGroundedOutput(
      out([{ title: 'Tema', order: 0, sources: [] }]),
      sectionIndex,
      materialIndex,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza fuentes ajenas/inexistentes', () => {
    const errors = validateGroundedOutput(
      out([{ title: 'Tema', order: 0, sources: [{ material_id: 'ajeno', section_ids: [], reference_ids: [] }] }]),
      sectionIndex,
      materialIndex,
    );
    expect(errors.join(' ')).toMatch(/ajena|inexistente/i);
  });

  it('rechaza una raiz sin fuente primaria (solo examen)', () => {
    const errors = validateGroundedOutput(
      out([{ title: 'Tema', order: 0, sources: [{ material_id: 'exam-1', section_ids: [], reference_ids: [] }] }]),
      sectionIndex,
      materialIndex,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza contenido prohibido (opciones de test)', () => {
    const errors = validateGroundedOutput(
      out([{ title: 'a) opcion b) otra', order: 0, sources: [{ material_id: 'mat-1', section_ids: ['sec-1'], reference_ids: [] }] }]),
      sectionIndex,
      materialIndex,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('acepta una raiz primaria valida', () => {
    const errors = validateGroundedOutput(
      out([{ title: 'Tema 1', order: 0, sources: [{ material_id: 'mat-1', section_ids: ['sec-1'], reference_ids: [] }] }]),
      sectionIndex,
      materialIndex,
    );
    expect(errors).toHaveLength(0);
  });
});

// --- Ciclo de revision, aprobacion y aplicacion ------------------------------

describe('SPEC 028-D - ciclo y aplicacion', () => {
  it('no se aplica sin aprobacion; aprobar+aplicar crea temas con fuente', async () => {
    const ctx = await orgSetup();
    await seedDoc(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const detail = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, {
      opposition_id: ctx.opp.id,
    });
    // Antes de aprobar no se puede aplicar.
    await expect(
      ctx.platform.applySyllabusIndexFromDocuments(ctx.admin, detail.proposal.id),
    ).rejects.toBeTruthy();

    await ctx.platform.approveSyllabusProposal(ctx.admin, detail.proposal.id);
    const result = await ctx.platform.applySyllabusIndexFromDocuments(
      ctx.admin,
      detail.proposal.id,
    );
    expect(result.created_topic_ids.length).toBeGreaterThan(0);
    expect(result.topic_source_references).toBeGreaterThan(0);
    const topics = (await ctx.topics.listTopics()).filter((t) => t.opposition_id === ctx.opp.id);
    expect(topics.length).toBeGreaterThan(0);
    // No se han creado preguntas ni tests.
    expect(await ctx.questions.listQuestions()).toHaveLength(0);
  });

  it('reaplicar reutiliza temas existentes sin duplicar', async () => {
    const ctx = await orgSetup();
    await seedDoc(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const first = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, { opposition_id: ctx.opp.id });
    await ctx.platform.approveSyllabusProposal(ctx.admin, first.proposal.id);
    const r1 = await ctx.platform.applySyllabusIndexFromDocuments(ctx.admin, first.proposal.id);
    const topicsAfter1 = (await ctx.topics.listTopics()).filter((t) => t.opposition_id === ctx.opp.id).length;

    const second = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, { opposition_id: ctx.opp.id });
    await ctx.platform.approveSyllabusProposal(ctx.admin, second.proposal.id);
    const r2 = await ctx.platform.applySyllabusIndexFromDocuments(ctx.admin, second.proposal.id);
    const topicsAfter2 = (await ctx.topics.listTopics()).filter((t) => t.opposition_id === ctx.opp.id).length;

    expect(r1.created_topic_ids.length).toBeGreaterThan(0);
    expect(r2.reused_topic_ids.length).toBeGreaterThan(0);
    expect(topicsAfter2).toBe(topicsAfter1); // no se duplican
  });
});

// --- Permisos / aislamiento --------------------------------------------------

describe('SPEC 028-D - permisos', () => {
  it('el estudiante no puede proponer ni acceder a propuestas', async () => {
    const ctx = await orgSetup();
    await seedDoc(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const detail = await ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, { opposition_id: ctx.opp.id });
    await expect(
      ctx.platform.proposeSyllabusIndexFromDocuments(ctx.student, { opposition_id: ctx.opp.id }),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      ctx.platform.getSyllabusIndexProposalDetail(ctx.student, detail.proposal.id),
    ).rejects.toBeInstanceOf(AccessError);
  });

  it('un gestor no puede proponer en una oposicion de otro workspace', async () => {
    const ctx = await orgSetup();
    const admin2 = await ctx.users.createUser({ email: 'a2@t.com', password: 'z', role: 'admin' });
    const ws2 = await ctx.workspaces.createOrganizationWorkspace(admin2, { name: 'Otra', slug: 'otra' });
    const opp2 = await ctx.oppositions.createOpposition(admin2, { workspace_id: ws2.id, title: 'B', slug: 'b' });
    await expect(
      ctx.platform.proposeSyllabusIndexFromDocuments(ctx.admin, { opposition_id: opp2.id }),
    ).rejects.toBeInstanceOf(AccessError);
  });
});

// --- Proveedor invalido rechazado a nivel servicio ---------------------------

describe('SPEC 028-D - proveedor invalido (servicio)', () => {
  it('marca el run como fallido y rechaza si el proveedor inventa fuentes ajenas', async () => {
    const now = new Date('2026-06-19T00:00:00Z');
    const materialRepo = new InMemoryMaterialRepository();
    await materialRepo.create({
      id: 'mat-1',
      opposition_id: 'opp-1',
      title: 'Tema 1',
      description: null,
      type: 'syllabus',
      status: 'active',
      original_filename: 'Tema 1.txt',
      mime_type: 'text/plain',
      size_bytes: 10,
      storage_path: null,
      content_text: 'Tema 1 contenido de estudio suficiente para analizar.',
      reference: null,
      extraction_status: 'completed',
      created_at: now,
      updated_at: now,
    } as Material);

    const sectionRepo = new InMemoryMaterialSectionRepository();
    await sectionRepo.create({
      id: 'sec-1',
      workspace_id: 'ws-1',
      opposition_id: 'opp-1',
      material_id: 'mat-1',
      section_title: 'Tema 1',
      section_type: 'heading',
      page_start: null,
      page_end: null,
      content_excerpt: 'ex',
      content_text: 'Tema 1 contenido',
      order_index: 0,
      classification: 'study_content',
      source_path: null,
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    const classifier = {
      getClassificationForMaterial: async () => ({
        classification: 'syllabus_material',
        confidence: 0.9,
        workspace_id: 'ws-1',
        opposition_id: 'opp-1',
      }),
    } as unknown as DocumentClassificationService;

    const badProvider: DocumentGroundedIndexProvider = {
      name: 'bad',
      model: null,
      async proposeIndex() {
        return {
          title: 't',
          summary: 's',
          topics: [
            { title: 'Inventado', order: 0, sources: [{ material_id: 'ajeno', section_ids: [], reference_ids: [] }] },
          ],
          warnings: [],
          provider: 'bad',
          model: null,
        };
      },
    };

    const repository = new InMemorySyllabusIndexRepository();
    const service = new SyllabusIndexFromDocumentsService({
      materials: materialRepo,
      documentClassification: classifier,
      sections: sectionRepo,
      sourceReferences: new InMemorySourceReferenceRepository(),
      repository,
      topics: {} as unknown as TopicServiceType,
      provider: badProvider,
    });

    await expect(
      service.proposeFromDocuments({ opposition_id: 'opp-1', workspace_id: 'ws-1' }),
    ).rejects.toBeTruthy();
    // El run quedo registrado como fallido (no se creo propuesta aplicable).
    const proposals = await repository.listProposalsByOpposition('opp-1');
    expect(proposals).toHaveLength(0);
  });
});
