// Tests de SPEC 028-B - Document Classification & Import Inventory.
//
// Cubre el clasificador heuristico (determinista, sin red), el servicio de
// clasificacion/inventario, la correccion humana, los permisos y el cierre del
// riesgo de SPEC 028 (§17.1: el alumno no ve tests antiguos ni documentos no
// aptos). No genera indice ni preguntas.

import { describe, expect, it } from 'vitest';
import {
  HeuristicDocumentClassifier,
  DocumentClassificationService,
  groupByClassification,
  InMemoryDocumentUnderstandingRunRepository,
  InMemoryDocumentClassificationRepository,
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
  InMemorySupabasePort,
  SupabaseDocumentUnderstandingRunRepository,
  SupabaseDocumentClassificationRepository,
  type DocumentUnderstandingRun,
  type DocumentClassification,
  type DocumentClassificationProviderInput,
  type SmartUploadFile,
} from '../src/index.js';

const enc = new TextEncoder();

function input(
  partial: Partial<DocumentClassificationProviderInput> & { text: string; filename: string },
): DocumentClassificationProviderInput {
  return {
    material_id: 'm1',
    title: partial.filename,
    original_path: partial.filename,
    upload_category: null,
    detected_category: null,
    page_count: null,
    ...partial,
  };
}

const EXAM_TEXT = [
  '1. Cual es la norma suprema del ordenamiento?',
  'a) La ley ordinaria',
  'b) El reglamento',
  'c) La Constitucion',
  'd) La costumbre',
  '2. Segunda pregunta de ejemplo',
  'a) Opcion uno',
  'b) Opcion dos',
  'c) Opcion tres',
  'd) Opcion cuatro',
].join('\n');

const SYLLABUS_TEXT =
  'Tema 1. La organizacion administrativa del Estado se estructura en ' +
  'departamentos ministeriales y organismos publicos. El presente desarrollo ' +
  'teorico explica con detalle los principios de jerarquia, competencia y ' +
  'coordinacion que rigen la actuacion de las administraciones publicas en el ' +
  'ejercicio de sus potestades y funciones cotidianas dentro del sector.';

const LEGAL_TEXT =
  'Ley 39/2015 del Procedimiento Administrativo Comun de las Administraciones ' +
  'Publicas. Articulo 1. La presente ley tiene por objeto regular los requisitos ' +
  'de validez y eficacia de los actos administrativos.';

const NOTES_TEXT = 'Esquema de plazos: 10 dias, 15 dias y 3 meses segun el caso.';

const INDEX_TEXT = [
  'Tema 1 - Constitucion',
  'Tema 2 - Procedimiento',
  'Tema 3 - Recursos',
  'Tema 4 - Organizacion',
  'Tema 5 - Personal',
].join('\n');

// --- Clasificador heuristico (unidad) ----------------------------------------

describe('SPEC 028-B - HeuristicDocumentClassifier', () => {
  const classifier = new HeuristicDocumentClassifier();

  it('clasifica preguntas A/B/C/D como old_exam_or_test', async () => {
    const out = await classifier.classify(
      input({ filename: 'Examen 2021.txt', text: EXAM_TEXT }),
    );
    expect(out.classification).toBe('old_exam_or_test');
    expect(out.detected_question_count).toBeGreaterThan(0);
  });

  it('clasifica desarrollo teorico como syllabus_material', async () => {
    const out = await classifier.classify(
      input({ filename: 'Tema 1 Organizacion.txt', text: SYLLABUS_TEXT }),
    );
    expect(out.classification).toBe('syllabus_material');
  });

  it('clasifica una ley como legal_text', async () => {
    const out = await classifier.classify(
      input({ filename: 'Ley 39-2015.txt', text: LEGAL_TEXT }),
    );
    expect(out.classification).toBe('legal_text');
  });

  it('clasifica apuntes/resumen como notes_or_summary', async () => {
    const out = await classifier.classify(
      input({ filename: 'Resumen plazos.txt', text: NOTES_TEXT }),
    );
    expect(out.classification).toBe('notes_or_summary');
  });

  it('clasifica un programa con lista de temas como index_or_table_of_contents', async () => {
    const out = await classifier.classify(
      input({ filename: 'Programa oficial.txt', text: INDEX_TEXT }),
    );
    expect(out.classification).toBe('index_or_table_of_contents');
  });

  it('marca not_analyzable cuando no hay texto', async () => {
    const out = await classifier.classify(
      input({ filename: 'escaneado.pdf', text: '' }),
    );
    expect(out.classification).toBe('not_analyzable');
  });

  it('marca ambiguous cuando no hay senales claras', async () => {
    const out = await classifier.classify(
      input({ filename: 'doc.txt', text: 'lorem ipsum dolor sit amet consectetur' }),
    );
    expect(out.classification).toBe('ambiguous');
    expect(out.confidence).toBeLessThan(0.75);
  });

  it('una sola senal debil da baja confianza (< umbral)', async () => {
    const out = await classifier.classify(
      input({
        filename: 'doc.txt',
        text: 'Contenido variado sin senales claras presente aqui mismo.',
        detected_category: 'opposition_material',
      }),
    );
    expect(out.classification).toBe('syllabus_material');
    expect(out.confidence).toBeLessThan(0.75);
  });
});

// --- Setup de integracion (PlatformService con clasificacion) -----------------

function file(path: string, text: string): SmartUploadFile {
  const name = path.split('/').pop() ?? path;
  return { original_path: path, original_filename: name, bytes: enc.encode(text) };
}

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
  // Repos de importacion COMPARTIDOS entre import y clasificacion.
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
    testGenerator,
    attempts,
  });
  return { users, workspaces, oppositions, questions, materials, platform };
}

async function orgSetup() {
  const ctx = await makeSetup();
  const admin = await ctx.users.createUser({ email: 'a@t.com', password: 'x', role: 'admin' });
  const student = await ctx.users.createUser({ email: 's@t.com', password: 'y', role: 'student' });
  const ws = await ctx.workspaces.createOrganizationWorkspace(admin, { name: 'Academia', slug: 'academia' });
  await ctx.workspaces.addMember(admin, { workspace_id: ws.id, user_id: student.id, role: 'student' });
  const opp = await ctx.oppositions.createOpposition(admin, { workspace_id: ws.id, title: 'Aux', slug: 'aux' });
  await ctx.oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });
  return { ...ctx, admin, student, ws, opp };
}

// --- Servicio / inventario / permisos ----------------------------------------

describe('SPEC 028-B - clasificacion de un lote e inventario', () => {
  async function uploadAndClassify() {
    const ctx = await orgSetup();
    const { batch } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [
        file('Tema 1 Organizacion.txt', SYLLABUS_TEXT),
        file('Examen 2021.txt', EXAM_TEXT),
        file('Ley 39-2015.txt', LEGAL_TEXT),
        file('escaneado.txt', ''),
      ],
    });
    const inventory = await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
    return { ...ctx, batch, inventory };
  }

  it('crea run + classification por material y agrupa por clasificacion', async () => {
    const { inventory } = await uploadAndClassify();
    expect(inventory.run?.status).toMatch(/completed/);
    // 3 con texto + 1 sin texto = 4 materiales clasificados.
    expect(inventory.classifications.length).toBe(4);
    const groups = groupByClassification(inventory.classifications);
    expect(groups.syllabus_material?.length).toBe(1);
    expect(groups.old_exam_or_test?.length).toBe(1);
    expect(groups.legal_text?.length).toBe(1);
    expect(groups.not_analyzable?.length).toBe(1);
  });

  it('los dudosos/no analizables quedan needs_review y exponen razon/confianza', async () => {
    const { inventory } = await uploadAndClassify();
    const notAnalyzable = inventory.classifications.find(
      (c) => c.classification === 'not_analyzable',
    );
    expect(notAnalyzable?.needs_review).toBe(true);
    expect(notAnalyzable?.reason).toBeTruthy();
    const exam = inventory.classifications.find((c) => c.classification === 'old_exam_or_test');
    expect(typeof exam?.confidence).toBe('number');
  });

  it('getDocumentInventory devuelve la ultima ejecucion', async () => {
    const { platform, admin, batch } = await uploadAndClassify();
    const inv = await platform.getDocumentInventory(admin, batch.id);
    expect(inv.run).not.toBeNull();
    expect(inv.classifications.length).toBe(4);
  });
});

describe('SPEC 028-B - correccion humana', () => {
  it('admin corrige y la correccion marca manually_corrected y prevalece', async () => {
    const ctx = await orgSetup();
    // Se sube como tests antiguos: el examen se clasifica old_exam_or_test, pero
    // el admin decide reclasificarlo (la correccion humana prevalece).
    const { batch } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'old_tests',
      source_type: 'multi_file',
      files: [file('Examen 2021.txt', EXAM_TEXT)],
    });
    const { classifications } = await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
    const target = classifications[0];
    expect(target.classification).toBe('old_exam_or_test');

    const corrected = await ctx.platform.correctDocumentClassification(
      ctx.admin,
      target.id,
      'syllabus_material',
    );
    expect(corrected.classification).toBe('syllabus_material');
    expect(corrected.manually_corrected).toBe(true);
    expect(corrected.corrected_by).toBe(ctx.admin.id);
    expect(corrected.needs_review).toBe(false);

    // Persiste: el inventario refleja la correccion.
    const inv = await ctx.platform.getDocumentInventory(ctx.admin, batch.id);
    expect(inv.classifications[0].classification).toBe('syllabus_material');
    expect(inv.classifications[0].manually_corrected).toBe(true);
  });

  it('un estudiante no puede clasificar ni corregir ni ver el inventario', async () => {
    const ctx = await orgSetup();
    const { batch } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('Tema 1.txt', SYLLABUS_TEXT)],
    });
    const { classifications } = await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
    await expect(
      ctx.platform.classifyImportBatch(ctx.student, batch.id),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      ctx.platform.getDocumentInventory(ctx.student, batch.id),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      ctx.platform.correctDocumentClassification(ctx.student, classifications[0].id, 'legal_text'),
    ).rejects.toBeInstanceOf(AccessError);
  });
});

describe('SPEC 028-B - visibilidad del alumno (§17.1)', () => {
  it('el alumno no ve materiales clasificados como old_exam_or_test', async () => {
    const ctx = await orgSetup();
    const { batch } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [
        file('Tema 1 Organizacion.txt', SYLLABUS_TEXT),
        file('Examen 2021.txt', EXAM_TEXT),
      ],
    });
    await ctx.platform.classifyImportBatch(ctx.admin, batch.id);

    const visible = await ctx.platform.listMaterials(ctx.student, ctx.opp.id);
    expect(visible.every((m) => m.title !== 'Examen 2021')).toBe(true);
    // El de estudio (clasificado syllabus) sigue visible si quedo active.
    const adminView = await ctx.platform.listMaterials(ctx.admin, ctx.opp.id);
    expect(adminView.length).toBe(2);
  });
});

describe('SPEC 028-B - repositorios Supabase (mapeo)', () => {
  const NOW = new Date('2026-06-19T00:00:00Z');

  it('crea/lee run y classification mapeando columnas nuevas', async () => {
    const port = new InMemorySupabasePort();
    const runs = new SupabaseDocumentUnderstandingRunRepository(port);
    const classifications = new SupabaseDocumentClassificationRepository(port);

    const run: DocumentUnderstandingRun = {
      id: 'run-1',
      workspace_id: 'ws-1',
      opposition_id: 'opo-1',
      batch_id: 'batch-1',
      created_by: 'admin',
      status: 'completed',
      provider: 'heuristic',
      model: null,
      total_materials: 2,
      classified_materials: 2,
      needs_review_count: 1,
      not_analyzable_count: 1,
      warnings: ['aviso'],
      errors: [],
      created_at: NOW,
      updated_at: NOW,
    };
    await runs.create(run);
    expect((await runs.findById('run-1'))?.needs_review_count).toBe(1);
    expect((await runs.findByBatch('batch-1')).length).toBe(1);

    const classification: DocumentClassification = {
      id: 'cls-1',
      workspace_id: 'ws-1',
      opposition_id: 'opo-1',
      material_id: 'm-1',
      run_id: 'run-1',
      classification: 'old_exam_or_test',
      confidence: 0.9,
      reason: 'preguntas',
      detected_title: 'Examen',
      detected_document_date: null,
      detected_question_count: 80,
      detected_page_count: 4,
      needs_review: false,
      manually_corrected: false,
      corrected_by: null,
      corrected_at: null,
      warnings: [],
      created_at: NOW,
      updated_at: NOW,
    };
    await classifications.create(classification);
    expect((await classifications.findByMaterial('m-1'))?.classification).toBe(
      'old_exam_or_test',
    );
    const corrected = await classifications.save({
      ...classification,
      classification: 'syllabus_material',
      manually_corrected: true,
      corrected_by: 'admin',
      corrected_at: NOW,
    });
    expect(corrected.manually_corrected).toBe(true);
    expect((await classifications.findByRun('run-1')).length).toBe(1);
  });
});

describe('SPEC 028-B - regresion', () => {
  it('no se generan preguntas ni se rompe la subida', async () => {
    const ctx = await orgSetup();
    const { batch } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('Tema 1.txt', SYLLABUS_TEXT)],
    });
    expect(batch.imported_files).toBe(1);
    await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
    expect(await ctx.questions.listQuestions()).toHaveLength(0);
  });
});
