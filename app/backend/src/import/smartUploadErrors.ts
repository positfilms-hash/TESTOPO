// Codigos de error de la carga masiva inteligente (SPEC 028, 33). El acceso
// denegado lo gestiona normalmente `AccessError` desde el facade de plataforma;
// `SMART_UPLOAD_ACCESS_DENIED` queda disponible para mapear ese caso a un codigo
// estable de cara a la UI.
//
// La capa de importacion reutilizada (SPEC 017) sigue lanzando `ImportError` con
// sus `ImportErrorCode`. `fromImportError` traduce esos codigos a los
// `SMART_UPLOAD_*` para que el servicio de carga masiva exponga un unico
// vocabulario de errores.

import { ImportErrorCode } from './importErrors.js';

export enum SmartUploadErrorCode {
  ACCESS_DENIED = 'SMART_UPLOAD_ACCESS_DENIED',
  OPPOSITION_REQUIRED = 'SMART_UPLOAD_OPPOSITION_REQUIRED',
  FILE_REQUIRED = 'SMART_UPLOAD_FILE_REQUIRED',
  INVALID_CATEGORY = 'SMART_UPLOAD_INVALID_CATEGORY',
  INVALID_FILE_TYPE = 'SMART_UPLOAD_INVALID_FILE_TYPE',
  ZIP_TOO_LARGE = 'SMART_UPLOAD_ZIP_TOO_LARGE',
  TOO_MANY_FILES = 'SMART_UPLOAD_TOO_MANY_FILES',
  UNSAFE_PATH = 'SMART_UPLOAD_UNSAFE_PATH',
  NESTED_ZIP_NOT_ALLOWED = 'SMART_UPLOAD_NESTED_ZIP_NOT_ALLOWED',
  STORAGE_FAILED = 'SMART_UPLOAD_STORAGE_FAILED',
  EXTRACTION_FAILED = 'SMART_UPLOAD_EXTRACTION_FAILED',
  AI_INDEX_FAILED = 'SMART_UPLOAD_AI_INDEX_FAILED',
  OLD_TEST_ANALYSIS_FAILED = 'SMART_UPLOAD_OLD_TEST_ANALYSIS_FAILED',
  NO_ANALYZABLE_TEXT = 'SMART_UPLOAD_NO_ANALYZABLE_TEXT',
  FOLDER_NOT_SUPPORTED = 'SMART_UPLOAD_FOLDER_NOT_SUPPORTED',
}

export class SmartUploadError extends Error {
  readonly codes: SmartUploadErrorCode[];

  constructor(codes: SmartUploadErrorCode[], detail?: string) {
    super(
      `Smart upload failed: ${codes.join(', ')}${detail ? ` (${detail})` : ''}`,
    );
    this.name = 'SmartUploadError';
    this.codes = codes;
  }
}

// Traduce un codigo de la importacion clasica (SPEC 017) al vocabulario
// SMART_UPLOAD_* (SPEC 028). Los codigos que no tienen equivalente directo se
// mapean al mas cercano para no perder informacion en la UI.
export function fromImportError(code: ImportErrorCode): SmartUploadErrorCode {
  switch (code) {
    case ImportErrorCode.OPPOSITION_REQUIRED:
    case ImportErrorCode.OPPOSITION_NOT_FOUND:
      return SmartUploadErrorCode.OPPOSITION_REQUIRED;
    case ImportErrorCode.FILE_REQUIRED:
    case ImportErrorCode.ZIP_REQUIRED:
    case ImportErrorCode.ZIP_EMPTY:
      return SmartUploadErrorCode.FILE_REQUIRED;
    case ImportErrorCode.INVALID_FILE_TYPE:
    case ImportErrorCode.FILE_EXTENSION_NOT_ALLOWED:
    case ImportErrorCode.ZIP_INVALID:
      return SmartUploadErrorCode.INVALID_FILE_TYPE;
    case ImportErrorCode.ZIP_TOO_LARGE:
    case ImportErrorCode.FILE_TOO_LARGE:
      return SmartUploadErrorCode.ZIP_TOO_LARGE;
    case ImportErrorCode.ZIP_TOO_MANY_FILES:
      return SmartUploadErrorCode.TOO_MANY_FILES;
    case ImportErrorCode.ZIP_UNSAFE_PATH:
      return SmartUploadErrorCode.UNSAFE_PATH;
    case ImportErrorCode.ZIP_NESTED_NOT_ALLOWED:
      return SmartUploadErrorCode.NESTED_ZIP_NOT_ALLOWED;
    case ImportErrorCode.STORAGE_FAILED:
      return SmartUploadErrorCode.STORAGE_FAILED;
    case ImportErrorCode.EXTRACTION_FAILED:
      return SmartUploadErrorCode.EXTRACTION_FAILED;
    default:
      return SmartUploadErrorCode.INVALID_FILE_TYPE;
  }
}
