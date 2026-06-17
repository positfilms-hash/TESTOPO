// Codigos de error de subida y extraccion de PDF (SPEC 012, 14). Los permisos
// (acceso denegado) se gestionan con AccessError del facade de plataforma.

export enum PdfErrorCode {
  OPPOSITION_REQUIRED = 'PDF_OPPOSITION_REQUIRED',
  OPPOSITION_NOT_FOUND = 'PDF_OPPOSITION_NOT_FOUND',
  TITLE_REQUIRED = 'PDF_TITLE_REQUIRED',
  TYPE_REQUIRED = 'PDF_TYPE_REQUIRED',
  INVALID_MATERIAL_TYPE = 'PDF_INVALID_MATERIAL_TYPE',
  FILE_REQUIRED = 'PDF_FILE_REQUIRED',
  INVALID_FILE_TYPE = 'PDF_INVALID_FILE_TYPE',
  INVALID_MIME_TYPE = 'PDF_INVALID_MIME_TYPE',
  FILE_TOO_LARGE = 'PDF_FILE_TOO_LARGE',
  FILE_EMPTY = 'PDF_FILE_EMPTY',
  TOPIC_NOT_FOUND = 'PDF_TOPIC_NOT_FOUND',
  TOPIC_OPPOSITION_MISMATCH = 'PDF_TOPIC_OPPOSITION_MISMATCH',
  STORAGE_FAILED = 'PDF_STORAGE_FAILED',
  EXTRACTION_FAILED = 'PDF_EXTRACTION_FAILED',
  TEXT_NOT_EXTRACTABLE = 'PDF_TEXT_NOT_EXTRACTABLE',
}

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB (SPEC 012, 9.5)

export class PdfUploadError extends Error {
  readonly codes: PdfErrorCode[];

  constructor(codes: PdfErrorCode[]) {
    super(`PDF upload failed: ${codes.join(', ')}`);
    this.name = 'PdfUploadError';
    this.codes = codes;
  }
}
