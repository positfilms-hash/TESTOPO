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
  NaivePdfTextExtractor,
  PdfMaterialService,
  PdfUploadError,
  PdfErrorCode,
  MAX_PDF_SIZE_BYTES,
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
function makeServiceSetup() {
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const linkRepo = new InMemoryTopicMaterialLinkRepository();
  const oppositionRepo = new InMemoryOppositionRepository();
  const storage = new InMemoryFileStorage();

  const opposition = oppositionRepo.create(makeOpposition('opp-1', 'ws-1'));
  const otherOpposition = oppositionRepo.create(makeOpposition('opp-2', 'ws-1'));
  const topic = topicRepo.create(makeTopic('topic-1', opposition.id));
  const foreignTopic = topicRepo.create(makeTopic('topic-x', otherOpposition.id));

  let counter = 0;
  const service = new PdfMaterialService({
    materials: materialRepo,
    topics: topicRepo,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage,
    extractor: new NaivePdfTextExtractor(),
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

function expectPdfCodes(fn: () => unknown, code: PdfErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PdfUploadError);
    expect((error as PdfUploadError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected PdfUploadError (${code})`);
}

describe('PdfMaterialService - subida y validaciones', () => {
  it('registra el PDF como Material con metadata y oposicion correcta', () => {
    const { service, opposition } = makeServiceSetup();
    const material = service.uploadPdf(validInput(opposition.id));

    expect(material.opposition_id).toBe(opposition.id);
    expect(material.original_filename).toBe('tema-1.pdf');
    expect(material.mime_type).toBe('application/pdf');
    expect(material.size_bytes).toBeGreaterThan(0);
    expect(material.storage_path).toMatch(/^uploads\/materials\/.+\.pdf$/);
    expect(material.file_extension).toBe('pdf');
    expect(material.status).toBe('active');
  });

  it('guarda los bytes fuera del repo (FileStorage), no en el material', () => {
    const { service, storage, opposition } = makeServiceSetup();
    const material = service.uploadPdf(validInput(opposition.id));
    expect(storage.exists(material.storage_path as string)).toBe(true);
    expect(storage.read(material.storage_path as string)).not.toBeNull();
  });

  it('extrae texto cuando el PDF tiene texto seleccionable', () => {
    const { service, opposition } = makeServiceSetup();
    const material = service.uploadPdf(validInput(opposition.id));
    expect(material.extraction_status).toBe('completed');
    expect(material.content_text).toContain('Hola mundo de prueba');
    expect(material.page_count).toBe(1);
    expect(material.extraction_error).toBeNull();
  });

  it('marca not_supported cuando el PDF no tiene texto extraible', () => {
    const { service, opposition } = makeServiceSetup();
    const material = service.uploadPdf({
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

  it('vincula el PDF a temas de la misma oposicion', () => {
    const { service, linkRepo, opposition, topic } = makeServiceSetup();
    const material = service.uploadPdf({
      ...validInput(opposition.id),
      topic_ids: [topic.id],
    });
    const links = linkRepo.findAll({ material_id: material.id });
    expect(links).toHaveLength(1);
    expect(links[0]?.topic_id).toBe(topic.id);
  });

  it('rechaza vincular a temas de otra oposicion', () => {
    const { service, opposition, foreignTopic } = makeServiceSetup();
    expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          topic_ids: [foreignTopic.id],
        }),
      PdfErrorCode.TOPIC_OPPOSITION_MISMATCH,
    );
  });

  it('rechaza vincular a un tema inexistente', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          topic_ids: ['no-existe'],
        }),
      PdfErrorCode.TOPIC_NOT_FOUND,
    );
  });

  it('exige oposicion', () => {
    const { service } = makeServiceSetup();
    expectPdfCodes(
      () => service.uploadPdf({ ...validInput('opp-1'), opposition_id: undefined }),
      PdfErrorCode.OPPOSITION_REQUIRED,
    );
  });

  it('rechaza oposicion inexistente', () => {
    const { service } = makeServiceSetup();
    expectPdfCodes(
      () => service.uploadPdf(validInput('no-existe')),
      PdfErrorCode.OPPOSITION_NOT_FOUND,
    );
  });

  it('exige titulo', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
      () => service.uploadPdf({ ...validInput(opposition.id), title: '  ' }),
      PdfErrorCode.TITLE_REQUIRED,
    );
  });

  it('exige tipo', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          type: undefined,
        }),
      PdfErrorCode.TYPE_REQUIRED,
    );
  });

  it('rechaza tipo de material invalido', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
      () =>
        service.uploadPdf({
          ...validInput(opposition.id),
          // @ts-expect-error tipo invalido a proposito
          type: 'inventado',
        }),
      PdfErrorCode.INVALID_MATERIAL_TYPE,
    );
  });

  it('exige archivo', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
      () =>
        service.uploadPdf({ ...validInput(opposition.id), file: undefined }),
      PdfErrorCode.FILE_REQUIRED,
    );
  });

  it('rechaza archivo que no es .pdf', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
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

  it('rechaza MIME type que no es PDF', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
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

  it('rechaza archivo vacio', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
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

  it('rechaza archivo demasiado grande', () => {
    const { service, opposition } = makeServiceSetup();
    expectPdfCodes(
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
function makePlatformSetup() {
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
  const outsider = users.createUser({
    email: 'out@test.com',
    password: 'z',
    role: 'student',
  });
  const ws = workspaces.createOrganizationWorkspace(admin, {
    name: 'Academia',
    slug: 'academia',
  });
  workspaces.addMember(admin, {
    workspace_id: ws.id,
    user_id: student.id,
    role: 'student',
  });
  const opp = oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Auxiliar',
    slug: 'auxiliar',
  });
  oppositions.grantAccess(admin, {
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
  it('un owner/admin puede subir PDF a una oposicion autorizada', () => {
    const { platform, admin, opp } = makePlatformSetup();
    const material = platform.uploadPdf(admin, uploadInput(opp.id));
    expect(material.uploaded_by).toBe(admin.id);
    expect(material.opposition_id).toBe(opp.id);
  });

  it('un student no puede subir PDF', () => {
    const { platform, student, opp } = makePlatformSetup();
    expect(() => platform.uploadPdf(student, uploadInput(opp.id))).toThrow(
      AccessError,
    );
  });

  it('lista PDFs de una oposicion (admin ve todos)', () => {
    const { platform, admin, opp } = makePlatformSetup();
    platform.uploadPdf(admin, uploadInput(opp.id));
    const list = platform.listMaterials(admin, opp.id);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('un estudiante autorizado ve material activo', () => {
    const { platform, admin, student, opp } = makePlatformSetup();
    const material = platform.uploadPdf(admin, uploadInput(opp.id));
    const seen = platform.getMaterial(student, material.id);
    expect(seen.id).toBe(material.id);
  });

  it('un estudiante no ve material no activo (obsoleto)', () => {
    const { platform, admin, student, opp } = makePlatformSetup();
    const material = platform.uploadPdf(admin, uploadInput(opp.id));
    platform.markMaterialObsolete(admin, material.id);
    expect(() => platform.getMaterial(student, material.id)).toThrow(
      AccessError,
    );
    // y no aparece en su listado
    expect(platform.listMaterials(student, opp.id)).toHaveLength(0);
  });

  it('un usuario sin acceso a la oposicion no ve el PDF', () => {
    const { platform, admin, outsider, opp } = makePlatformSetup();
    const material = platform.uploadPdf(admin, uploadInput(opp.id));
    try {
      platform.getMaterial(outsider, material.id);
      throw new Error('Expected AccessError');
    } catch (error) {
      expect(error).toBeInstanceOf(AccessError);
      expect((error as AccessError).codes).toContain(
        AccessErrorCode.WORKSPACE_ACCESS_DENIED,
      );
    }
  });

  it('se puede marcar el PDF como obsoleto', () => {
    const { platform, admin, opp } = makePlatformSetup();
    const material = platform.uploadPdf(admin, uploadInput(opp.id));
    const obsolete = platform.markMaterialObsolete(admin, material.id);
    expect(obsolete.status).toBe('obsolete');
  });
});
