// Item de un lote de importacion (SPEC 017): un archivo del ZIP o de la subida
// multiple, con su resultado (importado, omitido o fallido) y el material/tema
// que genero, para trazabilidad y para el resumen de importacion.

export const IMPORT_ITEM_STATUSES = ['imported', 'skipped', 'failed'] as const;
export type ImportItemStatus = (typeof IMPORT_ITEM_STATUSES)[number];

export interface MaterialImportItem {
  id: string;
  batch_id: string;
  material_id: string | null;
  topic_id: string | null;
  /** Ruta original dentro del ZIP (p. ej. `Tema 1/01 Intro.pdf`). */
  original_path: string;
  original_filename: string;
  status: ImportItemStatus;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}
