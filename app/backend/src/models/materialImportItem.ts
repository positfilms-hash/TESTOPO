// Item de un lote de importacion (SPEC 017): un archivo del ZIP o de la subida
// multiple, con su resultado (importado, omitido o fallido) y el material/tema
// que genero, para trazabilidad y para el resumen de importacion.
//
// SPEC 028 (Smart Bulk Upload) anade el scope (`workspace_id`/`opposition_id`),
// la categoria elegida (`upload_category`), la categoria inferida por la app
// (`detected_category`, que puede quedar `unknown`) y una confianza opcional de
// clasificacion (`ai_classification_confidence`).

import type {
  DetectedCategory,
  UploadCategory,
} from './uploadCategory.js';

export const IMPORT_ITEM_STATUSES = ['imported', 'skipped', 'failed'] as const;
export type ImportItemStatus = (typeof IMPORT_ITEM_STATUSES)[number];

export interface MaterialImportItem {
  id: string;
  batch_id: string;
  workspace_id: string | null;
  opposition_id: string | null;
  material_id: string | null;
  topic_id: string | null;
  /** Ruta original dentro del ZIP (p. ej. `Tema 1/01 Intro.pdf`). */
  original_path: string;
  original_filename: string;
  /** Categoria elegida por el usuario para el lote (SPEC 028). */
  upload_category: UploadCategory;
  /** Categoria inferida por la app para este archivo (SPEC 028). */
  detected_category: DetectedCategory;
  /** Confianza 0..1 de la clasificacion; null si no se infiere (SPEC 028). */
  ai_classification_confidence: number | null;
  status: ImportItemStatus;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}
