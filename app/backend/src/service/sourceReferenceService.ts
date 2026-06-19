// Servicio de referencias de fuente (SPEC 028-C, 21). Crea referencias a partir
// de secciones para que specs futuras (indice, generacion) puedan citar una
// fuente concreta. Aqui solo se preparan: no se asocian a preguntas ni indice.

import { randomUUID } from 'node:crypto';
import type { SourceReference } from '../models/sourceReference.js';
import type { MaterialSectionRepository } from '../repository/materialSectionRepository.js';
import type { SourceReferenceRepository } from '../repository/sourceReferenceRepository.js';
import {
  SourceReferenceError,
  SourceReferenceErrorCode,
} from '../sections/sectionErrors.js';

export interface SourceReferenceServiceDeps {
  references: SourceReferenceRepository;
  sections: MaterialSectionRepository;
  generateId?: () => string;
  now?: () => Date;
}

export class SourceReferenceService {
  private readonly references: SourceReferenceRepository;
  private readonly sections: MaterialSectionRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(deps: SourceReferenceServiceDeps) {
    this.references = deps.references;
    this.sections = deps.sections;
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  // Crea una referencia `material_section` a partir de una seccion.
  async createFromSection(sectionId: string): Promise<SourceReference> {
    if (!isNonEmptyString(sectionId)) {
      throw new SourceReferenceError([
        SourceReferenceErrorCode.SECTION_REQUIRED,
      ]);
    }
    const section = await this.sections.findById(sectionId);
    if (!section) {
      throw new SourceReferenceError([SourceReferenceErrorCode.NOT_FOUND]);
    }
    if (!isNonEmptyString(section.material_id)) {
      throw new SourceReferenceError([
        SourceReferenceErrorCode.MATERIAL_REQUIRED,
      ]);
    }
    const timestamp = this.now();
    return this.references.create({
      id: this.generateId(),
      workspace_id: section.workspace_id ?? null,
      opposition_id: section.opposition_id ?? null,
      material_id: section.material_id,
      material_section_id: section.id,
      reference_type: 'material_section',
      label: section.section_title,
      page_start: section.page_start,
      page_end: section.page_end,
      source_excerpt: section.content_excerpt,
      confidence: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  async listByMaterial(materialId: string): Promise<SourceReference[]> {
    return this.references.listByMaterial(materialId);
  }

  async listBySection(sectionId: string): Promise<SourceReference[]> {
    return this.references.listBySection(sectionId);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
