// Subida de PDF y extraccion basica de texto (SPEC 012).
//
// Reutiliza el modelo `Material` (no crea un modelo paralelo de PDF) y la
// relacion `TopicMaterialLink` con temas. El control de acceso NO vive aqui:
// lo aplica `PlatformService` (owner/admin del workspace de la oposicion).
// Este servicio valida contenido/archivo, guarda los bytes via `FileStorage`
// (capa separada, fuera del repo) y extrae texto con un `PdfTextExtractor`
// inyectable. No implementa OCR ni analisis semantico.

import { randomUUID } from 'node:crypto';
import { isMaterialType, type MaterialType } from '../models/enums.js';
import type { Material } from '../models/material.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicRepository } from '../repository/topicRepository.js';
import type { OppositionRepository } from '../repository/oppositionRepository.js';
import type { TopicMaterialLinkRepository } from '../repository/topicMaterialLinkRepository.js';
import type { FileStorage } from '../storage/fileStorage.js';
import type { PdfTextExtractor } from '../pdf/pdfTextExtractor.js';
import {
  MAX_PDF_SIZE_BYTES,
  PdfErrorCode,
  PdfUploadError,
} from '../pdf/pdfErrors.js';

export interface PdfUploadFile {
  original_filename: string;
  mime_type?: string | null;
  bytes: Uint8Array;
}

export interface UploadPdfInput {
  opposition_id?: string;
  title?: string;
  description?: string | null;
  type?: MaterialType;
  reference?: string | null;
  /** Temas a vincular (opcional). Todos deben ser de la misma oposicion. */
  topic_ids?: string[];
  file?: PdfUploadFile;
  /** Usuario que sube el archivo (lo aporta el facade). */
  uploaded_by?: string | null;
}

export interface PdfMaterialServiceDeps {
  materials: MaterialRepository;
  topics: TopicRepository;
  topicMaterialLinks: TopicMaterialLinkRepository;
  oppositions: OppositionRepository;
  storage: FileStorage;
  extractor: PdfTextExtractor;
  generateId?: () => string;
  now?: () => Date;
}

export class PdfMaterialService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(private readonly deps: PdfMaterialServiceDeps) {
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  async uploadPdf(input: UploadPdfInput): Promise<Material> {
    const codes: PdfErrorCode[] = [];

    // --- Oposicion (obligatoria, debe existir) ---
    const oppositionId = input.opposition_id;
    if (!isNonEmptyString(oppositionId)) {
      codes.push(PdfErrorCode.OPPOSITION_REQUIRED);
    } else if (!(await this.deps.oppositions.findById(oppositionId))) {
      codes.push(PdfErrorCode.OPPOSITION_NOT_FOUND);
    }

    // --- Metadata ---
    if (!isNonEmptyString(input.title)) {
      codes.push(PdfErrorCode.TITLE_REQUIRED);
    }
    if (input.type === undefined || input.type === null) {
      codes.push(PdfErrorCode.TYPE_REQUIRED);
    } else if (!isMaterialType(input.type)) {
      codes.push(PdfErrorCode.INVALID_MATERIAL_TYPE);
    }

    // --- Archivo ---
    const file = input.file;
    if (!file || !isNonEmptyString(file.original_filename) || !file.bytes) {
      codes.push(PdfErrorCode.FILE_REQUIRED);
    } else {
      if (!hasPdfExtension(file.original_filename)) {
        codes.push(PdfErrorCode.INVALID_FILE_TYPE);
      }
      if (
        isNonEmptyString(file.mime_type) &&
        file.mime_type.toLowerCase() !== 'application/pdf'
      ) {
        codes.push(PdfErrorCode.INVALID_MIME_TYPE);
      }
      if (file.bytes.length === 0) {
        codes.push(PdfErrorCode.FILE_EMPTY);
      } else if (file.bytes.length > MAX_PDF_SIZE_BYTES) {
        codes.push(PdfErrorCode.FILE_TOO_LARGE);
      }
    }

    // --- Temas (opcionales): existir y ser de la misma oposicion ---
    const topicIds = dedupe(input.topic_ids ?? []);
    if (isNonEmptyString(oppositionId)) {
      for (const topicId of topicIds) {
        const topic = await this.deps.topics.findById(topicId);
        if (!topic) {
          codes.push(PdfErrorCode.TOPIC_NOT_FOUND);
        } else if (topic.opposition_id !== oppositionId) {
          codes.push(PdfErrorCode.TOPIC_OPPOSITION_MISMATCH);
        }
      }
    }

    if (codes.length > 0) {
      throw new PdfUploadError(dedupe(codes));
    }

    // A partir de aqui, file y oppositionId son validos.
    const validFile = file as PdfUploadFile;
    const validOppositionId = oppositionId as string;

    // --- Guardado fisico (capa separada, fuera del repo) ---
    const storagePath = `uploads/materials/${this.generateId()}.pdf`;
    try {
      this.deps.storage.save(storagePath, validFile.bytes);
    } catch {
      throw new PdfUploadError([PdfErrorCode.STORAGE_FAILED]);
    }

    // --- Extraccion de texto (PDF.js, sin OCR) ---
    const extraction = await this.deps.extractor.extract(validFile.bytes);
    const timestamp = this.now();
    const material: Material = {
      id: this.generateId(),
      opposition_id: validOppositionId,
      title: input.title as string,
      description: input.description ?? null,
      type: input.type as MaterialType,
      // Una extraccion no completada deja el material en revision para que no
      // contamine el pipeline (clasificacion/secciones/indice/generacion).
      status: extraction.status === 'completed' ? 'active' : 'needs_review',
      original_filename: validFile.original_filename,
      mime_type: validFile.mime_type ?? 'application/pdf',
      size_bytes: validFile.bytes.length,
      storage_path: storagePath,
      content_text: extraction.status === 'completed' ? extraction.text : null,
      reference: input.reference ?? null,
      file_extension: 'pdf',
      extraction_status: extraction.status,
      extraction_error:
        extraction.status === 'completed' ? null : extraction.message,
      page_count: extraction.page_count,
      uploaded_by: input.uploaded_by ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const created = await this.deps.materials.create(material);

    // --- Vinculacion con temas ---
    for (const topicId of topicIds) {
      await this.deps.topicMaterialLinks.create({
        id: this.generateId(),
        material_id: created.id,
        topic_id: topicId,
        reference: null,
        created_at: timestamp,
      });
    }

    return created;
  }

  // Reprocesa la extraccion de un material PDF ya subido (p. ej. tras corregir
  // el extractor o para recuperar materiales que quedaron `needs_review`).
  // Relee los bytes del almacen y reescribe content_text/estado/extraccion.
  async reextractMaterial(materialId: string): Promise<Material> {
    const material = await this.deps.materials.findById(materialId);
    if (!material) {
      throw new PdfUploadError([PdfErrorCode.FILE_REQUIRED]);
    }
    if (
      material.file_extension !== 'pdf' ||
      !isNonEmptyString(material.storage_path)
    ) {
      throw new PdfUploadError([PdfErrorCode.INVALID_FILE_TYPE]);
    }
    const bytes = this.deps.storage.read(material.storage_path);
    if (!bytes) {
      throw new PdfUploadError([PdfErrorCode.STORAGE_FAILED]);
    }

    const extraction = await this.deps.extractor.extract(bytes);
    const updated: Material = {
      ...material,
      status: extraction.status === 'completed' ? 'active' : 'needs_review',
      content_text: extraction.status === 'completed' ? extraction.text : null,
      extraction_status: extraction.status,
      extraction_error:
        extraction.status === 'completed' ? null : extraction.message,
      page_count: extraction.page_count,
      updated_at: this.now(),
    };
    return this.deps.materials.save(updated);
  }
}

function hasPdfExtension(filename: string): boolean {
  return /\.pdf$/i.test(filename.trim());
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}
