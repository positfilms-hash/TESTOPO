// Contrato de persistencia de referencias de fuente (SPEC 028-C). InMemory en el
// MVP/tests y Supabase en produccion (via el factory).

import type { SourceReference } from '../models/sourceReference.js';

export interface SourceReferenceRepository {
  create(reference: SourceReference): Promise<SourceReference>;
  createMany(references: SourceReference[]): Promise<SourceReference[]>;
  findById(id: string): Promise<SourceReference | null>;
  listByMaterial(materialId: string): Promise<SourceReference[]>;
  listBySection(sectionId: string): Promise<SourceReference[]>;
}
