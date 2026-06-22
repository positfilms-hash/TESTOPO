// Errores del flujo OCR (SPEC 030). Mensajes claros; el facade traduce el acceso.

export enum OcrErrorCode {
  ACCESS_DENIED = 'OCR_ACCESS_DENIED',
  MATERIAL_NOT_FOUND = 'OCR_MATERIAL_NOT_FOUND',
  MATERIAL_NOT_PDF = 'OCR_MATERIAL_NOT_PDF',
  SCAN_NOT_DETECTED = 'OCR_SCAN_NOT_DETECTED',
  RENDER_FAILED = 'OCR_RENDER_FAILED',
  PAGE_LIMIT_EXCEEDED = 'OCR_PAGE_LIMIT_EXCEEDED',
  PROVIDER_NOT_CONFIGURED = 'OCR_PROVIDER_NOT_CONFIGURED',
  PAGE_FAILED = 'OCR_PAGE_FAILED',
  NO_TEXT_EXTRACTED = 'OCR_NO_TEXT_EXTRACTED',
  RETRY_FAILED = 'OCR_RETRY_FAILED',
}

export class OcrError extends Error {
  constructor(
    public readonly code: OcrErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OcrError';
  }
}
