// Tests de SPEC 028-C - Material Sections & Source References.
//
// Cubre la segmentacion pura (`segmentText`), el servicio de secciones (creacion
// por clase util, exclusion de no aptos, reprocesado, busqueda), las referencias
// de fuente, los permisos y el cierre via facade. No genera indice ni preguntas.

import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import {
  segmentText,
  MaterialSectionService,
  SourceReferenceService,
  InMemoryMaterialSectionRepository,
  InMemorySourceReferenceRepository,
  HeuristicDocumentClassifier,
  DocumentClassificationService,
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
  SupabaseMaterialSectionRepository,
  SupabaseSourceReferenceRepository,
  type MaterialSection,
  type SourceReference,
  type SmartUploadFile,
} from '../src/index.js';

const enc = new TextEncoder();

const SYLLABUS_TEXT =
  'Tema 1. La organizacion administrativa del Estado se estructura en ' +
  'departamentos ministeriales y organismos publicos con detalle suficiente. ' +
  'Tema 2. El procedimiento administrativo comun regula los actos, los plazos y ' +
  'los recursos disponibles para los interesados en sus relaciones con la ' +
  'administracion publica espanola moderna actual.';

const LEGAL_TEXT =
  'Ley 39/2015 del Procedimiento Administrativo Comun. Articulo 1. Objeto de la ' +
  'ley y ambito de aplicacion general. Articulo 2. Ambito subjetivo de aplicacion ' +
  'a las administraciones publicas y al sector publico institucional descrito.';

const NOTES_TEXT = 'Resumen de plazos: 10 dias, 15 dias y 3 meses segun el caso descrito.';

const INDEX_TEXT =
  'Programa oficial. Tema 1 Constitucion. Tema 2 Procedimiento. Tema 3 Recursos. ' +
  'Tema 4 Organizacion. Tema 5 Personal al servicio publico.';

const EXAM_TEXT = [
  '1. Cual es la norma suprema?',
  'a) La ley b) El reglamento c) La Constitucion d) La costumbre',
  '2. Segunda pregunta de ejemplo del simulacro',
  'a) Uno b) Dos c) Tres d) Cuatro',
].join(' ');

// --- segmentText (unidad) ----------------------------------------------------

describe('SPEC 028-C - segmentText', () => {
  it('divide por epigrafes (TEMA/Articulo) cuando hay >= 2', () => {
    const segs = segmentText(SYLLABUS_TEXT, 'syllabus_material');
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs.every((s) => s.section_type === 'heading')).toBe(true);
    expect(segs[0].section_title.toLowerCase()).toContain('tema 1');
    expect(segs.map((s) => s.order_index)).toEqual(segs.map((_, i) => i));
  });

  it('usa chunks cuando no hay estructura', () => {
    const long = 'palabra '.repeat(700); // ~5600 chars, sin epigrafes
    const segs = segmentText(long, 'notes_or_summary');
    expect(segs.length).toBeGreaterThan(1);
    expect(segs.every((s) => s.section_type === 'chunk')).toBe(true);
    expect(segs[0].section_title).toBe('Fragmento 1');
  });

  it('un texto corto sin estructura da un solo fragmento con excerpt', () => {
    const segs = segmentText('texto corto de estudio sin epigrafes', 'syllabus_material');
    expect(segs).toHaveLength(1);
    expect(segs[0].content_excerpt).toBeTruthy();
  });

  it('tests antiguos producen bloques de preguntas', () => {
    const segs = segmentText(EXAM_TEXT, 'old_exam_or_test');
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs[0].section_type).toBe('exam_question_block');
    expect(segs[0].section_title.toLowerCase()).toContain('preguntas');
  });

  it('indice produce bloques toc_block', () => {
    const segs = segmentText(INDEX_TEXT, 'index_or_table_of_contents');
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs.every((s) => s.section_type === 'toc_block')).toBe(true);
  });

  it('sin texto no produce secciones', () => {
    expect(segmentText('', 'syllabus_material')).toHaveLength(0);
  });
});

// --- Setup de integracion ----------------------------------------------------

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
    testGenerator,
    attempts,
  });
  return { users, workspaces, oppositions, questions, platform };
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

// Sube un TXT como material de oposicion, clasifica el lote y devuelve materialId.
async function uploadClassify(
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
  return items[0].material_id as string;
}

// --- Creacion de secciones por clase -----------------------------------------

describe('SPEC 028-C - creacion de secciones por clase util', () => {
  it('crea secciones para syllabus_material, legal_text, notes y old_exam', async () => {
    const ctx = await orgSetup();
    const syllabusId = await uploadClassify(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const legalId = await uploadClassify(ctx, 'Ley 39-2015.txt', LEGAL_TEXT);
    const notesId = await uploadClassify(ctx, 'Resumen plazos.txt', NOTES_TEXT);
    const examId = await uploadClassify(ctx, 'Examen 2021.txt', EXAM_TEXT, 'old_tests');

    for (const id of [syllabusId, legalId, notesId, examId]) {
      const sections = await ctx.platform.createMaterialSections(ctx.admin, id);
      expect(sections.length).toBeGreaterThanOrEqual(1);
      expect(sections[0].content_text.length).toBeGreaterThan(0);
      expect(sections[0].content_excerpt.length).toBeGreaterThan(0);
      expect(sections.map((s) => s.order_index)).toEqual(sections.map((_, i) => i));
    }
  });

  it('NO crea secciones para no analizable (PDF sin texto)', async () => {
    const ctx = await orgSetup();
    const id = await uploadClassify(ctx, 'escaneado.txt', ''); // sin texto
    await expect(
      ctx.platform.createMaterialSections(ctx.admin, id),
    ).rejects.toBeTruthy();
  });

  it('NO crea secciones para irrelevant', async () => {
    const ctx = await orgSetup();
    const id = await uploadClassify(
      ctx,
      'publicidad.txt',
      'Publicidad: oferta y descuento, matriculate ya en la academia con promocion.',
    );
    await expect(
      ctx.platform.createMaterialSections(ctx.admin, id),
    ).rejects.toBeTruthy();
  });

  it('ambiguous no corregido no genera secciones; corregido a util si', async () => {
    const ctx = await orgSetup();
    // ZIP combinado con carpeta desconocida -> detected unknown -> ambiguous.
    const zip = zipSync({
      'Carpeta rara/dudoso.txt': new Uint8Array(enc.encode('lorem ipsum dolor sit amet consectetur largo suficiente para analizar bien.')),
    });
    const { batch, items } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: ctx.opp.id,
      upload_category: 'mixed',
      source_type: 'zip',
      zip: { original_filename: 'mix.zip', bytes: zip },
    });
    const { classifications } = await ctx.platform.classifyImportBatch(ctx.admin, batch.id);
    expect(classifications[0].classification).toBe('ambiguous');
    const materialId = items[0].material_id as string;

    await expect(
      ctx.platform.createMaterialSections(ctx.admin, materialId),
    ).rejects.toBeTruthy();

    // Correccion humana a clase util -> ahora si.
    await ctx.platform.correctDocumentClassification(
      ctx.admin,
      classifications[0].id,
      'syllabus_material',
    );
    const sections = await ctx.platform.createMaterialSections(ctx.admin, materialId);
    expect(sections.length).toBeGreaterThanOrEqual(1);
  });
});

// --- Source references -------------------------------------------------------

describe('SPEC 028-C - referencias de fuente', () => {
  it('crea una referencia por seccion y se listan por material y seccion', async () => {
    const ctx = await orgSetup();
    const id = await uploadClassify(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const sections = await ctx.platform.createMaterialSections(ctx.admin, id);

    const refs = await ctx.platform.listSourceReferencesByMaterial(ctx.admin, id);
    expect(refs.length).toBe(sections.length);
    expect(refs[0].material_id).toBe(id);
    expect(refs[0].material_section_id).toBeTruthy();
    expect(refs[0].source_excerpt.length).toBeGreaterThan(0);
    expect(refs[0].reference_type).toBe('material_section');
  });
});

// --- Busqueda ----------------------------------------------------------------

describe('SPEC 028-C - busqueda basica', () => {
  it('busca por texto y no cruza oposiciones', async () => {
    const ctx = await orgSetup();
    const oppB = await ctx.oppositions.createOpposition(ctx.admin, {
      workspace_id: ctx.ws.id,
      title: 'Otra',
      slug: 'otra',
    });
    const idA = await uploadClassify(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    await ctx.platform.createMaterialSections(ctx.admin, idA);
    // Material en la oposicion B con otro texto.
    const { batch: batchB, items: itemsB } = await ctx.platform.smartUpload(ctx.admin, {
      opposition_id: oppB.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('Tema X.txt', 'Tema 1 contenido exclusivo de la oposicion beta distinta.')],
    });
    await ctx.platform.classifyImportBatch(ctx.admin, batchB.id);
    await ctx.platform.createMaterialSections(ctx.admin, itemsB[0].material_id as string);

    const results = await ctx.platform.searchMaterialSections(ctx.admin, {
      opposition_id: ctx.opp.id,
      query: 'organizacion administrativa',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((s) => s.opposition_id === ctx.opp.id)).toBe(true);
  });
});

// --- Reprocesamiento ---------------------------------------------------------

describe('SPEC 028-C - reprocesamiento', () => {
  it('reprocesar reemplaza las secciones anteriores', async () => {
    const ctx = await orgSetup();
    const id = await uploadClassify(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    const first = await ctx.platform.createMaterialSections(ctx.admin, id);
    const reprocessed = await ctx.platform.reprocessMaterialSections(ctx.admin, id);
    const listed = await ctx.platform.listMaterialSections(ctx.admin, id);
    expect(listed.length).toBe(reprocessed.length);
    // Los ids cambian (se reemplazan, no se acumulan).
    expect(listed.length).toBe(first.length);
    const firstIds = new Set(first.map((s) => s.id));
    expect(listed.some((s) => firstIds.has(s.id))).toBe(false);
  });
});

// --- Permisos ----------------------------------------------------------------

describe('SPEC 028-C - permisos', () => {
  it('el estudiante no puede crear, listar ni buscar secciones', async () => {
    const ctx = await orgSetup();
    const id = await uploadClassify(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    await ctx.platform.createMaterialSections(ctx.admin, id);

    await expect(
      ctx.platform.createMaterialSections(ctx.student, id),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      ctx.platform.listMaterialSections(ctx.student, id),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      ctx.platform.searchMaterialSections(ctx.student, {
        opposition_id: ctx.opp.id,
        query: 'organizacion',
      }),
    ).rejects.toBeInstanceOf(AccessError);
  });
});

// --- Regresion ---------------------------------------------------------------

describe('SPEC 028-C - regresion', () => {
  it('no se generan preguntas ni se rompe la subida/clasificacion', async () => {
    const ctx = await orgSetup();
    const id = await uploadClassify(ctx, 'Tema 1 Org.txt', SYLLABUS_TEXT);
    await ctx.platform.createMaterialSections(ctx.admin, id);
    expect(await ctx.questions.listQuestions()).toHaveLength(0);
  });
});

// --- Repositorios Supabase (mapeo) -------------------------------------------

describe('SPEC 028-C - repositorios Supabase (mapeo)', () => {
  const NOW = new Date('2026-06-19T00:00:00Z');

  it('crea/lee/borra secciones y referencias mapeando columnas', async () => {
    const port = new InMemorySupabasePort();
    const sections = new SupabaseMaterialSectionRepository(port);
    const references = new SupabaseSourceReferenceRepository(port);

    const section: MaterialSection = {
      id: 'sec-1',
      workspace_id: 'ws-1',
      opposition_id: 'opo-1',
      material_id: 'm-1',
      section_title: 'Tema 1',
      section_type: 'heading',
      page_start: null,
      page_end: null,
      content_excerpt: 'excerpt',
      content_text: 'texto completo de la seccion',
      order_index: 0,
      classification: 'study_content',
      source_path: 'Tema 1.pdf - Tema 1',
      status: 'active',
      created_at: NOW,
      updated_at: NOW,
    };
    await sections.createMany([section]);
    expect((await sections.listByMaterial('m-1')).length).toBe(1);
    expect((await sections.search({ opposition_id: 'opo-1', query: 'seccion' })).length).toBe(1);

    const reference: SourceReference = {
      id: 'ref-1',
      workspace_id: 'ws-1',
      opposition_id: 'opo-1',
      material_id: 'm-1',
      material_section_id: 'sec-1',
      reference_type: 'material_section',
      label: 'Tema 1',
      page_start: null,
      page_end: null,
      source_excerpt: 'excerpt',
      confidence: null,
      created_at: NOW,
      updated_at: NOW,
    };
    await references.create(reference);
    expect((await references.listByMaterial('m-1')).length).toBe(1);
    expect((await references.listBySection('sec-1')).length).toBe(1);

    await sections.deleteByMaterial('m-1');
    expect((await sections.listByMaterial('m-1')).length).toBe(0);
  });
});
