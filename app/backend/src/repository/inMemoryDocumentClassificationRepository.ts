// Implementacion InMemory de los repositorios de clasificacion documental
// (SPEC 028-B). Para tests y modo demo. Guarda copias para evitar aliasing.

import type {
  DocumentClassification,
  DocumentUnderstandingRun,
} from '../models/documentClassification.js';
import type {
  DocumentClassificationRepository,
  DocumentUnderstandingRunRepository,
} from './documentClassificationRepository.js';

export class InMemoryDocumentUnderstandingRunRepository
  implements DocumentUnderstandingRunRepository
{
  private readonly runs = new Map<string, DocumentUnderstandingRun>();

  async create(run: DocumentUnderstandingRun): Promise<DocumentUnderstandingRun> {
    this.runs.set(run.id, { ...run });
    return { ...run };
  }

  async findById(id: string): Promise<DocumentUnderstandingRun | null> {
    const run = this.runs.get(id);
    return run ? { ...run } : null;
  }

  async save(run: DocumentUnderstandingRun): Promise<DocumentUnderstandingRun> {
    this.runs.set(run.id, { ...run });
    return { ...run };
  }

  async findByBatch(batchId: string): Promise<DocumentUnderstandingRun[]> {
    return [...this.runs.values()]
      .filter((r) => r.batch_id === batchId)
      .map((r) => ({ ...r }));
  }
}

export class InMemoryDocumentClassificationRepository
  implements DocumentClassificationRepository
{
  private readonly items = new Map<string, DocumentClassification>();

  async create(item: DocumentClassification): Promise<DocumentClassification> {
    this.items.set(item.id, { ...item });
    return { ...item };
  }

  async findById(id: string): Promise<DocumentClassification | null> {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  async save(item: DocumentClassification): Promise<DocumentClassification> {
    this.items.set(item.id, { ...item });
    return { ...item };
  }

  async findByRun(runId: string): Promise<DocumentClassification[]> {
    return [...this.items.values()]
      .filter((i) => i.run_id === runId)
      .map((i) => ({ ...i }));
  }

  async findByMaterial(
    materialId: string,
  ): Promise<DocumentClassification | null> {
    const matches = [...this.items.values()]
      .filter((i) => i.material_id === materialId)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
    return matches[0] ? { ...matches[0] } : null;
  }
}
