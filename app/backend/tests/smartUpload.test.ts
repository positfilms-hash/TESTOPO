// Tests de SPEC 028 - Smart Bulk Upload: Materials & Old Exams.
//
// Cubre la carga masiva inteligente: dos categorias (material de oposicion /
// tests antiguos), desglose de ZIP/carpeta, clasificacion por carpeta en ZIP
// combinado, extraccion de texto, seguridad (Zip-Slip, ZIP anidado, extensiones,
// limites), permisos via PlatformService y la conexion con el indice IA
// (SPEC 019): carpetas -> sugerencias de tema/subtema, tests antiguos ->
// resumen de patrones SIN crear temas ni preguntas validadas.

import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
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
  SyllabusIndexService,
  InMemorySyllabusIndexRepository,
  PlatformService,
  SmartUploadError,
  SmartUploadErrorCode,
  AccessError,
  AccessErrorCode,
  type SmartUploadFile,
} from '../src/index.js';

const enc = new TextEncoder();

function pdfWithText(text = 'Hola mundo ficticio'): Uint8Array {
  const content = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  return enc.encode(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj',
      `4 0 obj << /Length ${content.length} >> stream`,
      content,
      'endstream endobj',
      '%%EOF',
    ].join('\n'),
  );
}

// PDF sin texto seleccionable (simula escaneado): el extractor da not_supported.
function pdfWithoutText(): Uint8Array {
  return enc.encode(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R >> endobj',
      '%%EOF',
    ].join('\n'),
  );
}

function file(path: string, bytes: Uint8Array): SmartUploadFile {
  const name = path.split('/').pop() ?? path;
  return { original_path: path, original_filename: name, bytes };
}

// --- Setup completo con PlatformService + SyllabusIndexService ----------------

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
  const materialImport = new MaterialImportService({
    materials: materialRepo,
    topics,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage,
    extractor,
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
  const syllabus = new SyllabusIndexService({
    materialRepository: materialRepo,
    topicService: topics,
    topicMaterialLinks: linkRepo,
    repository: new InMemorySyllabusIndexRepository(),
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
    syllabus,
    testGenerator,
    attempts,
  });
  return {
    users,
    workspaces,
    oppositions,
    materials,
    materialImport,
    questions,
    topics,
    platform,
  };
}

// Organizacion con admin, student (con acceso) y outsider (sin acceso).
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
  const outsider = await ctx.users.createUser({
    email: 'outsider@test.com',
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
  return { ...ctx, admin, student, outsider, ws, opp };
}

async function expectSmartError(
  fn: () => unknown,
  code: SmartUploadErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SmartUploadError);
    expect((error as SmartUploadError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected SmartUploadError (${code})`);
}

// --- Permisos -----------------------------------------------------------------

describe('SPEC 028 - permisos de carga masiva', () => {
  it('owner/admin puede subir material', async () => {
    const { platform, admin, opp } = await orgSetup();
    const { batch } = await platform.smartUpload(admin, {
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('intro.pdf', pdfWithText())],
    });
    expect(batch.imported_files).toBe(1);
    expect(batch.uploaded_by).toBe(admin.id);
  });

  it('un estudiante NO puede subir material', async () => {
    const { platform, student, opp } = await orgSetup();
    await expect(
      platform.smartUpload(student, {
        opposition_id: opp.id,
        upload_category: 'opposition_material',
        source_type: 'multi_file',
        files: [file('intro.pdf', pdfWithText())],
      }),
    ).rejects.toBeInstanceOf(AccessError);
  });

  it('un usuario sin acceso NO puede subir material', async () => {
    const { platform, outsider, opp } = await orgSetup();
    try {
      await platform.smartUpload(outsider, {
        opposition_id: opp.id,
        upload_category: 'opposition_material',
        source_type: 'multi_file',
        files: [file('intro.pdf', pdfWithText())],
      });
      throw new Error('Expected AccessError');
    } catch (error) {
      expect(error).toBeInstanceOf(AccessError);
      expect((error as AccessError).codes).toContain(
        AccessErrorCode.WORKSPACE_ACCESS_DENIED,
      );
    }
  });
});

// --- Categorias y desglose ----------------------------------------------------

describe('SPEC 028 - categorias y desglose', () => {
  it('material de oposicion crea materiales tipo syllabus', async () => {
    const { materialImport, materials, opp } = await orgSetup();
    await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('Constitucion.pdf', pdfWithText())],
    });
    const list = await materials.listMaterials({ opposition_id: opp.id });
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('syllabus');
    expect(list[0].status).toBe('active');
  });

  it('tests antiguos crean materiales tipo old_test', async () => {
    const { materialImport, materials, opp } = await orgSetup();
    await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'old_tests',
      source_type: 'multi_file',
      files: [file('Examen 2021.pdf', pdfWithText())],
    });
    const list = await materials.listMaterials({ opposition_id: opp.id });
    expect(list[0].type).toBe('old_test');
  });

  it('ZIP combinado detecta carpetas Material de la oposicion y Tests antiguos', async () => {
    const { materialImport, opp } = await orgSetup();
    const zip = zipSync({
      'Material de la oposicion/Tema 1/Constitucion.pdf': new Uint8Array(pdfWithText()),
      'Tests antiguos/Examen 2021.pdf': new Uint8Array(pdfWithText()),
    });
    const { items } = await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'mixed',
      source_type: 'zip',
      zip: { original_filename: 'oposicion.zip', bytes: zip },
    });
    const byName = (n: string) => items.find((i) => i.original_filename === n);
    expect(byName('Constitucion.pdf')?.detected_category).toBe('opposition_material');
    expect(byName('Examen 2021.pdf')?.detected_category).toBe('old_tests');
  });

  it('clasificacion ambigua queda con warning y detected unknown (needs_review)', async () => {
    const { materialImport, materials, opp } = await orgSetup();
    const zip = zipSync({
      'Carpeta rara/documento.pdf': new Uint8Array(pdfWithText()),
    });
    const { batch, items } = await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'mixed',
      source_type: 'zip',
      zip: { original_filename: 'mix.zip', bytes: zip },
    });
    expect(items[0].detected_category).toBe('unknown');
    expect(batch.warnings.length).toBeGreaterThan(0);
    const list = await materials.listMaterials({ opposition_id: opp.id });
    expect(list[0].status).toBe('needs_review');
  });

  it('NO crea temas definitivos automaticamente al subir', async () => {
    const { materialImport, topics, opp } = await orgSetup();
    const zip = zipSync({
      'Tema 1 - Constitucion/Constitucion.pdf': new Uint8Array(pdfWithText()),
    });
    await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'zip',
      zip: { original_filename: 'mat.zip', bytes: zip },
    });
    const allTopics = (await topics.listTopics()).filter(
      (t) => t.opposition_id === opp.id,
    );
    expect(allTopics).toHaveLength(0);
  });
});

// --- Extraccion ---------------------------------------------------------------

describe('SPEC 028 - extraccion de texto', () => {
  it('PDF con texto queda completed; sin texto queda not_supported (needs_review)', async () => {
    const { materialImport, materials, opp } = await orgSetup();
    await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [
        file('con-texto.pdf', pdfWithText()),
        file('escaneado.pdf', pdfWithoutText()),
      ],
    });
    const list = await materials.listMaterials({ opposition_id: opp.id });
    const withText = list.find((m) => m.original_filename === 'con-texto.pdf');
    const scanned = list.find((m) => m.original_filename === 'escaneado.pdf');
    expect(withText?.extraction_status).toBe('completed');
    expect(withText?.status).toBe('active');
    expect(scanned?.extraction_status).toBe('not_supported');
    expect(scanned?.status).toBe('needs_review');
  });

  it('TXT/MD guardan content_text', async () => {
    const { materialImport, materials, opp } = await orgSetup();
    await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [
        file('apuntes.txt', enc.encode('Texto plano ficticio')),
        file('notas.md', enc.encode('# Titulo ficticio')),
      ],
    });
    const list = await materials.listMaterials({ opposition_id: opp.id });
    expect(list.every((m) => (m.content_text ?? '').length > 0)).toBe(true);
  });

  it('analyzed_files cuenta solo materiales con texto extraido', async () => {
    const { materialImport, opp } = await orgSetup();
    const { batch } = await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('a.pdf', pdfWithText()), file('b.pdf', pdfWithoutText())],
    });
    expect(batch.imported_files).toBe(2);
    expect(batch.analyzed_files).toBe(1);
  });
});

// --- Seguridad ----------------------------------------------------------------

describe('SPEC 028 - seguridad', () => {
  it('rechaza rutas con ../', async () => {
    const { materialImport, opp } = await orgSetup();
    await expectSmartError(
      () =>
        materialImport.smartUpload({
          opposition_id: opp.id,
          upload_category: 'opposition_material',
          source_type: 'folder',
          files: [file('../escape.pdf', pdfWithText())],
        }),
      SmartUploadErrorCode.UNSAFE_PATH,
    );
  });

  it('rechaza rutas absolutas', async () => {
    const { materialImport, opp } = await orgSetup();
    await expectSmartError(
      () =>
        materialImport.smartUpload({
          opposition_id: opp.id,
          upload_category: 'opposition_material',
          source_type: 'folder',
          files: [file('/etc/passwd.pdf', pdfWithText())],
        }),
      SmartUploadErrorCode.UNSAFE_PATH,
    );
  });

  it('rechaza ZIP anidado', async () => {
    const { materialImport, opp } = await orgSetup();
    const inner = zipSync({ 'x.pdf': new Uint8Array(pdfWithText()) });
    const outer = zipSync({ 'nested.zip': new Uint8Array(inner) });
    await expectSmartError(
      () =>
        materialImport.smartUpload({
          opposition_id: opp.id,
          upload_category: 'opposition_material',
          source_type: 'zip',
          zip: { original_filename: 'outer.zip', bytes: outer },
        }),
      SmartUploadErrorCode.NESTED_ZIP_NOT_ALLOWED,
    );
  });

  it('omite extensiones peligrosas (item skipped, no aborta el lote)', async () => {
    const { materialImport, opp } = await orgSetup();
    const { batch, items } = await materialImport.smartUpload({
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [
        file('ok.pdf', pdfWithText()),
        file('malware.exe', enc.encode('MZ')),
      ],
    });
    expect(batch.imported_files).toBe(1);
    expect(items.find((i) => i.original_filename === 'malware.exe')?.status).toBe(
      'skipped',
    );
  });

  it('rechaza lote demasiado grande', async () => {
    const { materialImport, opp } = await orgSetup();
    const files: SmartUploadFile[] = [];
    for (let i = 0; i < 501; i++) {
      files.push(file(`f${i}.txt`, strToU8(`x${i}`)));
    }
    await expectSmartError(
      () =>
        materialImport.smartUpload({
          opposition_id: opp.id,
          upload_category: 'opposition_material',
          source_type: 'multi_file',
          files,
        }),
      SmartUploadErrorCode.TOO_MANY_FILES,
    );
  });

  it('exige oposicion', async () => {
    const { materialImport } = await orgSetup();
    await expectSmartError(
      () =>
        materialImport.smartUpload({
          upload_category: 'opposition_material',
          source_type: 'multi_file',
          files: [file('a.pdf', pdfWithText())],
        }),
      SmartUploadErrorCode.OPPOSITION_REQUIRED,
    );
  });
});

// --- Conexion con IA (SPEC 019) ----------------------------------------------

describe('SPEC 028 - conexion con indice IA y patrones de examen', () => {
  it('carpetas crean sugerencias de tema y subcarpetas de subtema, pendientes de revision', async () => {
    const { platform, admin, opp } = await orgSetup();
    const zip = zipSync({
      'Tema 1 - Constitucion/Subtema A/Constitucion.pdf': new Uint8Array(
        pdfWithText('Texto de la constitucion ficticia'),
      ),
    });
    const { items } = await platform.smartUpload(admin, {
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'zip',
      zip: { original_filename: 'mat.zip', bytes: zip },
    });
    const folderPaths: Record<string, string> = {};
    for (const item of items) {
      if (item.material_id) folderPaths[item.material_id] = item.original_path;
    }
    const detail = await platform.proposeSyllabusIndex(admin, {
      opposition_id: opp.id,
      folder_paths: folderPaths,
    });
    // La propuesta nace pendiente de revision y NO aplicada.
    expect(detail.proposal.status).toBe('pending_review');
    const titles = detail.nodes.map((n) => n.title);
    expect(titles).toContain('Tema 1 - Constitucion');
    expect(titles).toContain('Subtema A');
    // El subtema cuelga del tema (no es raiz).
    const tema = detail.nodes.find((n) => n.title === 'Tema 1 - Constitucion');
    const subtema = detail.nodes.find((n) => n.title === 'Subtema A');
    expect(subtema?.parent_id).toBe(tema?.id);
  });

  it('indice IA no se aplica sin aprobacion', async () => {
    const { platform, admin, opp } = await orgSetup();
    await platform.smartUpload(admin, {
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('Constitucion.pdf', pdfWithText('Texto ficticio'))],
    });
    const detail = await platform.proposeSyllabusIndex(admin, {
      opposition_id: opp.id,
    });
    await expect(
      platform.applySyllabusProposal(admin, detail.proposal.id),
    ).rejects.toBeTruthy();
  });

  it('tests antiguos generan resumen de patrones y NO crean temas ni preguntas', async () => {
    const { platform, admin, opp, questions, topics } = await orgSetup();
    const { batch } = await platform.smartUpload(admin, {
      opposition_id: opp.id,
      upload_category: 'old_tests',
      source_type: 'multi_file',
      files: [file('Examen 2021.pdf', pdfWithText('Pregunta 1 ficticia'))],
    });
    const detail = await platform.proposeSyllabusIndex(admin, {
      opposition_id: opp.id,
      batch_id: batch.id,
    });
    // Hay resumen de patron de examen, sellado con el lote y la oposicion.
    expect(detail.exam_patterns.length).toBeGreaterThan(0);
    expect(detail.exam_patterns[0].batch_id).toBe(batch.id);
    expect(detail.exam_patterns[0].opposition_id).toBe(opp.id);
    // No se han propuesto temas a partir de los tests antiguos.
    expect(detail.nodes).toHaveLength(0);
    // No se ha creado ninguna pregunta (mucho menos validada).
    const all = await questions.listQuestions();
    expect(all).toHaveLength(0);
    // No se han creado temas definitivos.
    const allTopics = (await topics.listTopics()).filter(
      (t) => t.opposition_id === opp.id,
    );
    expect(allTopics).toHaveLength(0);
  });
});

// --- Visibilidad para el estudiante (SPEC 028, 29) ---------------------------

describe('SPEC 028 - el estudiante no ve tests antiguos', () => {
  it('listMaterials oculta old_test/official_exam al alumno aunque esten active', async () => {
    const { platform, admin, student, opp } = await orgSetup();
    await platform.smartUpload(admin, {
      opposition_id: opp.id,
      upload_category: 'opposition_material',
      source_type: 'multi_file',
      files: [file('Tema.pdf', pdfWithText())],
    });
    const { items } = await platform.smartUpload(admin, {
      opposition_id: opp.id,
      upload_category: 'old_tests',
      source_type: 'multi_file',
      files: [file('Examen 2021.pdf', pdfWithText())],
    });
    const oldTestMaterialId = items[0].material_id as string;

    // El alumno con acceso solo ve el material de estudio.
    const visible = await platform.listMaterials(student, opp.id);
    expect(
      visible.every((m) => m.type !== 'old_test' && m.type !== 'official_exam'),
    ).toBe(true);
    expect(visible.some((m) => m.type === 'syllabus')).toBe(true);

    // No puede abrir el detalle de un test antiguo.
    await expect(
      platform.getMaterial(student, oldTestMaterialId),
    ).rejects.toBeInstanceOf(AccessError);

    // El gestor si los ve.
    const adminView = await platform.listMaterials(admin, opp.id);
    expect(adminView.some((m) => m.type === 'old_test')).toBe(true);
  });

  it('rechaza una upload_category invalida (validacion en runtime)', async () => {
    const { materialImport, opp } = await orgSetup();
    await expectSmartError(
      () =>
        materialImport.smartUpload({
          opposition_id: opp.id,
          // Valor invalido que TS no deja pasar normalmente, pero una llamada
          // directa al servicio podria colar.
          upload_category: 'bogus' as never,
          source_type: 'multi_file',
          files: [file('a.pdf', pdfWithText())],
        }),
      SmartUploadErrorCode.INVALID_CATEGORY,
    );
  });
});
