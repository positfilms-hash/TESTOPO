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

// Estado de extraccion de texto de un archivo (SPEC 012 + 030 OCR).
export const EXTRACTION_STATUSES = [
  'not_started',
  'processing',
  'completed', // texto nativo (PDF.js)
  'failed',
  'not_supported',
  // SPEC 030: camino OCR para escaneados.
  'scanned_detected', // sin texto nativo util, probable escaneo (pendiente OCR)
  'ocr_processing',
  'completed_ocr',
  'completed_ocr_with_warnings',
  'ocr_failed',
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

// Como se obtuvo el texto (SPEC 030). null cuando aun no hay texto.
export const EXTRACTION_METHODS = ['text', 'ocr', 'mixed'] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

// Estados de extraccion cuyo `content_text` es UTILIZABLE para analisis (SPEC 032):
// texto nativo (`completed`) y texto recuperado por OCR (`completed_ocr` y
// `completed_ocr_with_warnings`). El de advertencias es utilizable pero debe
// arrastrar un aviso a la revision. Quedan fuera: not_started/processing/
// scanned_detected/ocr_processing (aun sin texto) y failed/not_supported/ocr_failed.
export const USABLE_EXTRACTION_STATUSES = [
  'completed',
  'completed_ocr',
  'completed_ocr_with_warnings',
] as const;

export function isUsableExtraction(
  status: ExtractionStatus | null | undefined,
): boolean {
  return (
    status != null &&
    (USABLE_EXTRACTION_STATUSES as readonly string[]).includes(status)
  );
}

// El texto se recupero por OCR con paginas de baja calidad: utilizable, pero la
// revision debe avisarlo (SPEC 030/032).
export function extractionHasOcrWarnings(
  status: ExtractionStatus | null | undefined,
): boolean {
  return status === 'completed_ocr_with_warnings';
}

export interface Material {
  id: string;
  /** Oposicion a la que pertenece el material (SPEC 010). Obligatorio. */
  opposition_id: string;
  /**
   * Workspace de la oposicion (SPEC 022). Aditivo/nullable en el modelo: la tabla
   * `materials` lo tiene y la generacion/estudio en servidor FILTRAN por el (RLS y
   * aislamiento). Se resuelve desde `opposition.workspace_id` al crear el material.
   */
  workspace_id?: string | null;
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
  // --- Metadata operativa de OCR (SPEC 030). Aditiva/nullable. No implica que el
  // material este clasificado. ---
  extraction_method?: ExtractionMethod | null;
  ocr_status?: string | null;
  ocr_confidence?: number | null;
  ocr_page_count?: number | null;
  ocr_processed_pages?: number | null;
  ocr_failed_pages?: number | null;
  ocr_warning_count?: number | null;
  // --- Estado de estudio interno (SPEC 038). Aditivo/nullable. `studied` solo tras
  // un run de estudio con unidades usables; OCR con avisos -> studied_with_warnings. ---
  study_status?:
    | 'not_studied'
    | 'studying'
    | 'studied'
    | 'studied_with_warnings'
    | 'study_failed'
    | null;
  /** Usuario que subio el archivo. */
  uploaded_by?: string | null;
  created_at: Date;
  updated_at: Date;
}
