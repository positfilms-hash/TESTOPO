// Contrato de persistencia del OCR de material (SPEC 030): runs + paginas.

import type {
  MaterialOcrPage,
  MaterialOcrRun,
} from '../models/materialOcr.js';

export interface MaterialOcrRepository {
  createRun(run: MaterialOcrRun): Promise<MaterialOcrRun>;
  updateRun(run: MaterialOcrRun): Promise<MaterialOcrRun>;
  getRun(id: string): Promise<MaterialOcrRun | null>;
  getLatestRunByMaterial(materialId: string): Promise<MaterialOcrRun | null>;

  createPage(page: MaterialOcrPage): Promise<MaterialOcrPage>;
  listPagesByRun(runId: string): Promise<MaterialOcrPage[]>;

  /** Limpia runs+paginas de un material (para reintentar sin acumular). */
  deleteByMaterial(materialId: string): Promise<void>;
}
