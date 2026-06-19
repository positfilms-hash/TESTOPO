// Servicio de secciones de material (SPEC 028-C, 20). Divide un material util en
// secciones/fragmentos referenciables a partir de su texto extraido y su
// clasificacion documental (SPEC 028-B). Reprocesar reemplaza las secciones
// previas. NO genera indice ni preguntas; sin OCR/RAG/embeddings.

import { randomUUID } from 'node:crypto';
import type { Material } from '../models/material.js';
import {
  isEligibleDocumentClass,
  sectionClassForDocument,
  type MaterialSection,
} from '../models/materialSection.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type {
  MaterialImportBatchRepository,
  MaterialImportItemRepository,
} from '../repository/materialImportRepository.js';
import type {
  MaterialSectionRepository,
  SectionSearchInput,
} from '../repository/materialSectionRepository.js';
import type { DocumentClassificationService } from './documentClassificationService.js';
import { segmentText } from '../sections/segmentText.js';
import {
  loadSegmentConfig,
  type SegmentConfig,
} from '../sections/segmentConfig.js';
import {
  MaterialSectionError,
  MaterialSectionErrorCode,
} from '../sections/sectionErrors.js';

export interface MaterialSectionServiceDeps {
  materials: MaterialRepository;
  documentClassification: DocumentClassificationService;
  sections: MaterialSectionRepository;
  importBatches: MaterialImportBatchRepository;
  importItems: MaterialImportItemRepository;
  config?: SegmentConfig;
  generateId?: () => string;
  now?: () => Date;
}

export class MaterialSectionService {
  private readonly materials: MaterialRepository;
  private readonly classifier: DocumentClassificationService;
  private readonly sections: MaterialSectionRepository;
  private readonly batches: MaterialImportBatchRepository;
  private readonly items: MaterialImportItemRepository;
  private readonly config: SegmentConfig;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(deps: MaterialSectionServiceDeps) {
    this.materials = deps.materials;
    this.classifier = deps.documentClassification;
    this.sections = deps.sections;
    this.batches = deps.importBatches;
    this.items = deps.importItems;
    this.config = deps.config ?? loadSegmentConfig();
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  // Crea (o reprocesa, reemplazando) las secciones de un material util.
  async createSectionsForMaterial(
    materialId: string,
  ): Promise<MaterialSection[]> {
    if (!isNonEmptyString(materialId)) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.MATERIAL_REQUIRED,
      ]);
    }
    const material = await this.materials.findById(materialId);
    if (!material) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.MATERIAL_NOT_FOUND,
      ]);
    }
    if (
      material.extraction_status !== 'completed' ||
      !isNonEmptyString(material.content_text)
    ) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.NOT_ANALYZABLE,
      ]);
    }

    // La elegibilidad depende de la clasificacion vigente (SPEC 028-B). Una
    // correccion humana de `ambiguous` a una clase util la deja elegible.
    const classification =
      await this.classifier.getClassificationForMaterial(materialId);
    if (!classification || !isEligibleDocumentClass(classification.classification)) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.CLASSIFICATION_NOT_ALLOWED,
      ]);
    }

    const segments = segmentText(
      material.content_text ?? '',
      classification.classification,
      this.config,
    );
    if (segments.length === 0) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.TEXT_REQUIRED,
      ]);
    }

    // Reprocesado (SPEC 028-C, 25): reemplaza las secciones anteriores.
    await this.sections.deleteByMaterial(materialId);

    const sectionClass = sectionClassForDocument(classification.classification);
    const filename = material.original_filename ?? material.title;
    const timestamp = this.now();
    const toCreate: MaterialSection[] = segments.map((segment) => ({
      id: this.generateId(),
      workspace_id: classification.workspace_id ?? null,
      opposition_id: material.opposition_id,
      material_id: material.id,
      section_title: segment.section_title,
      section_type: segment.section_type,
      page_start: null,
      page_end: null,
      content_excerpt: segment.content_excerpt,
      content_text: segment.content_text,
      order_index: segment.order_index,
      classification: sectionClass,
      source_path: `${filename} - ${segment.section_title}`,
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp,
    }));
    return this.sections.createMany(toCreate);
  }

  // Crea secciones para todos los materiales utiles de un lote (los no elegibles
  // se omiten sin abortar).
  async createSectionsForBatch(batchId: string): Promise<MaterialSection[]> {
    const batch = await this.batches.findById(batchId);
    if (!batch) {
      return [];
    }
    const items = await this.items.findByBatch(batchId);
    const created: MaterialSection[] = [];
    for (const item of items) {
      if (!item.material_id) {
        continue;
      }
      try {
        created.push(...(await this.createSectionsForMaterial(item.material_id)));
      } catch (error) {
        // Material no elegible (no analizable, clasificacion no util): se omite.
        if (!(error instanceof MaterialSectionError)) {
          throw error;
        }
      }
    }
    return created;
  }

  async listByMaterial(materialId: string): Promise<MaterialSection[]> {
    return this.sections.listByMaterial(materialId);
  }

  async reprocessMaterial(materialId: string): Promise<MaterialSection[]> {
    return this.createSectionsForMaterial(materialId);
  }

  async search(input: SectionSearchInput): Promise<MaterialSection[]> {
    if (!isNonEmptyString(input.opposition_id)) {
      throw new MaterialSectionError([MaterialSectionErrorCode.SEARCH_FAILED]);
    }
    return this.sections.search(input);
  }

  // Material de una seccion (lo usa el facade para resolver permisos).
  async getMaterialForSection(sectionId: string): Promise<Material | null> {
    const section = await this.sections.findById(sectionId);
    if (!section) {
      return null;
    }
    return this.materials.findById(section.material_id);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
