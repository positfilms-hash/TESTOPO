// Contratos de persistencia de la clasificacion documental (SPEC 028-B). Almacen
// InMemory en el MVP/tests y Supabase en produccion (via el factory).

import type {
  DocumentClassification,
  DocumentUnderstandingRun,
} from '../models/documentClassification.js';

export interface DocumentUnderstandingRunRepository {
  create(run: DocumentUnderstandingRun): Promise<DocumentUnderstandingRun>;
  findById(id: string): Promise<DocumentUnderstandingRun | null>;
  save(run: DocumentUnderstandingRun): Promise<DocumentUnderstandingRun>;
  findByBatch(batchId: string): Promise<DocumentUnderstandingRun[]>;
}

export interface DocumentClassificationRepository {
  create(item: DocumentClassification): Promise<DocumentClassification>;
  findById(id: string): Promise<DocumentClassification | null>;
  save(item: DocumentClassification): Promise<DocumentClassification>;
  findByRun(runId: string): Promise<DocumentClassification[]>;
  /** La mas reciente por material (para resolver visibilidad del alumno). */
  findByMaterial(materialId: string): Promise<DocumentClassification | null>;
}
