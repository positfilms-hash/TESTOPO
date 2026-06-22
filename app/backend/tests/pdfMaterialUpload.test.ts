// Tests de SPEC 012 - PDF Material Upload & Basic Text Extraction.
//
// Cubre validaciones de archivo/oposicion/temas, registro como Material,
// guardado fuera del repo (FileStorage), extraccion basica de texto (texto
// seleccionable -> completed; sin texto -> not_supported) y los permisos del
// facade (owner/admin sube; student solo ve material activo).

import { describe, expect, it } from 'vitest';
import {
  InMemoryMaterialRepository,
  InMemoryTopicRepository,
  InMemoryTopicMaterialLinkRepository,
  InMemoryOppositionRepository,
  InMemoryOppositionAccessRepository,
  InMemoryFileStorage,
  StubPdfTextExtractor,
  PdfMaterialService,
  PdfUploadError,
  PdfErrorCode,
  MAX_PDF_SIZE_BYTES,
  MaterialImportService,
  FflateZipReader,
  InMemoryMaterialImportBatchRepository,
  InMemoryMaterialImportItemRepository,
  InMemoryUserRepository,
  UserService,
  InMemoryWorkspaceRepository,
  InMemoryWorkspaceMemberRepository,
  WorkspaceService,
  OppositionService,
  MaterialService,
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
  type Opposition,
  type Topic,
} from '../src/index.js';

const enc = new TextEncoder();

// PDF minimo con texto seleccionable (stream de contenido SIN comprimir).
function pdfWithText(text = 'Hola mundo de prueba'): Uint8Array {
  const content = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj',
    `4 0 obj << /Length ${content.length} >> stream`,
    content,
    'endstream endobj',
    '%%EOF',
  ].join('\n');
  return enc.encode(pdf);
}

// PDF sin texto seleccionable (sin bloques BT...ET): simula PDF escaneado.
function pdfWithoutText(): Uint8Array {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R >> endobj',
    '%%EOF',
  ].join('\n');
  return enc.encode(pdf);
}

function makeOpposition(id: string, workspaceId: string): Opposition {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id,
    workspace_id: workspaceId,
    title: `Oposicion ${id}`,
    description: null,
    slug: id,
    status: 'active',
    created_by: 'system',
    created_at: now,
    updated_at: now,
  };
}

function makeTopic(id: string, oppositionId: string): Topic {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id,
    opposition_id: oppositionId,
    title: `Tema ${id}`,
    description: null,
    code: null,
    parent_id: null,
    order: 0,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}

// --- Setup a nivel de servicio (validaciones, almacenamiento, extraccion) ---
async function makeServiceSetup() {
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const linkRepo = new InMemoryTopicMaterialLinkRepository();
  const oppositionRepo = new InMemoryOppositionRepository();
  const storage = new InMemoryFileStorage();

  const opposition = await oppositionRepo.create(makeOpposition('opp-1', 'ws-1'));
  const otherOpposition = await oppositionRepo.create(makeOpposition('opp-2', 'ws-1'));
  const topic = await topicRepo.create(makeTopic('topic-1', opposition.id));
  const foreignTopic = await topicRepo.create(makeTopic('topic-x', otherOpposition.id));

  let counter = 0;
  const service = new PdfMaterialService({
    materials: materialRepo,
    topics: topicRepo,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage,
    extractor: new StubPdfTextExtractor(),
    generateId: () => `gen-${++counter}`,
    now: () => new Date('2026-01-02T00:00:00Z'),
  });

  return {
    service,
    storage,
    materialRepo,
    linkRepo,
    opposition,
    otherOpposition,
    topic,
    foreignTopic,
  };
}

function validInput(oppositionId: string) {
  return {
    opposition_id: oppositionId,
    title: 'Tema 1 Constitucion',
    type: 'syllabus' as const,
    reference: 'Tema 1',
    file: {
      original_filename: 'tema-1.pdf',
      mime_type: 'application/pdf',
      bytes: pdfWithText(),
    },
  };
}

async function expectPdfCodes(fn: () => unknown, code: PdfErrorCode): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PdfUploadError);
    expect((error as PdfUploadError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected PdfUploadError (${code})`);
}

describe('PdfMaterialService - subida y validaciones', () => {
  it('registra el PDF como Material con metadata y oposicion correcta', async () => {
    const { service, opposition } = await makeServiceSetup();
    const material = await service.uploadPdf(validInput(opposition.id));

    expect(material.opposition_id).toBe(opposition.id);
    expect(material.original_filename).toBe('tema-1.pdf');
    expect(material.mime_type).toBe('application/pdf');
    expect(material.size_bytes).toBeGreaterThan(0);
    expect(material.storage_path).toMatch(/^uploads\/materials\/.+\.pdf$/);
    expect(material.file_extension).toBe('pdf');
    expect(material.status).toBe('active');
  });

  it('guarda los bytes fuera del repo (FileStorage), no en el material', async () => {
    const { service, storage, opposition } = await makeServiceSetup();
    const material = await service.uploadPdf(validInput(opposition.id));
    expect(await storage.exists(material.storage_path as string)).toBe(true);
    expect(await storage.read(material.storage_path as string)).not.toBeNull();
  });

  it('extrae texto cuando el PDF tiene texto seleccionable', async () => {
    const { service, opposition } = await makeServiceSetup();
    const material = await service.uploadPdf(validInput(opposition.id));
    expect(material.extraction_status).toBe('completed');
    expect(material.content_text).toContain('Hola mundo de prueba');
    expect(material.page_count).toBe(1);
    expect(material.extraction_error).toBeNull();
  });

  it('marca not_supported cuando el PDF no tiene texto extraible', async () => {
    const { service, opposition } = await makeServiceSetup();
    const material = await service.uploadPdf({
      ...validInput(opposition.id),
      file: {
        original_filename: 'escaneado.pdf',
        mime_type: 'application/pdf',
        bytes: pdfWithoutText(),
      },
    });
    expect(material.extraction_status).toBe('not_supported');
    expect(material.content_text).toBeNull();
    expect(material.extraction_error).toBeTruthy();
  });

  it('vincula el PDF a temas de la misma oposicion', async () => {
    const { service, linkRepo, opposition, topic } = await makeServiceSetup();
    const material = await service.uploadPdf({
      ...validInput(opposition.id),
      topic_ids: [topic.id],
    });
    const links = await linkRepo.findAll({ material_id: material.id });
    expect(links).toHaveLength(1);
    expect(links[0]?.topic_id).toBe(topic.id);
  });

  it('rechaza vincular a temas de otra oposicion', async () => {
    const { service, opposition, foreignTopic } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          topic_ids: [foreignTopic.id],
        }),
      PdfErrorCode.TOPIC_OPPOSITION_MISMATCH,
    );
  });

  it('rechaza vincular a un tema inexistente', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          topic_ids: ['no-existe'],
        }),
      PdfErrorCode.TOPIC_NOT_FOUND,
    );
  });

  it('exige oposicion', async () => {
    const { service } = await makeServiceSetup();
    await expectPdfCodes(
      () => service.uploadPdf({ ...validInput('opp-1'), opposition_id: undefined }),
      PdfErrorCode.OPPOSITION_REQUIRED,
    );
  });

  it('rechaza oposicion inexistente', async () => {
    const { service } = await makeServiceSetup();
    await expectPdfCodes(
      () => service.uploadPdf(validInput('no-existe')),
      PdfErrorCode.OPPOSITION_NOT_FOUND,
    );
  });

  it('exige titulo', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () => service.uploadPdf({ ...validInput(opposition.id), title: '  ' }),
      PdfErrorCode.TITLE_REQUIRED,
    );
  });

  it('exige tipo', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          type: undefined,
        }),
      PdfErrorCode.TYPE_REQUIRED,
    );
  });

  it('rechaza tipo de material invalido', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          // @ts-expect-error tipo invalido a proposito
          type: 'inventado',
        }),
      PdfErrorCode.INVALID_MATERIAL_TYPE,
    );
  });

  it('exige archivo', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({ ...validInput(opposition.id), file: undefined }),
      PdfErrorCode.FILE_REQUIRED,
    );
  });

  it('rechaza archivo que no es .pdf', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          file: {
            original_filename: 'tema.docx',
            mime_type: 'application/pdf',
            bytes: pdfWithText(),
          },
        }),
      PdfErrorCode.INVALID_FILE_TYPE,
    );
  });

  it('rechaza MIME type que no es PDF', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          file: {
            original_filename: 'tema.pdf',
            mime_type: 'text/plain',
            bytes: pdfWithText(),
          },
        }),
      PdfErrorCode.INVALID_MIME_TYPE,
    );
  });

  it('rechaza archivo vacio', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          file: {
            original_filename: 'vacio.pdf',
            mime_type: 'application/pdf',
            bytes: new Uint8Array(0),
          },
        }),
      PdfErrorCode.FILE_EMPTY,
    );
  });

  it('rechaza archivo demasiado grande', async () => {
    const { service, opposition } = await makeServiceSetup();
    await expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          file: {
            original_filename: 'enorme.pdf',
            mime_type: 'application/pdf',
            bytes: new Uint8Array(MAX_PDF_SIZE_BYTES + 1),
          },
        }),
      PdfErrorCode.FILE_TOO_LARGE,
    );
  });
});

// --- Setup a nivel de facade (permisos y visibilidad) ----------------------
async function makePlatformSetup() {
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
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
  });
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

  const admin = await users.createUser({
    email: 'admin@test.com',
    password: 'x',
    role: 'admin',
  });
  const student = await users.createUser({
    email: 'student@test.com',
    password: 'y',
    role: 'student',
  });
  const outsider = await users.createUser({
    email: 'out@test.com',
    password: 'z',
    role: 'student',
  });
  const ws = await workspaces.createOrganizationWorkspace(admin, {
    name: 'Academia',
    slug: 'academia',
  });
  await workspaces.addMember(admin, {
    workspace_id: ws.id,
    user_id: student.id,
    role: 'student',
  });
  const opp = await oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Auxiliar',
    slug: 'auxiliar',
  });
  await oppositions.grantAccess(admin, {
    user_id: student.id,
    opposition_id: opp.id,
  });

  return { platform, admin, student, outsider, opp };
}

function uploadInput(oppositionId: string) {
  return {
    opposition_id: oppositionId,
    title: 'Temario PDF',
    type: 'syllabus' as const,
    file: {
      original_filename: 'temario.pdf',
      mime_type: 'application/pdf',
      bytes: pdfWithText(),
    },
  };
}

describe('PlatformService - PDF (permisos y visibilidad)', () => {
  it('un owner/admin puede subir PDF a una oposicion autorizada', async () => {
    const { platform, admin, opp } = await makePlatformSetup();
    const material = await platform.uploadPdf(admin, uploadInput(opp.id));
    expect(material.uploaded_by).toBe(admin.id);
    expect(material.opposition_id).toBe(opp.id);
  });

  it('un student no puede subir PDF', async () => {
    const { platform, student, opp } = await makePlatformSetup();
    await expect(platform.uploadPdf(student, uploadInput(opp.id))).rejects.toThrow(
      AccessError,
    );
  });

  it('lista PDFs de una oposicion (admin ve todos)', async () => {
    const { platform, admin, opp } = await makePlatformSetup();
    await platform.uploadPdf(admin, uploadInput(opp.id));
    const list = await platform.listMaterials(admin, opp.id);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('un estudiante autorizado ve material activo', async () => {
    const { platform, admin, student, opp } = await makePlatformSetup();
    const material = await platform.uploadPdf(admin, uploadInput(opp.id));
    const seen = await platform.getMaterial(student, material.id);
    expect(seen.id).toBe(material.id);
  });

  it('un estudiante no ve material no activo (obsoleto)', async () => {
    const { platform, admin, student, opp } = await makePlatformSetup();
    const material = await platform.uploadPdf(admin, uploadInput(opp.id));
    await platform.markMaterialObsolete(admin, material.id);
    await expect(platform.getMaterial(student, material.id)).rejects.toThrow(
      AccessError,
    );
    // y no aparece en su listado
    expect(await platform.listMaterials(student, opp.id)).toHaveLength(0);
  });

  it('un usuario sin acceso a la oposicion no ve el PDF', async () => {
    const { platform, admin, outsider, opp } = await makePlatformSetup();
    const material = await platform.uploadPdf(admin, uploadInput(opp.id));
    try {
      await platform.getMaterial(outsider, material.id);
      throw new Error('Expected AccessError');
    } catch (error) {
      expect(error).toBeInstanceOf(AccessError);
      expect((error as AccessError).codes).toContain(
        AccessErrorCode.WORKSPACE_ACCESS_DENIED,
      );
    }
  });

  it('se puede marcar el PDF como obsoleto', async () => {
    const { platform, admin, opp } = await makePlatformSetup();
    const material = await platform.uploadPdf(admin, uploadInput(opp.id));
    const obsolete = await platform.markMaterialObsolete(admin, material.id);
    expect(obsolete.status).toBe('obsolete');
  });

  it('un owner/admin puede reprocesar la extraccion de un PDF', async () => {
    const { platform, admin, opp } = await makePlatformSetup();
    const material = await platform.uploadPdf(admin, uploadInput(opp.id));
    const reprocessed = await platform.reextractMaterial(admin, material.id);
    expect(reprocessed.id).toBe(material.id);
    expect(reprocessed.extraction_status).toBe('completed');
  });

  it('un student no puede reprocesar la extraccion', async () => {
    const { platform, admin, student, opp } = await makePlatformSetup();
    const material = await platform.uploadPdf(admin, uploadInput(opp.id));
    await expect(
      platform.reextractMaterial(student, material.id),
    ).rejects.toThrow(AccessError);
  });
});
