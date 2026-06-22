// Modelos de OCR/vision para PDFs escaneados (SPEC 030).
//
// Datos internos de GESTION: el alumno nunca los ve. No clasifican el documento
// ni generan contenido; solo registran como se leyo un escaneo (run + paginas)
// y con que calidad, para que el texto utilizable se agregue al material.

export const OCR_RUN_STATUSES = [
  'pending',
  'processing',
  'completed',
  'completed_with_warnings',
  'failed',
] as const;
export type OcrRunStatus = (typeof OCR_RUN_STATUSES)[number];

export interface MaterialOcrRun {
  id: string;
  workspace_id: string | null;
  opposition_id: string;
  material_id: string;
  created_by: string | null;
  provider: string;
  model: string | null;
  status: OcrRunStatus;
  page_count: number;
  processed_pages: number;
  failed_pages: number;
  /** Confianza media de las paginas con texto (0..1); null si ninguna. */
  average_confidence: number | null;
  warnings: string[];
  errors: string[];
  created_at: Date;
  updated_at: Date;
}

export const OCR_PAGE_STATUSES = [
  'completed', // confianza alta (>= 0.70)
  'warning', // confianza media (0.40-0.69): revisable
  'failed', // confianza baja (< 0.40) o sin texto
] as const;
export type OcrPageStatus = (typeof OCR_PAGE_STATUSES)[number];

export interface MaterialOcrPage {
  id: string;
  workspace_id: string | null;
  opposition_id: string;
  material_id: string;
  ocr_run_id: string;
  page_number: number;
  /** Referencia PRIVADA temporal de la imagen renderizada (si se conserva). */
  image_ref: string | null;
  text: string;
  confidence: number | null;
  status: OcrPageStatus;
  warnings: string[];
  errors: string[];
  created_at: Date;
  updated_at: Date;
}
