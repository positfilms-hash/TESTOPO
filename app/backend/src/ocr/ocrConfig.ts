// Limites y bandas de confianza del OCR (SPEC 030). Documentados y deterministas.
// Sobreescribibles por entorno donde aplique (proveedor real).

export interface OcrConfig {
  /** Maximo de paginas a procesar por documento. */
  max_pages: number;
  /** Tamano maximo de imagen renderizada por pagina (bytes). */
  max_image_bytes: number;
  /** Paginas procesadas en paralelo como mucho. */
  max_concurrent_pages: number;
  /** Timeout por pagina (ms). */
  per_page_timeout_ms: number;
  /** Confianza >= usable. */
  usable_threshold: number;
  /** Confianza >= warning (revisable); por debajo, fallo. */
  warning_threshold: number;
}

export const DEFAULT_OCR_CONFIG: OcrConfig = {
  max_pages: 300,
  max_image_bytes: 10 * 1024 * 1024, // 10 MB
  max_concurrent_pages: 3,
  per_page_timeout_ms: 30000,
  usable_threshold: 0.7, // >= 0.70 -> usable (completed)
  warning_threshold: 0.4, // 0.40-0.69 -> warning; < 0.40 -> failed
};

// Banda de confianza de una pagina -> estado.
export function confidenceBand(
  confidence: number | null,
  config: OcrConfig = DEFAULT_OCR_CONFIG,
): 'completed' | 'warning' | 'failed' {
  if (confidence == null || confidence < config.warning_threshold) {
    return 'failed';
  }
  if (confidence < config.usable_threshold) {
    return 'warning';
  }
  return 'completed';
}
