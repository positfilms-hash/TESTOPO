// OCR & Vision para PDFs escaneados (SPEC 030), Fase 1. Sin red: proveedor mock
// deterministico + render placeholder + repos InMemory. Cubre:
// - deteccion escaneo vs texto nativo (PdfScanDetectionService).
// - orden de paginas en el texto agregado.
// - bandas de confianza (completed/warning/failed).
// - fallo parcial (completed_ocr_with_warnings) y total (ocr_failed) que NO
//   sobreescribe buen texto nativo.
// - reintento (limpia run previo) y camino sin-OCR (texto nativo suficiente).
// - persistencia via repos (InMemory + round-trip Supabase) y factory.

import { describe, expect, it } from 'vitest';
import {
  PdfScanDetectionService,
  MaterialOcrService,
  MockOcrProvider,
  PlaceholderPdfPageRenderService,
  InMemoryMaterialOcrRepository,
  SupabaseMaterialOcrRepository,
  InMemoryMaterialRepository,
  InMemoryFileStorage,
  InMemorySupabasePort,
  createCoreRepositories,
  OcrError,
  OcrErrorCode,
  type Material,
  type MaterialOcrRun,
  type MaterialOcrPage,
  type PdfExtractionResult,
} from '../src/index.js';

const now = new Date('2026-01-02T00:00:00.000Z');
const bytes = new Uint8Array([1, 2, 3, 4]);
const STORAGE_PATH = 'uploads/materials/mat-1.pdf';

function makeMaterial(over: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    opposition_id: 'opp-1',
    title: 'Escaneo Tema 1',
    description: null,
    type: 'syllabus',
    status: 'needs_review',
    original_filename: 'tema1.pdf',
    mime_type: 'application/pdf',
    size_bytes: 4,
    storage_path: STORAGE_PATH,
    content_text: null,
    reference: null,
    file_extension: 'pdf',
    extraction_status: 'scanned_detected',
    extraction_error: null,
    page_count: 3,
    extraction_method: null,
    uploaded_by: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

// Construye el servicio con repos InMemory y un proveedor mock configurable.
async function setup(
  over: Partial<Material> = {},
  providerOptions?: ConstructorParameters<typeof MockOcrProvider>[0],
) {
  const materials = new InMemoryMaterialRepository();
  const ocrRepository = new InMemoryMaterialOcrRepository();
  const storage = new InMemoryFileStorage();
  const material = makeMaterial(over);
  await materials.create(material);
  if (material.storage_path) {
    await storage.save(material.storage_path, bytes);
  }
  const service = new MaterialOcrService({
    materials,
    storage,
    ocrRepository,
    renderService: new PlaceholderPdfPageRenderService(),
    provider: new MockOcrProvider(providerOptions),
  });
  return { materials, ocrRepository, storage, service };
}

describe('PdfScanDetectionService', () => {
  const detector = new PdfScanDetectionService();

  function result(over: Partial<PdfExtractionResult>): PdfExtractionResult {
    return { text: '', pages: [], page_count: 3, status: 'completed', message: null, ...over };
  }

  it('texto nativo suficiente NO es escaneo (camino sin-OCR)', () => {
    const text = 'Articulo 1. El presente texto es legible y suficiente '.repeat(3);
    const verdict = detector.evaluate(result({ status: 'completed', text }));
    expect(verdict.likely_scan).toBe(false);
  });

  it('PDF sin capa de texto con paginas es probable escaneo', () => {
    const verdict = detector.evaluate(
      result({ status: 'not_supported', text: '', page_count: 5 }),
    );
    expect(verdict.likely_scan).toBe(true);
  });

  it('texto nativo pobre (completed pero ilegible) se trata como escaneo', () => {
    const verdict = detector.evaluate(
      result({ status: 'completed', text: '���', page_count: 2 }),
    );
    expect(verdict.likely_scan).toBe(true);
  });

  it('PDF dañado (failed) o sin paginas no es candidato a OCR', () => {
    expect(detector.evaluate(result({ status: 'failed', page_count: null })).likely_scan).toBe(false);
    expect(detector.evaluate(result({ status: 'not_supported', page_count: 0 })).likely_scan).toBe(false);
  });
});

describe('MaterialOcrService.startOcr', () => {
  it('lee el escaneo y agrega el texto en orden de pagina', async () => {
    const { service, materials } = await setup(
      {},
      { textFor: (p) => `PAGINA ${p}`, confidenceFor: () => 0.95 },
    );
    const status = await service.startOcr({ material_id: 'mat-1', created_by: 'admin' });

    expect(status.extraction_status).toBe('completed_ocr');
    expect(status.run?.status).toBe('completed');
    expect(status.pages.map((p) => p.page_number)).toEqual([1, 2, 3]);

    const material = await materials.findById('mat-1');
    // El texto agregado respeta el orden de pagina.
    expect(material?.content_text).toBe('PAGINA 1\n\nPAGINA 2\n\nPAGINA 3');
    expect(material?.extraction_method).toBe('ocr');
    expect(material?.extraction_status).toBe('completed_ocr');
    expect(material?.status).toBe('active');
    expect(material?.ocr_page_count).toBe(3);
    expect(material?.ocr_processed_pages).toBe(3);
    expect(material?.ocr_failed_pages).toBe(0);
  });

  it('clasifica cada pagina por banda de confianza', async () => {
    // p1 alta (>=0.70), p2 media (0.40-0.69), p3 baja (<0.40).
    const conf: Record<number, number> = { 1: 0.9, 2: 0.5, 3: 0.2 };
    const { service } = await setup({}, { confidenceFor: (p) => conf[p] });
    const status = await service.startOcr({ material_id: 'mat-1' });

    const byPage = Object.fromEntries(status.pages.map((p) => [p.page_number, p.status]));
    expect(byPage[1]).toBe('completed');
    expect(byPage[2]).toBe('warning');
    expect(byPage[3]).toBe('failed');
    // Hay texto utilizable (p1/p2) pero tambien fallo/advertencias.
    expect(status.extraction_status).toBe('completed_ocr_with_warnings');
    expect(status.run?.failed_pages).toBe(1);
  });

  it('fallo parcial: conserva texto utilizable y marca advertencias', async () => {
    const conf: Record<number, number> = { 1: 0.95, 2: 0.95, 3: 0.1 };
    const { service, materials } = await setup(
      {},
      { textFor: (p) => `P${p}`, confidenceFor: (p) => conf[p] },
    );
    const status = await service.startOcr({ material_id: 'mat-1' });

    expect(status.extraction_status).toBe('completed_ocr_with_warnings');
    const material = await materials.findById('mat-1');
    // Solo el texto de las paginas usables, en orden.
    expect(material?.content_text).toBe('P1\n\nP2');
    expect(material?.extraction_method).toBe('ocr');
    expect(material?.status).toBe('needs_review');
    expect(material?.ocr_failed_pages).toBe(1);
  });

  it('fallo TOTAL no sobreescribe el buen texto nativo', async () => {
    const nativeText = 'TEXTO NATIVO BUENO Y LEGIBLE DEL MATERIAL.';
    const { service, materials } = await setup(
      { content_text: nativeText, extraction_method: 'text' },
      { confidenceFor: () => 0.1 }, // todas las paginas ilegibles
    );
    const status = await service.startOcr({ material_id: 'mat-1' });

    expect(status.extraction_status).toBe('ocr_failed');
    expect(status.run?.status).toBe('failed');
    const material = await materials.findById('mat-1');
    // El texto nativo y su metodo se conservan intactos.
    expect(material?.content_text).toBe(nativeText);
    expect(material?.extraction_method).toBe('text');
    expect(material?.status).toBe('needs_review');
    expect(material?.extraction_error).toBeTruthy();
  });

  it('un error del proveedor en una pagina no rompe el run', async () => {
    const { service } = await setup();
    const materials = (service as unknown as { deps: { provider: MockOcrProvider } });
    // Forzamos que la pagina 2 lance.
    const provider = materials.deps.provider;
    const original = provider.recognizePage.bind(provider);
    provider.recognizePage = async (page) => {
      if (page.page_number === 2) throw new Error('proveedor caido');
      return original(page);
    };
    const status = await service.startOcr({ material_id: 'mat-1' });
    expect(status.pages).toHaveLength(3);
    const p2 = status.pages.find((p) => p.page_number === 2);
    expect(p2?.status).toBe('failed');
  });
});

describe('MaterialOcrService - elegibilidad', () => {
  it('rechaza un material con texto nativo (no es escaneo)', async () => {
    const { service } = await setup({ extraction_status: 'completed', content_text: 'texto' });
    await expect(service.startOcr({ material_id: 'mat-1' })).rejects.toMatchObject({
      code: OcrErrorCode.SCAN_NOT_DETECTED,
    });
  });

  it('rechaza un material que no es PDF', async () => {
    const { service } = await setup({ file_extension: 'txt' });
    await expect(service.startOcr({ material_id: 'mat-1' })).rejects.toBeInstanceOf(OcrError);
  });

  it('rechaza si se supera el limite de paginas', async () => {
    const { service } = await setup({ page_count: 5000 });
    await expect(service.startOcr({ material_id: 'mat-1' })).rejects.toMatchObject({
      code: OcrErrorCode.PAGE_LIMIT_EXCEEDED,
    });
  });

  it('material inexistente lanza MATERIAL_NOT_FOUND', async () => {
    const { service } = await setup();
    await expect(service.startOcr({ material_id: 'nope' })).rejects.toMatchObject({
      code: OcrErrorCode.MATERIAL_NOT_FOUND,
    });
  });
});

describe('MaterialOcrService.retryOcr', () => {
  it('reintenta desde ocr_failed y limpia el run anterior', async () => {
    // Primer intento: fallo total.
    const { service, ocrRepository, materials } = await setup(
      {},
      { confidenceFor: () => 0.1 },
    );
    await service.startOcr({ material_id: 'mat-1' });
    expect((await materials.findById('mat-1'))?.extraction_status).toBe('ocr_failed');
    const firstRun = await ocrRepository.getLatestRunByMaterial('mat-1');

    // Cambiamos el proveedor para que ahora lea bien y reintentamos.
    (service as unknown as { deps: { provider: MockOcrProvider } }).deps.provider =
      new MockOcrProvider({ confidenceFor: () => 0.95 });
    const status = await service.retryOcr({ material_id: 'mat-1' });

    expect(status.extraction_status).toBe('completed_ocr');
    expect(status.run?.id).not.toBe(firstRun?.id);
    // No se acumulan paginas de runs previos: solo las del run vigente.
    const pages = await ocrRepository.listPagesByRun(status.run!.id);
    expect(pages).toHaveLength(3);
  });

  it('permite reintentar desde completed_ocr_with_warnings', async () => {
    const { service } = await setup({ extraction_status: 'completed_ocr_with_warnings' });
    const status = await service.retryOcr({ material_id: 'mat-1' });
    expect(status.run).not.toBeNull();
  });
});

describe('MaterialOcrService.getStatus', () => {
  it('devuelve el run vigente y sus paginas', async () => {
    const { service } = await setup();
    await service.startOcr({ material_id: 'mat-1' });
    const status = await service.getStatus('mat-1');
    expect(status.run).not.toBeNull();
    expect(status.pages).toHaveLength(3);
  });

  it('sin run previo devuelve run null y sin paginas', async () => {
    const { service } = await setup();
    const status = await service.getStatus('mat-1');
    expect(status.run).toBeNull();
    expect(status.pages).toEqual([]);
  });
});

describe('SupabaseMaterialOcrRepository (round-trip InMemorySupabasePort)', () => {
  function makeRun(over: Partial<MaterialOcrRun> = {}): MaterialOcrRun {
    return {
      id: 'run-1',
      workspace_id: null,
      opposition_id: 'opp-1',
      material_id: 'mat-1',
      created_by: 'admin',
      provider: 'mock-ocr',
      model: null,
      status: 'processing',
      page_count: 2,
      processed_pages: 0,
      failed_pages: 0,
      average_confidence: null,
      warnings: [],
      errors: [],
      created_at: now,
      updated_at: now,
      ...over,
    };
  }
  function makePage(over: Partial<MaterialOcrPage> = {}): MaterialOcrPage {
    return {
      id: 'page-1',
      workspace_id: null,
      opposition_id: 'opp-1',
      material_id: 'mat-1',
      ocr_run_id: 'run-1',
      page_number: 1,
      image_ref: null,
      text: 'texto',
      confidence: 0.9,
      status: 'completed',
      warnings: [],
      errors: [],
      created_at: now,
      updated_at: now,
      ...over,
    };
  }

  it('persiste run + paginas y agrega texto en orden', async () => {
    const repo = new SupabaseMaterialOcrRepository(new InMemorySupabasePort());
    await repo.createRun(makeRun());
    const updated = await repo.updateRun(
      makeRun({ status: 'completed_with_warnings', processed_pages: 2, average_confidence: 0.8, warnings: ['w'] }),
    );
    expect(updated.status).toBe('completed_with_warnings');
    expect(updated.average_confidence).toBe(0.8);
    expect(updated.warnings).toEqual(['w']);

    await repo.createPage(makePage({ id: 'p2', page_number: 2 }));
    await repo.createPage(makePage({ id: 'p1', page_number: 1 }));
    const pages = await repo.listPagesByRun('run-1');
    expect(pages.map((p) => p.id)).toEqual(['p1', 'p2']);

    const latest = await repo.getLatestRunByMaterial('mat-1');
    expect(latest?.id).toBe('run-1');
  });

  it('deleteByMaterial limpia runs y paginas', async () => {
    const repo = new SupabaseMaterialOcrRepository(new InMemorySupabasePort());
    await repo.createRun(makeRun());
    await repo.createPage(makePage());
    await repo.deleteByMaterial('mat-1');
    expect(await repo.getLatestRunByMaterial('mat-1')).toBeNull();
    expect(await repo.listPagesByRun('run-1')).toEqual([]);
  });
});

describe('createCoreRepositories - materialOcr', () => {
  it('memory usa el repo InMemory de OCR', () => {
    const core = createCoreRepositories({ persistence: 'memory' });
    expect(core.materialOcr).toBeInstanceOf(InMemoryMaterialOcrRepository);
  });

  it('supabase usa el repo Supabase de OCR', () => {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(core.materialOcr).toBeInstanceOf(SupabaseMaterialOcrRepository);
    expect(core.mode).toBe('supabase');
  });
});

describe('MaterialOcrService - sin proveedor OCR real (Revision Codex B3)', () => {
  it('con mock NO permitido, no finge lectura: bloquea y deja el escaneo intacto', async () => {
    const materials = new InMemoryMaterialRepository();
    const ocrRepository = new InMemoryMaterialOcrRepository();
    const storage = new InMemoryFileStorage();
    await materials.create(makeMaterial());
    await storage.save(STORAGE_PATH, bytes);
    const service = new MaterialOcrService({
      materials,
      storage,
      ocrRepository,
      renderService: new PlaceholderPdfPageRenderService(),
      provider: new MockOcrProvider(),
      allowMockProvider: false, // staging sin Edge Function real
    });

    await expect(service.startOcr({ material_id: 'mat-1' })).rejects.toMatchObject({
      code: OcrErrorCode.PROVIDER_NOT_CONFIGURED,
    });
    // El material sigue como escaneo pendiente; no se escribio texto ni run.
    const material = await materials.findById('mat-1');
    expect(material?.extraction_status).toBe('scanned_detected');
    expect(material?.content_text).toBeNull();
    expect(await ocrRepository.getLatestRunByMaterial('mat-1')).toBeNull();
  });
});
