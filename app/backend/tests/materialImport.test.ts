// Tests de SPEC 017 - Unified Syllabus & Bulk Material Import.
//
// Cubre subida multiple a un tema e importacion de ZIP (desglose por carpetas,
// creacion/reutilizacion de temas, materiales, seguridad anti Zip-Slip, limites,
// extensiones, duplicados y resumen). Los ZIP de prueba se construyen con
// `zipSync` de fflate (mismo motor que el lector por defecto).

import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  InMemoryMaterialRepository,
  InMemoryTopicRepository,
  InMemoryTopicMaterialLinkRepository,
  InMemoryOppositionRepository,
  InMemoryFileStorage,
  StubPdfTextExtractor,
  FflateZipReader,
  InMemoryMaterialImportBatchRepository,
  InMemoryMaterialImportItemRepository,
  TopicService,
  MaterialImportService,
  ImportError,
  ImportErrorCode,
  MAX_ZIP_FILES,
  type Opposition,
} from '../src/index.js';

const enc = new TextEncoder();

function pdfWithText(text = 'Hola mundo'): Uint8Array {
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

async function makeSetup() {
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const linkRepo = new InMemoryTopicMaterialLinkRepository();
  const oppositionRepo = new InMemoryOppositionRepository();
  const storage = new InMemoryFileStorage();
  const opposition = await oppositionRepo.create(makeOpposition('opp-1', 'ws-1'));
  const otherOpp = await oppositionRepo.create(makeOpposition('opp-2', 'ws-1'));

  let counter = 0;
  const topics = new TopicService(topicRepo, {
    linkRepository: linkRepo,
    materialRepository: materialRepo,
    generateId: () => `t-${++counter}`,
    now: () => new Date('2026-01-02T00:00:00Z'),
  });
  let icounter = 0;
  const service = new MaterialImportService({
    materials: materialRepo,
    topics,
    topicMaterialLinks: linkRepo,
    oppositions: oppositionRepo,
    storage,
    extractor: new StubPdfTextExtractor(),
    zipReader: new FflateZipReader(),
    batches: new InMemoryMaterialImportBatchRepository(),
    items: new InMemoryMaterialImportItemRepository(),
    generateId: () => `g-${++icounter}`,
    now: () => new Date('2026-01-02T00:00:00Z'),
  });

  return { service, materialRepo, topicRepo, linkRepo, topics, storage, opposition, otherOpp };
}

async function rootTopic(setup: Awaited<ReturnType<typeof makeSetup>>) {
  return await setup.topics.createTopic({
    opposition_id: setup.opposition.id,
    title: 'Tema 1',
  });
}

describe('SPEC 017 - subida multiple a un tema', () => {
  it('crea un material por archivo asociado al tema', async () => {
    const setup = await makeSetup();
    const topic = await rootTopic(setup);
    const { batch, items } = await setup.service.importFiles({
      opposition_id: setup.opposition.id,
      topic_id: topic.id,
      files: [
        { original_filename: 'intro.pdf', bytes: pdfWithText() },
        { original_filename: 'apuntes.txt', bytes: enc.encode('Texto de apuntes') },
      ],
    });
    expect(batch.imported_files).toBe(2);
    expect(items.every((i) => i.status === 'imported')).toBe(true);
    // Ambos materiales quedan vinculados al tema.
    const links = await setup.linkRepo.findAll({ topic_id: topic.id });
    expect(links).toHaveLength(2);
    // TXT guarda content_text directamente.
    const txt = (await setup.materialRepo.findAll()).find(
      (m) => m.original_filename === 'apuntes.txt',
    );
    expect(txt?.content_text).toBe('Texto de apuntes');
  });

  it('exige tema existente de la misma oposicion', async () => {
    const setup = await makeSetup();
    await expect(setup.service.importFiles({
        opposition_id: setup.opposition.id,
        topic_id: 'no-existe',
        files: [{ original_filename: 'a.pdf', bytes: pdfWithText() }],
      }),
    ).rejects.toThrow(ImportError);
  });

  it('omite archivos con extension no permitida', async () => {
    const setup = await makeSetup();
    const topic = await rootTopic(setup);
    const { batch, items } = await setup.service.importFiles({
      opposition_id: setup.opposition.id,
      topic_id: topic.id,
      files: [{ original_filename: 'malware.exe', bytes: enc.encode('x') }],
    });
    expect(batch.imported_files).toBe(0);
    expect(items[0]?.status).toBe('skipped');
    expect(items[0]?.error).toBe(ImportErrorCode.FILE_EXTENSION_NOT_ALLOWED);
  });

  it('omite duplicados por nombre dentro del mismo tema', async () => {
    const setup = await makeSetup();
    const topic = await rootTopic(setup);
    await setup.service.importFiles({
      opposition_id: setup.opposition.id,
      topic_id: topic.id,
      files: [{ original_filename: 'intro.pdf', bytes: pdfWithText() }],
    });
    const { items } = await setup.service.importFiles({
      opposition_id: setup.opposition.id,
      topic_id: topic.id,
      files: [{ original_filename: 'intro.pdf', bytes: pdfWithText() }],
    });
    expect(items[0]?.status).toBe('skipped');
    expect(items[0]?.error).toBe(ImportErrorCode.DUPLICATE_SKIPPED);
    expect(await setup.linkRepo.findAll({ topic_id: topic.id })).toHaveLength(1);
  });
});

describe('SPEC 017 - importacion de ZIP', () => {
  function zipOf(files: Record<string, Uint8Array>): Uint8Array {
    return zipSync(files);
  }

  it('crea temas desde carpetas, subtemas desde subcarpetas y materiales', async () => {
    const setup = await makeSetup();
    const zip = zipOf({
      'Tema 1 - Constitucion/01 Introduccion.pdf': pdfWithText('Intro'),
      'Tema 1 - Constitucion/Apartado 1.1/derechos.pdf': pdfWithText('Derechos'),
      'Tema 2 - Procedimiento/01 Plazos.txt': strToU8('Plazos ficticios'),
    });
    const { batch } = await setup.service.importZip({
      opposition_id: setup.opposition.id,
      zip: { original_filename: 'temario.zip', bytes: zip },
    });

    expect(batch.imported_files).toBe(3);
    expect(batch.status).toBe('completed');

    const topics = await setup.topics.listTopics();
    const t1 = topics.find((t) => t.title === 'Tema 1 - Constitucion');
    const t2 = topics.find((t) => t.title === 'Tema 2 - Procedimiento');
    const sub = topics.find((t) => t.title === 'Apartado 1.1');
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();
    expect(sub?.parent_id).toBe(t1?.id);
  });

  it('no crea temas duplicados bajo el mismo padre', async () => {
    const setup = await makeSetup();
    const zip = zipOf({
      'Tema 1/a.pdf': pdfWithText('a'),
      'Tema 1/b.pdf': pdfWithText('b'),
    });
    await setup.service.importZip({
      opposition_id: setup.opposition.id,
      zip: { original_filename: 'z.zip', bytes: zip },
    });
    const tema1 = (await setup.topics.listTopics()).filter((t) => t.title === 'Tema 1');
    expect(tema1).toHaveLength(1);
  });

  it('archivos en raiz sin tema van a "sin clasificar"', async () => {
    const setup = await makeSetup();
    const zip = zipOf({ 'suelto.pdf': pdfWithText('suelto') });
    await setup.service.importZip({
      opposition_id: setup.opposition.id,
      zip: { original_filename: 'z.zip', bytes: zip },
    });
    const unclassified = (await setup.topics.listTopics()).find(
      (t) => t.title === 'Material importado sin clasificar',
    );
    expect(unclassified).toBeTruthy();
  });

  it('archivos en raiz se asocian al tema seleccionado si se indica', async () => {
    const setup = await makeSetup();
    const topic = await rootTopic(setup);
    const zip = zipOf({ 'suelto.pdf': pdfWithText('suelto') });
    await setup.service.importZip({
      opposition_id: setup.opposition.id,
      parent_topic_id: topic.id,
      zip: { original_filename: 'z.zip', bytes: zip },
    });
    expect(await setup.linkRepo.findAll({ topic_id: topic.id })).toHaveLength(1);
  });

  it('omite archivos con extension no permitida pero importa el resto', async () => {
    const setup = await makeSetup();
    const zip = zipOf({
      'Tema 1/ok.pdf': pdfWithText('ok'),
      'Tema 1/script.js': strToU8('alert(1)'),
    });
    const { batch } = await setup.service.importZip({
      opposition_id: setup.opposition.id,
      zip: { original_filename: 'z.zip', bytes: zip },
    });
    expect(batch.imported_files).toBe(1);
    expect(batch.skipped_files).toBe(1);
    expect(batch.status).toBe('completed_with_errors');
  });

  it('rechaza ZIP con rutas inseguras (../)', async () => {
    const setup = await makeSetup();
    const zip = zipOf({ '../escape.pdf': pdfWithText('x') });
    await expect(setup.service.importZip({
        opposition_id: setup.opposition.id,
        zip: { original_filename: 'z.zip', bytes: zip },
      }),
    ).rejects.toThrowError(/IMPORT_ZIP_UNSAFE_PATH/);
  });

  it('rechaza ZIP anidado (.zip dentro del ZIP)', async () => {
    const setup = await makeSetup();
    const zip = zipOf({ 'Tema 1/otro.zip': new Uint8Array([1, 2, 3]) });
    await expect(setup.service.importZip({
        opposition_id: setup.opposition.id,
        zip: { original_filename: 'z.zip', bytes: zip },
      }),
    ).rejects.toThrowError(/IMPORT_ZIP_NESTED_NOT_ALLOWED/);
  });

  it('rechaza ZIP con demasiados archivos', async () => {
    const setup = await makeSetup();
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < MAX_ZIP_FILES + 1; i++) {
      files[`Tema 1/f${i}.txt`] = strToU8(`x${i}`);
    }
    await expect(setup.service.importZip({
        opposition_id: setup.opposition.id,
        zip: { original_filename: 'z.zip', bytes: zipOf(files) },
      }),
    ).rejects.toThrowError(/IMPORT_ZIP_TOO_MANY_FILES/);
  });

  it('rechaza ZIP vacio', async () => {
    const setup = await makeSetup();
    await expect(setup.service.importZip({
        opposition_id: setup.opposition.id,
        zip: { original_filename: 'z.zip', bytes: new Uint8Array(0) },
      }),
    ).rejects.toThrowError(/IMPORT_ZIP_EMPTY/);
  });

  it('genera resumen consultable con items', async () => {
    const setup = await makeSetup();
    const zip = zipOf({ 'Tema 1/a.pdf': pdfWithText('a') });
    const { batch } = await setup.service.importZip({
      opposition_id: setup.opposition.id,
      zip: { original_filename: 'temario.zip', bytes: zip },
    });
    const fetched = await setup.service.getBatch(batch.id);
    expect(fetched?.batch.original_filename).toBe('temario.zip');
    expect(fetched?.items).toHaveLength(1);
    expect(fetched?.items[0]?.original_path).toBe('Tema 1/a.pdf');
  });

  it('los PDF usan extraccion basica y TXT/MD guardan content_text', async () => {
    const setup = await makeSetup();
    const zip = zipOf({
      'Tema 1/doc.pdf': pdfWithText('Texto del PDF'),
      'Tema 1/nota.md': strToU8('# Titulo\nContenido'),
    });
    await setup.service.importZip({
      opposition_id: setup.opposition.id,
      zip: { original_filename: 'z.zip', bytes: zip },
    });
    const materials = await setup.materialRepo.findAll();
    const pdf = materials.find((m) => m.original_filename === 'doc.pdf');
    const md = materials.find((m) => m.original_filename === 'nota.md');
    expect(pdf?.extraction_status).toBe('completed');
    expect(pdf?.content_text).toContain('Texto del PDF');
    expect(md?.content_text).toContain('# Titulo');
  });
});
