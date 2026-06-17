// Modelo de material/documento de estudio (SPEC 002, seccion 6).
//
// El material es la base trazable de las fuentes de preguntas: una pregunta
// validada debe poder vincularse, via `Source.material_id`, a un material
// activo y revisable.
//
// Los campos de archivo (original_filename, mime_type, size_bytes,
// storage_path) quedan vacios cuando el material se crea manualmente pegando
// texto. El contenido real privado del usuario NO se guarda en el repositorio:
// `storage_path` apunta a una carpeta ignorada por Git.

import type { MaterialStatus, MaterialType } from './enums.js';

// Estado de extraccion de texto de un archivo (SPEC 012). Sin OCR.
export const EXTRACTION_STATUSES = [
  'not_started',
  'processing',
  'completed',
  'failed',
  'not_supported',
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export interface Material {
  id: string;
  /** Oposicion a la que pertenece el material (SPEC 010). Obligatorio. */
  opposition_id: string;
  title: string;
  description: string | null;
  type: MaterialType;
  status: MaterialStatus;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  content_text: string | null;
  reference: string | null;
  // --- Campos de archivo/extraccion (SPEC 012). Opcionales/aditivos. ---
  /** Extension del archivo (p. ej. `pdf`). */
  file_extension?: string | null;
  extraction_status?: ExtractionStatus;
  extraction_error?: string | null;
  page_count?: number | null;
  /** Usuario que subio el archivo. */
  uploaded_by?: string | null;
  created_at: Date;
  updated_at: Date;
}
