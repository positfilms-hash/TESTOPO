// Repositorios Supabase de importacion de material (SPEC 022): lotes e items.
// Implementan `MaterialImportBatchRepository` y `MaterialImportItemRepository`
// sobre `material_import_batches` y `material_import_items`.

import type {
  ImportBatchStatus,
  ImportSourceType,
  MaterialImportBatch,
} from '../../models/materialImportBatch.js';
import type {
  ImportItemStatus,
  MaterialImportItem,
} from '../../models/materialImportItem.js';
import type {
  DetectedCategory,
  UploadCategory,
} from '../../models/uploadCategory.js';
import type {
  MaterialImportBatchRepository,
  MaterialImportItemRepository,
} from '../materialImportRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const BATCH_TABLE = 'material_import_batches';
const ITEM_TABLE = 'material_import_items';

export class SupabaseMaterialImportBatchRepository
  implements MaterialImportBatchRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(batch: MaterialImportBatch): Promise<MaterialImportBatch> {
    const row = await this.port.table(BATCH_TABLE).insert(batchToRow(batch));
    return toBatch(row);
  }

  async findById(id: string): Promise<MaterialImportBatch | null> {
    const rows = await this.port.table(BATCH_TABLE).selectMatch({ id });
    return rows[0] ? toBatch(rows[0]) : null;
  }

  async save(batch: MaterialImportBatch): Promise<MaterialImportBatch> {
    const { id: _omit, created_at: _omitCreated, ...patch } = batchToRow(batch);
    const row = await this.port.table(BATCH_TABLE).updateById(batch.id, patch);
    return toBatch(row);
  }
}

export class SupabaseMaterialImportItemRepository
  implements MaterialImportItemRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(item: MaterialImportItem): Promise<MaterialImportItem> {
    const row = await this.port.table(ITEM_TABLE).insert(itemToRow(item));
    return toItem(row);
  }

  async findByBatch(batchId: string): Promise<MaterialImportItem[]> {
    const rows = await this.port
      .table(ITEM_TABLE)
      .selectMatch({ batch_id: batchId });
    return rows.map(toItem);
  }
}

function batchToRow(b: MaterialImportBatch): SupabaseRow {
  return {
    id: b.id,
    workspace_id: b.workspace_id,
    opposition_id: b.opposition_id,
    uploaded_by: b.uploaded_by,
    status: b.status,
    source_type: b.source_type,
    upload_category: b.upload_category,
    original_filename: b.original_filename,
    total_files: b.total_files,
    imported_files: b.imported_files,
    skipped_files: b.skipped_files,
    failed_files: b.failed_files,
    analyzed_files: b.analyzed_files,
    // `errors`/`warnings` son jsonb en la tabla; el modelo los expone como string[].
    errors: b.errors,
    warnings: b.warnings,
    created_at: iso(b.created_at),
    updated_at: iso(b.updated_at),
  };
}

function toBatch(row: SupabaseRow): MaterialImportBatch {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id ?? ''),
    opposition_id: String(row.opposition_id ?? ''),
    uploaded_by:
      typeof row.uploaded_by === 'string' && row.uploaded_by.length > 0
        ? row.uploaded_by
        : null,
    status: row.status as ImportBatchStatus,
    source_type: row.source_type as ImportSourceType,
    upload_category: (row.upload_category as UploadCategory) ?? 'opposition_material',
    original_filename:
      typeof row.original_filename === 'string' && row.original_filename.length > 0
        ? row.original_filename
        : null,
    total_files: asNumber(row.total_files),
    imported_files: asNumber(row.imported_files),
    skipped_files: asNumber(row.skipped_files),
    failed_files: asNumber(row.failed_files),
    analyzed_files: asNumber(row.analyzed_files),
    errors: Array.isArray(row.errors) ? (row.errors as string[]) : [],
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function itemToRow(i: MaterialImportItem): SupabaseRow {
  return {
    id: i.id,
    batch_id: i.batch_id,
    workspace_id: i.workspace_id,
    opposition_id: i.opposition_id,
    material_id: i.material_id,
    topic_id: i.topic_id,
    original_path: i.original_path,
    original_filename: i.original_filename,
    upload_category: i.upload_category,
    detected_category: i.detected_category,
    ai_classification_confidence: i.ai_classification_confidence,
    status: i.status,
    error: i.error,
    created_at: iso(i.created_at),
    updated_at: iso(i.updated_at),
  };
}

function toItem(row: SupabaseRow): MaterialImportItem {
  return {
    id: String(row.id),
    batch_id: String(row.batch_id ?? ''),
    workspace_id:
      typeof row.workspace_id === 'string' && row.workspace_id.length > 0
        ? row.workspace_id
        : null,
    opposition_id:
      typeof row.opposition_id === 'string' && row.opposition_id.length > 0
        ? row.opposition_id
        : null,
    material_id:
      typeof row.material_id === 'string' && row.material_id.length > 0
        ? row.material_id
        : null,
    topic_id:
      typeof row.topic_id === 'string' && row.topic_id.length > 0
        ? row.topic_id
        : null,
    original_path: String(row.original_path ?? ''),
    original_filename: String(row.original_filename ?? ''),
    upload_category:
      (row.upload_category as UploadCategory) ?? 'opposition_material',
    detected_category:
      (row.detected_category as DetectedCategory) ?? 'opposition_material',
    ai_classification_confidence:
      typeof row.ai_classification_confidence === 'number'
        ? row.ai_classification_confidence
        : null,
    status: row.status as ImportItemStatus,
    error: typeof row.error === 'string' && row.error.length > 0 ? row.error : null,
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}
