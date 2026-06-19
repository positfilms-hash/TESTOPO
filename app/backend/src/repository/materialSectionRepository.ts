// Contrato de persistencia de secciones de material (SPEC 028-C). InMemory en el
// MVP/tests y Supabase en produccion (via el factory).

import type { MaterialSection, SectionClass } from '../models/materialSection.js';

export interface SectionSearchInput {
  opposition_id: string;
  query: string;
  classification?: SectionClass;
  material_ids?: string[];
  limit?: number;
}

export interface MaterialSectionRepository {
  create(section: MaterialSection): Promise<MaterialSection>;
  createMany(sections: MaterialSection[]): Promise<MaterialSection[]>;
  findById(id: string): Promise<MaterialSection | null>;
  listByMaterial(materialId: string): Promise<MaterialSection[]>;
  deleteByMaterial(materialId: string): Promise<void>;
  search(input: SectionSearchInput): Promise<MaterialSection[]>;
}
