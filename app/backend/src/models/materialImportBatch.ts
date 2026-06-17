// Lote de importacion de material (SPEC 017): agrupa la subida multiple o la
// importacion de un ZIP y guarda el resumen (cuantos se importaron, omitieron
// o fallaron) para poder consultarlo despues.

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
  original_filename: string | null;
  total_files: number;
  imported_files: number;
  skipped_files: number;
  failed_files: number;
  errors: string[];
  created_at: Date;
  updated_at: Date;
}
