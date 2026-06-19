// Codigos de error de la clasificacion documental (SPEC 028-B, 23). El acceso
// denegado se gestiona normalmente con AccessError desde el facade; el codigo
// DOCUMENT_CLASSIFICATION_ACCESS_DENIED queda disponible para mapearlo.

export enum DocumentClassificationErrorCode {
  ACCESS_DENIED = 'DOCUMENT_CLASSIFICATION_ACCESS_DENIED',
  MATERIAL_REQUIRED = 'DOCUMENT_CLASSIFICATION_MATERIAL_REQUIRED',
  MATERIAL_NOT_FOUND = 'DOCUMENT_CLASSIFICATION_MATERIAL_NOT_FOUND',
  TEXT_REQUIRED = 'DOCUMENT_CLASSIFICATION_TEXT_REQUIRED',
  PROVIDER_NOT_CONFIGURED = 'DOCUMENT_CLASSIFICATION_PROVIDER_NOT_CONFIGURED',
  FAILED = 'DOCUMENT_CLASSIFICATION_FAILED',
  INVALID_OUTPUT = 'DOCUMENT_CLASSIFICATION_INVALID_OUTPUT',
  LOW_CONFIDENCE = 'DOCUMENT_CLASSIFICATION_LOW_CONFIDENCE',
  NOT_ANALYZABLE = 'DOCUMENT_CLASSIFICATION_NOT_ANALYZABLE',
  UPDATE_FAILED = 'DOCUMENT_CLASSIFICATION_UPDATE_FAILED',
  RUN_NOT_FOUND = 'DOCUMENT_UNDERSTANDING_RUN_NOT_FOUND',
  BATCH_NOT_FOUND = 'DOCUMENT_CLASSIFICATION_BATCH_NOT_FOUND',
  CLASSIFICATION_NOT_FOUND = 'DOCUMENT_CLASSIFICATION_NOT_FOUND',
  INVALID_CLASSIFICATION = 'DOCUMENT_CLASSIFICATION_INVALID_CLASSIFICATION',
}

export class DocumentClassificationError extends Error {
  readonly codes: DocumentClassificationErrorCode[];

  constructor(codes: DocumentClassificationErrorCode[], detail?: string) {
    super(
      `Document classification failed: ${codes.join(', ')}${
        detail ? ` (${detail})` : ''
      }`,
    );
    this.name = 'DocumentClassificationError';
    this.codes = codes;
  }
}
