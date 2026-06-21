// Tests del extractor de texto PDF real (PDF.js) y de la validacion de calidad.
//
// Cubre el blocker de "extraccion PDF corrupta": el extractor naive antiguo
// decodificaba Latin-1 y no resolvia streams comprimidos ni ToUnicode, asi que
// contaminaba el pipeline con simbolos ilegibles. `PdfJsTextExtractor` SI los
// resuelve, y cuando no hay texto legible (escaneado/corrupto) deja el material
// en `not_supported`/`failed` + `needs_review`, fuera del pipeline.
//
// Los PDFs ficticios se generan con `fixtures/generatePdfFixtures.mjs` (sin
// material real). Para regenerarlos: `node tests/fixtures/generatePdfFixtures.mjs`.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PdfJsTextExtractor,
  StubPdfTextExtractor,
  assessTextQuality,
  InMemoryMaterialRepository,
  InMemoryTopicRepository,
  InMemoryTopicMaterialLinkRepository,
  InMemoryOppositionRepository,
  InMemoryFileStorage,
  PdfMaterialService,
  type Opposition,
} from '../src/index.js';

// Texto que solo se recupera resolviendo /ToUnicode (debe coincidir con el
// `TOUNICODE_TEXT` del generador de fixtures).
const TOUNICODE_TEXT = 'Tema 7. ToUnicode OK 1978';

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
}

describe('PdfJsTextExtractor', () => {
  it('extrae texto de un PDF con stream comprimido (FlateDecode)', async () => {
    const result = await new PdfJsTextExtractor().extract(fixture('compressed-text.pdf'));
    expect(result.status).toBe('completed');
    expect(result.page_count).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(result.text).toContain('Constitucion espanola');
    expect(result.text).toContain('Articulo 14');
    expect(result.message).toBeNull();
  });

  it('recupera texto que exige resolver /ToUnicode', async () => {
    const result = await new PdfJsTextExtractor().extract(fixture('tounicode.pdf'));
    expect(result.status).toBe('completed');
    expect(result.text).toContain(TOUNICODE_TEXT);
  });

  it('marca not_supported un PDF escaneado (sin capa de texto)', async () => {
    const result = await new PdfJsTextExtractor().extract(fixture('scanned-image.pdf'));
    expect(result.status).toBe('not_supported');
    expect(result.text).toBe('');
    expect(result.message).toMatch(/escaneado|OCR/i);
  });

  it('marca failed un archivo que no es un PDF valido', async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const result = await new PdfJsTextExtractor().extract(garbage);
    expect(result.status).toBe('failed');
    expect(result.text).toBe('');
  });

  it('el extractor stub antiguo NO sabe leer el stream comprimido (motivo del cambio)', async () => {
    // El naive/stub decodifica Latin-1 y busca literales BT...ET, que en un
    // stream comprimido no aparecen: por eso daba texto vacio/corrupto.
    const result = await new StubPdfTextExtractor().extract(fixture('compressed-text.pdf'));
    expect(result.status).not.toBe('completed');
    expect(result.text).not.toContain('Constitucion');
  });
});

describe('assessTextQuality', () => {
  it('acepta texto legible', () => {
    const v = assessTextQuality(
      'Tema 1. La Constitucion espanola reconoce derechos fundamentales a los ciudadanos.',
    );
    expect(v.ok).toBe(true);
    expect(v.reason).toBeNull();
  });

  it('rechaza texto con demasiados caracteres de reemplazo', () => {
    const v = assessTextQuality('����������');
    expect(v.ok).toBe(false);
  });

  it('rechaza texto demasiado corto para ser util', () => {
    const v = assessTextQuality('hola');
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/legible/i);
  });

  it('rechaza una mayoria de simbolos ilegibles', () => {
    const v = assessTextQuality('@@@@##### ~~~~~ ^^^^^ |||||  ');
    expect(v.ok).toBe(false);
  });
});

function makeOpposition(): Opposition {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'opp-1',
    workspace_id: 'ws-1',
    title: 'Oposicion de prueba',
    description: null,
    slug: 'opp-1',
    status: 'active',
    created_by: 'system',
    created_at: now,
    updated_at: now,
  };
}

async function makeUploadSetup() {
  const materials = new InMemoryMaterialRepository();
  const oppositions = new InMemoryOppositionRepository();
  const storage = new InMemoryFileStorage();
  await oppositions.create(makeOpposition());
  let counter = 0;
  const service = new PdfMaterialService({
    materials,
    topics: new InMemoryTopicRepository(),
    topicMaterialLinks: new InMemoryTopicMaterialLinkRepository(),
    oppositions,
    storage,
    extractor: new PdfJsTextExtractor(),
    generateId: () => `id-${++counter}`,
    now: () => new Date('2026-01-02T00:00:00Z'),
  });
  return { service, materials };
}

describe('PdfMaterialService con PdfJsTextExtractor', () => {
  it('guarda content_text y deja el material active cuando la extraccion es legible', async () => {
    const { service } = await makeUploadSetup();
    const material = await service.uploadPdf({
      opposition_id: 'opp-1',
      title: 'Constitucion',
      type: 'syllabus',
      file: {
        original_filename: 'tema.pdf',
        mime_type: 'application/pdf',
        bytes: fixture('compressed-text.pdf'),
      },
    });
    expect(material.extraction_status).toBe('completed');
    expect(material.status).toBe('active');
    expect(material.content_text).toContain('Articulo 14');
  });

  it('deja el material needs_review (sin content_text) cuando el PDF esta escaneado', async () => {
    const { service } = await makeUploadSetup();
    const material = await service.uploadPdf({
      opposition_id: 'opp-1',
      title: 'Escaneado',
      type: 'syllabus',
      file: {
        original_filename: 'escaneado.pdf',
        mime_type: 'application/pdf',
        bytes: fixture('scanned-image.pdf'),
      },
    });
    expect(material.extraction_status).toBe('not_supported');
    expect(material.status).toBe('needs_review');
    expect(material.content_text).toBeNull();
    expect(material.extraction_error).toMatch(/escaneado|OCR/i);
  });

  it('reextractMaterial reprocesa los bytes guardados y reescribe la extraccion', async () => {
    const { service, materials } = await makeUploadSetup();
    const uploaded = await service.uploadPdf({
      opposition_id: 'opp-1',
      title: 'Constitucion',
      type: 'syllabus',
      file: {
        original_filename: 'tema.pdf',
        mime_type: 'application/pdf',
        bytes: fixture('compressed-text.pdf'),
      },
    });
    // Simula un material que quedo sin texto y se reprocesa.
    await materials.save({
      ...uploaded,
      content_text: null,
      extraction_status: 'failed',
      status: 'needs_review',
    });
    const reprocessed = await service.reextractMaterial(uploaded.id);
    expect(reprocessed.extraction_status).toBe('completed');
    expect(reprocessed.status).toBe('active');
    expect(reprocessed.content_text).toContain('Constitucion espanola');
  });
});
