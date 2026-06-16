// Codigos de error de validacion de material (SPEC 002, seccion 11).
// Los valores de cadena son contractuales y deben coincidir con la spec.

export enum MaterialValidationErrorCode {
  TITLE_REQUIRED = 'MATERIAL_TITLE_REQUIRED',
  TYPE_REQUIRED = 'MATERIAL_TYPE_REQUIRED',
  INVALID_TYPE = 'MATERIAL_INVALID_TYPE',
  STATUS_REQUIRED = 'MATERIAL_STATUS_REQUIRED',
  INVALID_STATUS = 'MATERIAL_INVALID_STATUS',
  FILE_TYPE_NOT_ALLOWED = 'MATERIAL_FILE_TYPE_NOT_ALLOWED',
  FILE_TOO_LARGE = 'MATERIAL_FILE_TOO_LARGE',
}
