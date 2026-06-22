// Deteccion de PDFs escaneados (SPEC 030). Deterministico: evalua el resultado
// de la extraccion nativa (`PdfJsTextExtractor`) con el gate de calidad existente
// y decide si es un probable ESCANEO (candidato a OCR). NO dispara OCR si el
// texto nativo pasa el gate.

import { assessTextQuality } from '../pdf/pdfQuality.js';
import type { PdfExtractionResult } from '../pdf/pdfTextExtractor.js';

export interface ScanDetectionResult {
  likely_scan: boolean;
  reason: string;
}

export class PdfScanDetectionService {
  evaluate(result: PdfExtractionResult): ScanDetectionResult {
    const pages = result.page_count ?? 0;
    if (result.status === 'completed') {
      // Hay texto nativo: solo es escaneo si la calidad es pobre.
      const quality = assessTextQuality(result.text);
      if (!quality.ok && pages > 0) {
        return {
          likely_scan: true,
          reason: `Texto nativo insuficiente (${quality.reason ?? 'baja calidad'}).`,
        };
      }
      return { likely_scan: false, reason: 'Texto nativo suficiente.' };
    }
    if (result.status === 'not_supported' && pages > 0) {
      return {
        likely_scan: true,
        reason: 'El PDF no tiene capa de texto (probable escaneo).',
      };
    }
    // failed (dañado) o sin paginas: OCR no ayuda.
    return {
      likely_scan: false,
      reason: 'Archivo no analizable por OCR (dañado o sin páginas).',
    };
  }
}
