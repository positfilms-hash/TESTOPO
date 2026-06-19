// Codigos de error de secciones y referencias de fuente (SPEC 028-C, 32). El
// acceso denegado lo gestiona normalmente AccessError desde el facade.

export enum MaterialSectionErrorCode {
  ACCESS_DENIED = 'MATERIAL_SECTION_ACCESS_DENIED',
  MATERIAL_REQUIRED = 'MATERIAL_SECTION_MATERIAL_REQUIRED',
  MATERIAL_NOT_FOUND = 'MATERIAL_SECTION_MATERIAL_NOT_FOUND',
  TEXT_REQUIRED = 'MATERIAL_SECTION_TEXT_REQUIRED',
  NOT_ANALYZABLE = 'MATERIAL_SECTION_NOT_ANALYZABLE',
  CLASSIFICATION_NOT_ALLOWED = 'MATERIAL_SECTION_CLASSIFICATION_NOT_ALLOWED',
  CREATE_FAILED = 'MATERIAL_SECTION_CREATE_FAILED',
  REPROCESS_FAILED = 'MATERIAL_SECTION_REPROCESS_FAILED',
  SEARCH_FAILED = 'MATERIAL_SECTION_SEARCH_FAILED',
  SECTION_NOT_FOUND = 'MATERIAL_SECTION_NOT_FOUND',
}

export class MaterialSectionError extends Error {
  readonly codes: MaterialSectionErrorCode[];

  constructor(codes: MaterialSectionErrorCode[], detail?: string) {
    super(
      `Material section error: ${codes.join(', ')}${detail ? ` (${detail})` : ''}`,
    );
    this.name = 'MaterialSectionError';
    this.codes = codes;
  }
}

export enum SourceReferenceErrorCode {
  NOT_FOUND = 'SOURCE_REFERENCE_NOT_FOUND',
  CREATE_FAILED = 'SOURCE_REFERENCE_CREATE_FAILED',
  ACCESS_DENIED = 'SOURCE_REFERENCE_ACCESS_DENIED',
  SECTION_REQUIRED = 'SOURCE_REFERENCE_SECTION_REQUIRED',
  MATERIAL_REQUIRED = 'SOURCE_REFERENCE_MATERIAL_REQUIRED',
}

export class SourceReferenceError extends Error {
  readonly codes: SourceReferenceErrorCode[];

  constructor(codes: SourceReferenceErrorCode[], detail?: string) {
    super(
      `Source reference error: ${codes.join(', ')}${detail ? ` (${detail})` : ''}`,
    );
    this.name = 'SourceReferenceError';
    this.codes = codes;
  }
}
