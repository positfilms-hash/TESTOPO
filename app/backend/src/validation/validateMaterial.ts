// Validacion de las reglas obligatorias del material (SPEC 002, secciones 8 y
// 11). Logica pura, sin dependencias de transporte ni de persistencia, para
// poder reutilizarse desde cualquier capa superior.

import {
  isMaterialStatus,
  isMaterialType,
  type MaterialStatus,
  type MaterialType,
} from '../models/enums.js';
import { MaterialValidationErrorCode } from './materialErrors.js';

export interface MaterialValidationResult {
  valid: boolean;
  errors: MaterialValidationErrorCode[];
}

// Formatos aceptados en el MVP (SPEC 002, 8.5).
export const ALLOWED_FILE_EXTENSIONS = [
  '.txt',
  '.md',
  '.pdf',
  '.docx',
] as const;

// Extensiones cuyo contenido de texto puede guardarse directamente.
export const TEXT_FILE_EXTENSIONS = ['.txt', '.md'] as const;

// Limite de tamano por defecto (20 MB). Configurable al validar.
export const DEFAULT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export interface MaterialMetadata {
  title: unknown;
  type: unknown;
  status: unknown;
}

// Valida los metadatos minimos obligatorios: title, type y status.
export function validateMaterialMetadata(
  material: MaterialMetadata,
): MaterialValidationResult {
  const errors: MaterialValidationErrorCode[] = [];

  if (!isNonEmptyString(material.title)) {
    errors.push(MaterialValidationErrorCode.TITLE_REQUIRED);
  }

  if (material.type === null || material.type === undefined) {
    errors.push(MaterialValidationErrorCode.TYPE_REQUIRED);
  } else if (!isMaterialType(material.type)) {
    errors.push(MaterialValidationErrorCode.INVALID_TYPE);
  }

  if (material.status === null || material.status === undefined) {
    errors.push(MaterialValidationErrorCode.STATUS_REQUIRED);
  } else if (!isMaterialStatus(material.status)) {
    errors.push(MaterialValidationErrorCode.INVALID_STATUS);
  }

  return { valid: errors.length === 0, errors };
}

export interface FileUpload {
  original_filename: string;
  size_bytes: number;
}

export interface FileValidationOptions {
  maxSizeBytes?: number;
}

// Valida un archivo que se intenta registrar: extension permitida y tamano.
export function validateFileUpload(
  file: FileUpload,
  options: FileValidationOptions = {},
): MaterialValidationResult {
  const errors: MaterialValidationErrorCode[] = [];
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;

  if (!isAllowedFile(file.original_filename)) {
    errors.push(MaterialValidationErrorCode.FILE_TYPE_NOT_ALLOWED);
  }

  if (file.size_bytes > maxSizeBytes) {
    errors.push(MaterialValidationErrorCode.FILE_TOO_LARGE);
  }

  return { valid: errors.length === 0, errors };
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot < 0) {
    return '';
  }
  return filename.slice(lastDot).toLowerCase();
}

export function isAllowedFile(filename: string): boolean {
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(
    getFileExtension(filename),
  );
}

// Indica si el contenido de texto del archivo puede leerse directamente
// (.txt / .md). Para .pdf / .docx queda pendiente de extraccion (sin OCR).
export function isTextFile(filename: string): boolean {
  return (TEXT_FILE_EXTENSIONS as readonly string[]).includes(
    getFileExtension(filename),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export type { MaterialStatus, MaterialType };
