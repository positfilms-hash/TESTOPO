// Orquestacion del OCR de un material escaneado (SPEC 030).
//
// Solo se ejecuta sobre un PDF detectado como escaneo (o un OCR previo con
// advertencias/fallo, para reintentar). Renderiza paginas (acotado), las lee con
// el proveedor (mock en tests; real via Edge Function en Fase 2), persiste run +
// paginas, y agrega el texto USABLE (en orden de pagina) a `materials.content_text`.
// Un fallo total NO sobreescribe buen texto nativo. NO clasifica ni genera nada.

import { randomUUID } from 'node:crypto';
import type { Material } from '../models/material.js';
import type {
  MaterialOcrPage,
  MaterialOcrRun,
  OcrRunStatus,
} from '../models/materialOcr.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { MaterialOcrRepository } from '../repository/materialOcrRepository.js';
import type { FileStorage } from '../storage/fileStorage.js';
import type { OcrProvider } from '../ocr/ocrProvider.js';
import type { PdfPageRenderService } from '../ocr/pdfPageRenderService.js';
import { confidenceBand, DEFAULT_OCR_CONFIG, type OcrConfig } from '../ocr/ocrConfig.js';
import { OcrError, OcrErrorCode } from '../ocr/ocrErrors.js';

// Estados de extraccion desde los que se puede (re)lanzar OCR.
const OCR_ELIGIBLE = new Set([
  'scanned_detected',
  'completed_ocr_with_warnings',
  'ocr_failed',
]);

export interface MaterialOcrStatus {
  material_id: string;
  extraction_status: string | undefined;
  run: MaterialOcrRun | null;
  pages: MaterialOcrPage[];
}

export interface MaterialOcrServiceDeps {
  materials: MaterialRepository;
  storage: FileStorage;
  ocrRepository: MaterialOcrRepository;
  renderService: PdfPageRenderService;
  provider: OcrProvider;
  config?: OcrConfig;
  /**
   * Revision Codex (staging): si es `false`, NO se permite el proveedor OCR MOCK
   * como si fuera lectura real (se bloquea con PROVIDER_NOT_CONFIGURED sin
   * escribir nada; el material queda como escaneo pendiente). Por defecto `true`
   * (tests/InMemory/demo); en Supabase sin Edge Function la app lo pone a `false`.
   */
  allowMockProvider?: boolean;
  generateId?: () => string;
  now?: () => Date;
}

export class MaterialOcrService {
  private readonly config: OcrConfig;
  private readonly allowMockProvider: boolean;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(private readonly deps: MaterialOcrServiceDeps) {
    this.config = deps.config ?? DEFAULT_OCR_CONFIG;
    this.allowMockProvider = deps.allowMockProvider ?? true;
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  async startOcr(input: {
    material_id: string;
    created_by?: string | null;
  }): Promise<MaterialOcrStatus> {
    return this.runOcr(input.material_id, input.created_by ?? null, false);
  }

  async retryOcr(input: {
    material_id: string;
    created_by?: string | null;
  }): Promise<MaterialOcrStatus> {
    return this.runOcr(input.material_id, input.created_by ?? null, true);
  }

  async getStatus(materialId: string): Promise<MaterialOcrStatus> {
    const material = await this.deps.materials.findById(materialId);
    if (!material) {
      throw new OcrError(OcrErrorCode.MATERIAL_NOT_FOUND);
    }
    const run = await this.deps.ocrRepository.getLatestRunByMaterial(materialId);
    const pages = run
      ? await this.deps.ocrRepository.listPagesByRun(run.id)
      : [];
    return {
      material_id: materialId,
      extraction_status: material.extraction_status,
      run,
      pages,
    };
  }

  private async runOcr(
    materialId: string,
    createdBy: string | null,
    isRetry: boolean,
  ): Promise<MaterialOcrStatus> {
    const material = await this.deps.materials.findById(materialId);
    if (!material) {
      throw new OcrError(OcrErrorCode.MATERIAL_NOT_FOUND);
    }
    if (material.file_extension !== 'pdf' || !material.storage_path) {
      throw new OcrError(OcrErrorCode.MATERIAL_NOT_PDF);
    }
    if (!OCR_ELIGIBLE.has(material.extraction_status ?? '')) {
      throw new OcrError(
        OcrErrorCode.SCAN_NOT_DETECTED,
        'El material no esta marcado como escaneo (ni OCR previo revisable).',
      );
    }
    const pageCount = material.page_count ?? 0;
    if (pageCount > this.config.max_pages) {
      throw new OcrError(OcrErrorCode.PAGE_LIMIT_EXCEEDED);
    }
    // Revision Codex (staging): sin proveedor OCR real (solo el mock) no se finge
    // una lectura. Se bloquea ANTES de leer/escribir: el material queda como
    // escaneo pendiente, abrible y sin texto simulado.
    if (!this.allowMockProvider && this.deps.provider.name === 'mock-ocr') {
      throw new OcrError(
        OcrErrorCode.PROVIDER_NOT_CONFIGURED,
        'El servicio de OCR no esta configurado en este entorno.',
      );
    }
    const bytes = await this.deps.storage.read(material.storage_path);
    if (!bytes) {
      throw new OcrError(
        isRetry ? OcrErrorCode.RETRY_FAILED : OcrErrorCode.RENDER_FAILED,
        'No se pudo leer el archivo original.',
      );
    }

    // Reintento: limpia runs/paginas previos.
    await this.deps.ocrRepository.deleteByMaterial(materialId);

    const timestamp = this.now();
    await this.deps.materials.save({
      ...material,
      extraction_status: 'ocr_processing',
      ocr_status: 'processing',
      updated_at: timestamp,
    });

    const run = await this.deps.ocrRepository.createRun({
      id: this.generateId(),
      workspace_id: null,
      opposition_id: material.opposition_id,
      material_id: materialId,
      created_by: createdBy,
      provider: this.deps.provider.name,
      model: this.deps.provider.model,
      status: 'processing',
      page_count: pageCount,
      processed_pages: 0,
      failed_pages: 0,
      average_confidence: null,
      warnings: [],
      errors: [],
      created_at: timestamp,
      updated_at: timestamp,
    });

    const rendered = await this.deps.renderService.renderPages({
      bytes,
      page_count: pageCount,
      max_pages: this.config.max_pages,
    });

    const pages: MaterialOcrPage[] = [];
    const warnings: string[] = [];
    const confidences: number[] = [];
    let processed = 0;
    let failed = 0;
    const usableTextParts: { page: number; text: string }[] = [];

    for (const rp of rendered) {
      let result;
      try {
        result = await this.deps.provider.recognizePage(rp);
      } catch {
        result = {
          page_number: rp.page_number,
          text: '',
          confidence: null,
          warnings: ['Error del proveedor OCR en esta pagina.'],
        };
      }
      const band = confidenceBand(result.confidence, this.config);
      const ts = this.now();
      const page = await this.deps.ocrRepository.createPage({
        id: this.generateId(),
        workspace_id: null,
        opposition_id: material.opposition_id,
        material_id: materialId,
        ocr_run_id: run.id,
        page_number: result.page_number,
        image_ref: rp.image_ref ?? null,
        text: result.text,
        confidence: result.confidence,
        status: band,
        warnings: result.warnings,
        errors: band === 'failed' ? ['Confianza insuficiente o sin texto.'] : [],
        created_at: ts,
        updated_at: ts,
      });
      pages.push(page);
      if (result.confidence != null) confidences.push(result.confidence);
      if (band === 'failed') {
        failed += 1;
      } else {
        processed += 1;
        if (result.text.trim().length > 0) {
          usableTextParts.push({ page: result.page_number, text: result.text });
        }
        warnings.push(...result.warnings);
      }
    }

    const aggregated = usableTextParts
      .sort((a, b) => a.page - b.page)
      .map((p) => p.text)
      .join('\n\n')
      .trim();
    const avgConfidence =
      confidences.length > 0
        ? round2(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : null;

    // Estado final del run y del material.
    let runStatus: OcrRunStatus;
    let extractionStatus: Material['extraction_status'];
    if (aggregated.length === 0) {
      runStatus = 'failed';
      extractionStatus = 'ocr_failed';
    } else if (failed > 0 || warnings.length > 0) {
      runStatus = 'completed_with_warnings';
      extractionStatus = 'completed_ocr_with_warnings';
    } else {
      runStatus = 'completed';
      extractionStatus = 'completed_ocr';
    }

    const errors =
      aggregated.length === 0
        ? ['No se extrajo texto utilizable del escaneo.']
        : [];
    const finalRun = await this.deps.ocrRepository.updateRun({
      ...run,
      status: runStatus,
      processed_pages: processed,
      failed_pages: failed,
      average_confidence: avgConfidence,
      warnings,
      errors,
      updated_at: this.now(),
    });

    // Un fallo total NO sobreescribe buen texto nativo: solo se escribe
    // content_text cuando hay texto OCR utilizable.
    const finalTimestamp = this.now();
    const updatedMaterial: Material = {
      ...material,
      extraction_status: extractionStatus,
      content_text:
        aggregated.length > 0 ? aggregated : material.content_text,
      extraction_method:
        aggregated.length > 0 ? 'ocr' : material.extraction_method ?? null,
      extraction_error:
        runStatus === 'failed'
          ? 'OCR sin texto utilizable; revisar el escaneo.'
          : null,
      status: runStatus === 'completed' ? 'active' : 'needs_review',
      ocr_status: runStatus,
      ocr_confidence: avgConfidence,
      ocr_page_count: pages.length,
      ocr_processed_pages: processed,
      ocr_failed_pages: failed,
      ocr_warning_count: warnings.length,
      updated_at: finalTimestamp,
    };
    await this.deps.materials.save(updatedMaterial);

    return {
      material_id: materialId,
      extraction_status: extractionStatus,
      run: finalRun,
      pages,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
