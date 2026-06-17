// Implementacion en memoria de los repositorios de importacion (SPEC 017).

import type { MaterialImportBatch } from '../models/materialImportBatch.js';
import type { MaterialImportItem } from '../models/materialImportItem.js';
import type {
  MaterialImportBatchRepository,
  MaterialImportItemRepository,
} from './materialImportRepository.js';

export class InMemoryMaterialImportBatchRepository
  implements MaterialImportBatchRepository
{
  private readonly batches = new Map<string, MaterialImportBatch>();

  async create(batch: MaterialImportBatch): Promise<MaterialImportBatch> {
    this.batches.set(batch.id, structuredClone(batch));
    return structuredClone(batch);
  }

  async findById(id: string): Promise<MaterialImportBatch | null> {
    const batch = this.batches.get(id);
    return batch ? structuredClone(batch) : null;
  }

  async save(batch: MaterialImportBatch): Promise<MaterialImportBatch> {
    if (!this.batches.has(batch.id)) {
      throw new Error(`Cannot save unknown import batch: ${batch.id}`);
    }
    this.batches.set(batch.id, structuredClone(batch));
    return structuredClone(batch);
  }
}

export class InMemoryMaterialImportItemRepository
  implements MaterialImportItemRepository
{
  private readonly items = new Map<string, MaterialImportItem>();

  async create(item: MaterialImportItem): Promise<MaterialImportItem> {
    this.items.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  async findByBatch(batchId: string): Promise<MaterialImportItem[]> {
    return [...this.items.values()]
      .filter((item) => item.batch_id === batchId)
      .map((item) => structuredClone(item));
  }
}
