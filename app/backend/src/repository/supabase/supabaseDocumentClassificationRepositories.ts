// Repositorios Supabase de clasificacion documental (SPEC 028-B): ejecuciones
// (`document_understanding_runs`) y clasificaciones por material
// (`document_classifications`). Mismo patron que supabaseMaterialImportRepositories.

import {
  isDocumentClass,
  type DocumentClass,
  type DocumentClassification,
  type DocumentRunStatus,
  type DocumentUnderstandingRun,
} from '../../models/documentClassification.js';
import type {
  DocumentClassificationRepository,
  DocumentUnderstandingRunRepository,
} from '../documentClassificationRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const RUN_TABLE = 'document_understanding_runs';
const CLASSIFICATION_TABLE = 'document_classifications';

export class SupabaseDocumentUnderstandingRunRepository
  implements DocumentUnderstandingRunRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(run: DocumentUnderstandingRun): Promise<DocumentUnderstandingRun> {
    const row = await this.port.table(RUN_TABLE).insert(runToRow(run));
    return toRun(row);
  }

  async findById(id: string): Promise<DocumentUnderstandingRun | null> {
    const rows = await this.port.table(RUN_TABLE).selectMatch({ id });
    return rows[0] ? toRun(rows[0]) : null;
  }

  async save(run: DocumentUnderstandingRun): Promise<DocumentUnderstandingRun> {
    const { id: _id, created_at: _created, ...patch } = runToRow(run);
    const row = await this.port.table(RUN_TABLE).updateById(run.id, patch);
    return toRun(row);
  }

  async findByBatch(batchId: string): Promise<DocumentUnderstandingRun[]> {
    const rows = await this.port
      .table(RUN_TABLE)
      .selectMatch({ batch_id: batchId });
    return rows.map(toRun);
  }
}

export class SupabaseDocumentClassificationRepository
  implements DocumentClassificationRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(item: DocumentClassification): Promise<DocumentClassification> {
    const row = await this.port
      .table(CLASSIFICATION_TABLE)
      .insert(classificationToRow(item));
    return toClassification(row);
  }

  async findById(id: string): Promise<DocumentClassification | null> {
    const rows = await this.port.table(CLASSIFICATION_TABLE).selectMatch({ id });
    return rows[0] ? toClassification(rows[0]) : null;
  }

  async save(item: DocumentClassification): Promise<DocumentClassification> {
    const { id: _id, created_at: _created, ...patch } = classificationToRow(item);
    const row = await this.port
      .table(CLASSIFICATION_TABLE)
      .updateById(item.id, patch);
    return toClassification(row);
  }

  async findByRun(runId: string): Promise<DocumentClassification[]> {
    const rows = await this.port
      .table(CLASSIFICATION_TABLE)
      .selectMatch({ run_id: runId });
    return rows.map(toClassification);
  }

  async findByMaterial(
    materialId: string,
  ): Promise<DocumentClassification | null> {
    const rows = await this.port
      .table(CLASSIFICATION_TABLE)
      .selectMatch({ material_id: materialId });
    const items = rows
      .map(toClassification)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
    return items[0] ?? null;
  }
}

function runToRow(r: DocumentUnderstandingRun): SupabaseRow {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    opposition_id: r.opposition_id,
    batch_id: r.batch_id,
    created_by: r.created_by,
    status: r.status,
    provider: r.provider,
    model: r.model,
    total_materials: r.total_materials,
    classified_materials: r.classified_materials,
    needs_review_count: r.needs_review_count,
    not_analyzable_count: r.not_analyzable_count,
    warnings: r.warnings,
    errors: r.errors,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function toRun(row: SupabaseRow): DocumentUnderstandingRun {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    batch_id: asNullableString(row.batch_id),
    created_by: asNullableString(row.created_by),
    status: row.status as DocumentRunStatus,
    provider: String(row.provider ?? 'heuristic'),
    model: asNullableString(row.model),
    total_materials: asNumber(row.total_materials),
    classified_materials: asNumber(row.classified_materials),
    needs_review_count: asNumber(row.needs_review_count),
    not_analyzable_count: asNumber(row.not_analyzable_count),
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    errors: Array.isArray(row.errors) ? (row.errors as string[]) : [],
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function classificationToRow(c: DocumentClassification): SupabaseRow {
  return {
    id: c.id,
    workspace_id: c.workspace_id,
    opposition_id: c.opposition_id,
    material_id: c.material_id,
    run_id: c.run_id,
    classification: c.classification,
    confidence: c.confidence,
    reason: c.reason,
    detected_title: c.detected_title,
    detected_document_date: c.detected_document_date,
    detected_question_count: c.detected_question_count,
    detected_page_count: c.detected_page_count,
    needs_review: c.needs_review,
    manually_corrected: c.manually_corrected,
    corrected_by: c.corrected_by,
    corrected_at: c.corrected_at ? iso(c.corrected_at) : null,
    warnings: c.warnings,
    created_at: iso(c.created_at),
    updated_at: iso(c.updated_at),
  };
}

function toClassification(row: SupabaseRow): DocumentClassification {
  const classification: DocumentClass = isDocumentClass(row.classification)
    ? row.classification
    : 'ambiguous';
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    material_id: String(row.material_id ?? ''),
    run_id: String(row.run_id ?? ''),
    classification,
    confidence: typeof row.confidence === 'number' ? row.confidence : null,
    reason: asNullableString(row.reason),
    detected_title: asNullableString(row.detected_title),
    detected_document_date: asNullableString(row.detected_document_date),
    detected_question_count:
      typeof row.detected_question_count === 'number'
        ? row.detected_question_count
        : null,
    detected_page_count:
      typeof row.detected_page_count === 'number'
        ? row.detected_page_count
        : null,
    needs_review: row.needs_review === true,
    manually_corrected: row.manually_corrected === true,
    corrected_by: asNullableString(row.corrected_by),
    corrected_at:
      typeof row.corrected_at === 'string' && row.corrected_at.length > 0
        ? parseDate(row.corrected_at)
        : null,
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}
