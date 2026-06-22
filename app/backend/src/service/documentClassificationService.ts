// Servicio de clasificacion documental e inventario (SPEC 028-B).
//
// Tras una importacion (SPEC 028), clasifica cada material del lote, persiste un
// `DocumentUnderstandingRun` + una `DocumentClassification` por material, ajusta
// `material.status` segun la clasificacion y expone el inventario revisable. La
// correccion humana prevalece. NO genera indice ni preguntas.

import { randomUUID } from 'node:crypto';
import { isUsableExtraction, type Material } from '../models/material.js';
import type { MaterialImportItem } from '../models/materialImportItem.js';
import {
  isDocumentClass,
  type DocumentClass,
  type DocumentClassification,
  type DocumentUnderstandingRun,
} from '../models/documentClassification.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type {
  MaterialImportBatchRepository,
  MaterialImportItemRepository,
} from '../repository/materialImportRepository.js';
import type {
  DocumentClassificationRepository,
  DocumentUnderstandingRunRepository,
} from '../repository/documentClassificationRepository.js';
import type {
  DocumentClassificationProvider,
  DocumentClassificationProviderOutput,
} from '../classification/documentClassificationTypes.js';
import { HeuristicDocumentClassifier } from '../classification/heuristicDocumentClassifier.js';
import {
  loadDocumentClassificationConfig,
  type DocumentClassificationConfig,
} from '../classification/documentClassificationConfig.js';
import {
  DocumentClassificationError,
  DocumentClassificationErrorCode,
} from '../classification/documentClassificationErrors.js';

// Clases que SIEMPRE necesitan revision humana (SPEC 028-B, 11).
const ALWAYS_REVIEW: ReadonlySet<DocumentClass> = new Set([
  'not_analyzable',
  'ambiguous',
  'irrelevant',
]);

const MIN_ANALYZABLE_CHARS = 20;

export interface DocumentClassificationServiceDeps {
  materials: MaterialRepository;
  importBatches: MaterialImportBatchRepository;
  importItems: MaterialImportItemRepository;
  runs: DocumentUnderstandingRunRepository;
  classifications: DocumentClassificationRepository;
  provider?: DocumentClassificationProvider;
  config?: DocumentClassificationConfig;
  generateId?: () => string;
  now?: () => Date;
}

export interface ClassifyBatchInput {
  batch_id: string;
  created_by?: string | null;
}

export interface DocumentInventory {
  run: DocumentUnderstandingRun | null;
  classifications: DocumentClassification[];
}

export interface CorrectClassificationInput {
  classification_id: string;
  classification: DocumentClass;
  corrected_by?: string | null;
}

export class DocumentClassificationService {
  private readonly materials: MaterialRepository;
  private readonly batches: MaterialImportBatchRepository;
  private readonly items: MaterialImportItemRepository;
  private readonly runs: DocumentUnderstandingRunRepository;
  private readonly classifications: DocumentClassificationRepository;
  private readonly provider: DocumentClassificationProvider;
  private readonly config: DocumentClassificationConfig;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(deps: DocumentClassificationServiceDeps) {
    this.materials = deps.materials;
    this.batches = deps.importBatches;
    this.items = deps.importItems;
    this.runs = deps.runs;
    this.classifications = deps.classifications;
    this.provider = deps.provider ?? new HeuristicDocumentClassifier();
    this.config = deps.config ?? loadDocumentClassificationConfig();
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  // --- Clasificar un lote --------------------------------------------------

  async classifyBatch(input: ClassifyBatchInput): Promise<DocumentInventory> {
    const batch = await this.batches.findById(input.batch_id);
    if (!batch) {
      throw new DocumentClassificationError([
        DocumentClassificationErrorCode.BATCH_NOT_FOUND,
      ]);
    }

    const items = await this.items.findByBatch(input.batch_id);
    const itemByMaterial = new Map<string, MaterialImportItem>();
    for (const item of items) {
      if (item.material_id) {
        itemByMaterial.set(item.material_id, item);
      }
    }
    const materials: Material[] = [];
    for (const materialId of itemByMaterial.keys()) {
      const material = await this.materials.findById(materialId);
      if (material) {
        materials.push(material);
      }
    }

    const timestamp = this.now();
    const run = await this.runs.create({
      id: this.generateId(),
      workspace_id: batch.workspace_id || null,
      opposition_id: batch.opposition_id || null,
      batch_id: batch.id,
      created_by: input.created_by ?? null,
      status: 'processing',
      provider: this.provider.name,
      model: this.provider.model,
      total_materials: materials.length,
      classified_materials: 0,
      needs_review_count: 0,
      not_analyzable_count: 0,
      warnings: [],
      errors: [],
      created_at: timestamp,
      updated_at: timestamp,
    });

    const warnings: string[] = [];
    let needsReviewCount = 0;
    let notAnalyzableCount = 0;
    const created: DocumentClassification[] = [];

    for (const material of materials) {
      const item = itemByMaterial.get(material.id);
      const output = await this.classifyOne(material, item, warnings);
      const needsReview =
        output.confidence < this.config.confidence_threshold ||
        ALWAYS_REVIEW.has(output.classification);
      if (needsReview) {
        needsReviewCount += 1;
      }
      if (output.classification === 'not_analyzable') {
        notAnalyzableCount += 1;
      }

      const ts = this.now();
      const classification = await this.classifications.create({
        id: this.generateId(),
        workspace_id: batch.workspace_id || null,
        opposition_id: batch.opposition_id || null,
        material_id: material.id,
        run_id: run.id,
        classification: output.classification,
        confidence: output.confidence,
        reason: output.reason,
        detected_title: output.detected_title,
        detected_document_date: null,
        detected_question_count: output.detected_question_count,
        detected_page_count: material.page_count ?? null,
        needs_review: needsReview,
        manually_corrected: false,
        corrected_by: null,
        corrected_at: null,
        warnings: output.warnings,
        created_at: ts,
        updated_at: ts,
      });
      created.push(classification);
      await this.applyMaterialStatus(material, output.classification, needsReview);
    }

    const finalRun = await this.runs.save({
      ...run,
      status: warnings.length > 0 ? 'completed_with_warnings' : 'completed',
      classified_materials: created.length,
      needs_review_count: needsReviewCount,
      not_analyzable_count: notAnalyzableCount,
      warnings,
      updated_at: this.now(),
    });

    return { run: finalRun, classifications: created };
  }

  // --- Clasificar TODA la oposicion (SPEC 029, "Analizar material") --------

  // Clasifica todos los materiales `active` y analizables de la oposicion (no
  // solo un lote). Preserva las correcciones manuales (no reclasifica los
  // corregidos a mano), salta la extraccion fallida/escaneada con un aviso, y NO
  // genera indice, preguntas ni tests. Devuelve el inventario revisable.
  async classifyOpposition(input: {
    opposition_id: string;
    created_by?: string | null;
  }): Promise<DocumentInventory> {
    const oppositionId = input.opposition_id;
    const materials = (
      await this.materials.findAll({ opposition_id: oppositionId })
    ).filter((m) => m.status === 'active');

    const timestamp = this.now();
    const run = await this.runs.create({
      id: this.generateId(),
      workspace_id: null,
      opposition_id: oppositionId,
      batch_id: null,
      created_by: input.created_by ?? null,
      status: 'processing',
      provider: this.provider.name,
      model: this.provider.model,
      total_materials: materials.length,
      classified_materials: 0,
      needs_review_count: 0,
      not_analyzable_count: 0,
      warnings: [],
      errors: [],
      created_at: timestamp,
      updated_at: timestamp,
    });

    const warnings: string[] = [];
    let needsReviewCount = 0;
    let notAnalyzableCount = 0;
    let classifiedCount = 0;
    // Inventario: la clasificacion vigente por material (nueva o preservada).
    const byMaterial = new Map<string, DocumentClassification>();

    for (const material of materials) {
      const existing = await this.classifications.findByMaterial(material.id);
      // Preserva la correccion humana: no reclasifica.
      if (existing?.manually_corrected) {
        byMaterial.set(material.id, existing);
        continue;
      }
      // Salta extraccion no utilizable (fallida/escaneo sin OCR) con aviso.
      // Texto nativo y texto recuperado por OCR (SPEC 030/032) SI son analizables.
      if (
        material.extraction_status &&
        !isUsableExtraction(material.extraction_status)
      ) {
        warnings.push(
          `"${material.title}" se omitió: extracción ${material.extraction_status}.`,
        );
        if (existing) byMaterial.set(material.id, existing);
        continue;
      }

      const output = await this.classifyOne(material, undefined, warnings);
      const needsReview =
        output.confidence < this.config.confidence_threshold ||
        ALWAYS_REVIEW.has(output.classification);
      if (needsReview) needsReviewCount += 1;
      if (output.classification === 'not_analyzable') notAnalyzableCount += 1;

      const ts = this.now();
      const classification = await this.classifications.create({
        id: this.generateId(),
        workspace_id: null,
        opposition_id: oppositionId,
        material_id: material.id,
        run_id: run.id,
        classification: output.classification,
        confidence: output.confidence,
        reason: output.reason,
        detected_title: output.detected_title,
        detected_document_date: null,
        detected_question_count: output.detected_question_count,
        detected_page_count: material.page_count ?? null,
        needs_review: needsReview,
        manually_corrected: false,
        corrected_by: null,
        corrected_at: null,
        warnings: output.warnings,
        created_at: ts,
        updated_at: ts,
      });
      byMaterial.set(material.id, classification);
      classifiedCount += 1;
      await this.applyMaterialStatus(material, output.classification, needsReview);
    }

    const finalRun = await this.runs.save({
      ...run,
      status: warnings.length > 0 ? 'completed_with_warnings' : 'completed',
      classified_materials: classifiedCount,
      needs_review_count: needsReviewCount,
      not_analyzable_count: notAnalyzableCount,
      warnings,
      updated_at: this.now(),
    });

    return { run: finalRun, classifications: [...byMaterial.values()] };
  }

  // Inventario por oposicion: la clasificacion vigente de cada material activo.
  async getOppositionInventory(oppositionId: string): Promise<DocumentInventory> {
    const materials = (
      await this.materials.findAll({ opposition_id: oppositionId })
    ).filter((m) => m.status === 'active');
    const classifications: DocumentClassification[] = [];
    for (const material of materials) {
      const c = await this.classifications.findByMaterial(material.id);
      if (c) classifications.push(c);
    }
    return { run: null, classifications };
  }

  // --- Inventario ----------------------------------------------------------

  // Inventario del lote: la ejecucion mas reciente + sus clasificaciones.
  async getInventory(batchId: string): Promise<DocumentInventory> {
    const runs = (await this.runs.findByBatch(batchId)).sort(
      (a, b) => b.updated_at.getTime() - a.updated_at.getTime(),
    );
    const run = runs[0] ?? null;
    const classifications = run
      ? await this.classifications.findByRun(run.id)
      : [];
    return { run, classifications };
  }

  // --- Correccion humana (SPEC 028-B, 16). Prevalece sobre la IA. ----------

  async correctClassification(
    input: CorrectClassificationInput,
  ): Promise<DocumentClassification> {
    if (!isDocumentClass(input.classification)) {
      throw new DocumentClassificationError([
        DocumentClassificationErrorCode.INVALID_CLASSIFICATION,
      ]);
    }
    const existing = await this.classifications.findById(input.classification_id);
    if (!existing) {
      throw new DocumentClassificationError([
        DocumentClassificationErrorCode.CLASSIFICATION_NOT_FOUND,
      ]);
    }
    const ts = this.now();
    const updated = await this.classifications.save({
      ...existing,
      classification: input.classification,
      // El humano resuelve la duda: deja de necesitar revision.
      needs_review: false,
      manually_corrected: true,
      corrected_by: input.corrected_by ?? null,
      corrected_at: ts,
      updated_at: ts,
    });
    const material = await this.materials.findById(existing.material_id);
    if (material) {
      await this.applyMaterialStatus(material, input.classification, false);
    }
    return updated;
  }

  // --- Apoyo a la visibilidad del alumno (lo usa el facade) ----------------

  async getClassificationForMaterial(
    materialId: string,
  ): Promise<DocumentClassification | null> {
    return this.classifications.findByMaterial(materialId);
  }

  // Una clasificacion por id (la usa el facade para resolver permisos al corregir).
  async getClassificationById(
    classificationId: string,
  ): Promise<DocumentClassification | null> {
    return this.classifications.findById(classificationId);
  }

  // --- Internos ------------------------------------------------------------

  private async classifyOne(
    material: Material,
    item: MaterialImportItem | undefined,
    warnings: string[],
  ): Promise<DocumentClassificationProviderOutput> {
    const text = material.content_text ?? '';
    const title = material.title;
    const filename = material.original_filename ?? material.title;
    const originalPath = item?.original_path ?? filename;

    // Sin texto extraible -> no analizable, sin llamar al proveedor (ahorra
    // llamadas externas y es determinista).
    if (text.trim().length < MIN_ANALYZABLE_CHARS) {
      return {
        classification: 'not_analyzable',
        confidence: 0.9,
        reason: 'No hay texto extraible suficiente para analizar el documento.',
        detected_title: title,
        detected_question_count: null,
        warnings: [],
        provider: this.provider.name,
        model: this.provider.model,
      };
    }

    try {
      return await this.provider.classify({
        material_id: material.id,
        title,
        filename,
        original_path: originalPath,
        upload_category: item?.upload_category ?? null,
        detected_category: item?.detected_category ?? null,
        text: text.slice(0, this.config.max_input_chars),
        page_count: material.page_count ?? null,
      });
    } catch (error) {
      warnings.push(`No se pudo clasificar "${title}" automaticamente.`);
      return {
        classification: 'ambiguous',
        confidence: 0,
        reason: `Error del clasificador: ${String(error)}`,
        detected_title: title,
        detected_question_count: null,
        warnings: ['Error del clasificador; revisar manualmente.'],
        provider: this.provider.name,
        model: this.provider.model,
      };
    }
  }

  // Ajusta el estado del material segun la clasificacion (SPEC 028-B, 12). No
  // marca `obsolete` automaticamente. No degrada materiales ya gestionados a mano
  // mas alla de lo necesario.
  private async applyMaterialStatus(
    material: Material,
    classification: DocumentClass,
    needsReview: boolean,
  ): Promise<void> {
    const status: Material['status'] =
      needsReview || ALWAYS_REVIEW.has(classification) ? 'needs_review' : 'active';
    if (material.status !== status) {
      await this.materials.save({
        ...material,
        status,
        updated_at: this.now(),
      });
    }
  }
}

// Agrupa clasificaciones por clase documental (para el inventario, SPEC 028-B 15).
export function groupByClassification(
  items: DocumentClassification[],
): Record<DocumentClass, DocumentClassification[]> {
  const groups = {} as Record<DocumentClass, DocumentClassification[]>;
  for (const item of items) {
    (groups[item.classification] ??= []).push(item);
  }
  return groups;
}
