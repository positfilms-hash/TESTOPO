// Almacen en memoria del OCR de material (SPEC 030).

import type {
  MaterialOcrPage,
  MaterialOcrRun,
} from '../models/materialOcr.js';
import type { MaterialOcrRepository } from './materialOcrRepository.js';

export class InMemoryMaterialOcrRepository implements MaterialOcrRepository {
  private readonly runs = new Map<string, MaterialOcrRun>();
  private readonly pages = new Map<string, MaterialOcrPage>();

  async createRun(run: MaterialOcrRun): Promise<MaterialOcrRun> {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async updateRun(run: MaterialOcrRun): Promise<MaterialOcrRun> {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async getRun(id: string): Promise<MaterialOcrRun | null> {
    const run = this.runs.get(id);
    return run ? clone(run) : null;
  }

  async getLatestRunByMaterial(
    materialId: string,
  ): Promise<MaterialOcrRun | null> {
    const runs = [...this.runs.values()]
      .filter((r) => r.material_id === materialId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return runs[0] ? clone(runs[0]) : null;
  }

  async createPage(page: MaterialOcrPage): Promise<MaterialOcrPage> {
    this.pages.set(page.id, clone(page));
    return clone(page);
  }

  async listPagesByRun(runId: string): Promise<MaterialOcrPage[]> {
    return [...this.pages.values()]
      .filter((p) => p.ocr_run_id === runId)
      .sort((a, b) => a.page_number - b.page_number)
      .map(clone);
  }

  async deleteByMaterial(materialId: string): Promise<void> {
    for (const [id, run] of this.runs) {
      if (run.material_id === materialId) this.runs.delete(id);
    }
    for (const [id, page] of this.pages) {
      if (page.material_id === materialId) this.pages.delete(id);
    }
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
