// Lote de importacion de material (SPEC 017): agrupa la subida multiple o la
// importacion de un ZIP y guarda el resumen (cuantos se importaron, omitieron
// o fallaron) para poder consultarlo despues.
//
// SPEC 028 (Smart Bulk Upload) anade `upload_category` (la categoria que eligio
// el usuario: material de oposicion / tests antiguos / combinado), un contador
// `analyzed_files` (materiales con texto extraido) y `warnings` (avisos no
// fatales del lote, p. ej. clasificacion ambigua en un ZIP combinado).

import type { UploadCategory } from './uploadCategory.js';

export const IMPORT_SOURCE_TYPES = ['multi_file', 'zip', 'folder'] as const;
export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number];

export const IMPORT_BATCH_STATUSES = [
  'pending',
  'processing',
  'completed',
  'completed_with_errors',
  'failed',
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export interface MaterialImportBatch {
  id: string;
  workspace_id: string;
  opposition_id: string;
  uploaded_by: string | null;
  status: ImportBatchStatus;
  source_type: ImportSourceType;
  /** Categoria elegida por el usuario en la carga masiva (SPEC 028). */
  upload_category: UploadCategory;
  original_filename: string | null;
  total_files: number;
  imported_files: number;
  skipped_files: number;
  failed_files: number;
  /** Materiales con texto extraido (`extraction_status = completed`). SPEC 028. */
  analyzed_files: number;
  errors: string[];
  /** Avisos no fatales del lote (SPEC 028); p. ej. clasificacion ambigua. */
  warnings: string[];
  created_at: Date;
  updated_at: Date;
}
