// Contratos de persistencia de la importacion de material (SPEC 017). Almacen
// en memoria en el MVP, definidos como interfaces para poder sustituirlos.

import type { MaterialImportBatch } from '../models/materialImportBatch.js';
import type { MaterialImportItem } from '../models/materialImportItem.js';

export interface MaterialImportBatchRepository {
  create(batch: MaterialImportBatch): Promise<MaterialImportBatch>;
  findById(id: string): Promise<MaterialImportBatch | null>;
  save(batch: MaterialImportBatch): Promise<MaterialImportBatch>;
}

export interface MaterialImportItemRepository {
  create(item: MaterialImportItem): Promise<MaterialImportItem>;
  findByBatch(batchId: string): Promise<MaterialImportItem[]>;
}
