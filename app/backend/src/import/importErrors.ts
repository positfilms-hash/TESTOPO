// Codigos de error de importacion de material (SPEC 017, 24). El acceso
// denegado se gestiona con AccessError desde el facade de plataforma.

export enum ImportErrorCode {
  OPPOSITION_REQUIRED = 'IMPORT_OPPOSITION_REQUIRED',
  OPPOSITION_NOT_FOUND = 'IMPORT_OPPOSITION_NOT_FOUND',
  TOPIC_NOT_FOUND = 'IMPORT_TOPIC_NOT_FOUND',
  TOPIC_OPPOSITION_MISMATCH = 'IMPORT_TOPIC_OPPOSITION_MISMATCH',
  FILE_REQUIRED = 'IMPORT_FILE_REQUIRED',
  INVALID_FILE_TYPE = 'IMPORT_INVALID_FILE_TYPE',
  ZIP_REQUIRED = 'IMPORT_ZIP_REQUIRED',
  ZIP_TOO_LARGE = 'IMPORT_ZIP_TOO_LARGE',
  ZIP_EMPTY = 'IMPORT_ZIP_EMPTY',
  ZIP_TOO_MANY_FILES = 'IMPORT_ZIP_TOO_MANY_FILES',
  ZIP_UNSAFE_PATH = 'IMPORT_ZIP_UNSAFE_PATH',
  ZIP_NESTED_NOT_ALLOWED = 'IMPORT_ZIP_NESTED_NOT_ALLOWED',
  ZIP_INVALID = 'IMPORT_ZIP_INVALID',
  FILE_TOO_LARGE = 'IMPORT_FILE_TOO_LARGE',
  FILE_EXTENSION_NOT_ALLOWED = 'IMPORT_FILE_EXTENSION_NOT_ALLOWED',
  STORAGE_FAILED = 'IMPORT_STORAGE_FAILED',
  EXTRACTION_FAILED = 'IMPORT_EXTRACTION_FAILED',
  DUPLICATE_SKIPPED = 'IMPORT_DUPLICATE_SKIPPED',
}

// Limites de importacion (SPEC 017, 17; actualizado por SPEC 028, 27).
export const MAX_ZIP_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_ZIP_FILES = 500; // SPEC 028: maximo de archivos por lote.
export const MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB por archivo

// Extensiones permitidas en esta spec (DOCX queda fuera por ahora).
export const ALLOWED_IMPORT_EXTENSIONS = ['pdf', 'txt', 'md'] as const;
export type AllowedImportExtension = (typeof ALLOWED_IMPORT_EXTENSIONS)[number];

export class ImportError extends Error {
  readonly codes: ImportErrorCode[];

  constructor(codes: ImportErrorCode[]) {
    super(`Material import failed: ${codes.join(', ')}`);
    this.name = 'ImportError';
    this.codes = codes;
  }
}
