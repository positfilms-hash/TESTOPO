// Operaciones minimas del registro de material (SPEC 002, seccion 9).
//
// El servicio coordina repositorio y validacion; las reglas viven en
// `validation/validateMaterial`. El reloj y el generador de ids son
// inyectables para facilitar los tests.
//
// Esta capa NO escribe archivos en disco. Cuando se registre un archivo,
// `storage_path` debe apuntar a una carpeta ignorada por Git (p. ej. /uploads
// o /private-materials); el material real privado nunca se guarda en el repo.

import { randomUUID } from 'node:crypto';
import type { MaterialStatus, MaterialType } from '../models/enums.js';
import type { Material } from '../models/material.js';
import type {
  MaterialFilter,
  MaterialRepository,
} from '../repository/materialRepository.js';
import {
  isTextFile,
  validateFileUpload,
  validateMaterialMetadata,
  type FileValidationOptions,
} from '../validation/validateMaterial.js';
import { MaterialValidationError } from './materialValidationError.js';

export interface CreateMaterialInput {
  title?: string;
  description?: string | null;
  type?: MaterialType;
  status?: MaterialStatus;
  content_text?: string | null;
  reference?: string | null;
}

export interface RegisterFileInput extends CreateMaterialInput {
  file: {
    original_filename: string;
    mime_type?: string | null;
    size_bytes: number;
    storage_path?: string | null;
    content_text?: string | null;
  };
}

export interface EditMaterialInput {
  title?: string;
  description?: string | null;
  type?: MaterialType;
  status?: MaterialStatus;
  content_text?: string | null;
  reference?: string | null;
}

export interface MaterialServiceOptions {
  generateId?: () => string;
  now?: () => Date;
  maxFileSizeBytes?: number;
}

export class MaterialService {
  private readonly generateId: () => string;
  private readonly now: () => Date;
  private readonly fileOptions: FileValidationOptions;

  constructor(
    private readonly repository: MaterialRepository,
    options: MaterialServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
    this.fileOptions = { maxSizeBytes: options.maxFileSizeBytes };
  }

  // 9.1 Crear material manual. `status` por defecto es `active`.
  createMaterial(input: CreateMaterialInput): Material {
    const status = input.status ?? 'active';
    this.assertValidMetadata({
      title: input.title,
      type: input.type,
      status,
    });

    const timestamp = this.now();
    const material: Material = {
      id: this.generateId(),
      title: input.title as string,
      description: input.description ?? null,
      type: input.type as MaterialType,
      status,
      original_filename: null,
      mime_type: null,
      size_bytes: null,
      storage_path: null,
      content_text: input.content_text ?? null,
      reference: input.reference ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    return this.repository.create(material);
  }

  // 9.2 Registrar un archivo como material. No mueve el archivo: solo guarda
  // sus metadatos y la ruta de almacenamiento (que debe estar fuera del repo).
  // Para .txt/.md puede guardarse el texto; .pdf/.docx quedan sin extraer.
  registerFileMaterial(input: RegisterFileInput): Material {
    const status = input.status ?? 'active';
    this.assertValidMetadata({
      title: input.title,
      type: input.type,
      status,
    });

    const fileResult = validateFileUpload(
      {
        original_filename: input.file.original_filename,
        size_bytes: input.file.size_bytes,
      },
      this.fileOptions,
    );
    if (!fileResult.valid) {
      throw new MaterialValidationError(fileResult.errors);
    }

    const contentText = isTextFile(input.file.original_filename)
      ? (input.file.content_text ?? input.content_text ?? null)
      : null;

    const timestamp = this.now();
    const material: Material = {
      id: this.generateId(),
      title: input.title as string,
      description: input.description ?? null,
      type: input.type as MaterialType,
      status,
      original_filename: input.file.original_filename,
      mime_type: input.file.mime_type ?? null,
      size_bytes: input.file.size_bytes,
      storage_path: input.file.storage_path ?? null,
      content_text: contentText,
      reference: input.reference ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    return this.repository.create(material);
  }

  // 9.3 Listar materiales, con filtros opcionales por tipo y estado.
  listMaterials(filter: MaterialFilter = {}): Material[] {
    return this.repository.findAll(filter);
  }

  // 9.4 Ver material por id.
  getMaterial(id: string): Material | null {
    return this.repository.findById(id);
  }

  // 9.5 Editar material. Actualiza siempre `updated_at`. Pasar `null` en un
  // campo opcional lo limpia; omitirlo lo deja intacto.
  editMaterial(id: string, changes: EditMaterialInput): Material {
    const existing = this.requireMaterial(id);

    const nextTitle = changes.title ?? existing.title;
    const nextType = changes.type ?? existing.type;
    const nextStatus = changes.status ?? existing.status;
    this.assertValidMetadata({
      title: nextTitle,
      type: nextType,
      status: nextStatus,
    });

    const updated: Material = {
      ...existing,
      title: nextTitle,
      type: nextType,
      status: nextStatus,
      description:
        changes.description !== undefined
          ? changes.description
          : existing.description,
      content_text:
        changes.content_text !== undefined
          ? changes.content_text
          : existing.content_text,
      reference:
        changes.reference !== undefined
          ? changes.reference
          : existing.reference,
      updated_at: this.now(),
    };
    return this.repository.save(updated);
  }

  // 9.6 Cambiar estado del material.
  changeStatus(id: string, status: MaterialStatus): Material {
    const existing = this.requireMaterial(id);
    this.assertValidMetadata({
      title: existing.title,
      type: existing.type,
      status,
    });

    const updated: Material = {
      ...existing,
      status,
      updated_at: this.now(),
    };
    return this.repository.save(updated);
  }

  // 9.7 Marcar como obsoleto (atajo de changeStatus). No se borra fisicamente.
  markObsolete(id: string): Material {
    return this.changeStatus(id, 'obsolete');
  }

  private requireMaterial(id: string): Material {
    const material = this.repository.findById(id);
    if (!material) {
      throw new Error(`Material not found: ${id}`);
    }
    return material;
  }

  private assertValidMetadata(metadata: {
    title: unknown;
    type: unknown;
    status: unknown;
  }): void {
    const result = validateMaterialMetadata(metadata);
    if (!result.valid) {
      throw new MaterialValidationError(result.errors);
    }
  }
}
