// Importacion de material (SPEC 017): subida multiple a un tema e importacion
// de ZIP que desglosa carpetas en temas/subtemas y archivos en materiales.
//
// Reutiliza el modelo `Material` (SPEC 002/012), los temas (SPEC 003), el
// almacenamiento separado (`FileStorage`) y la extraccion basica de PDF
// (SPEC 012). El control de acceso lo aplica `PlatformService` (owner/admin).
// No genera preguntas: solo importa y registra un lote con su resumen.

import { randomUUID } from 'node:crypto';
import type { MaterialType } from '../models/enums.js';
import type { Material } from '../models/material.js';
import type { Topic } from '../models/topic.js';
import type {
  MaterialImportBatch,
  ImportBatchStatus,
  ImportSourceType,
} from '../models/materialImportBatch.js';
import type { MaterialImportItem } from '../models/materialImportItem.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicMaterialLinkRepository } from '../repository/topicMaterialLinkRepository.js';
import type { OppositionRepository } from '../repository/oppositionRepository.js';
import type {
  MaterialImportBatchRepository,
  MaterialImportItemRepository,
} from '../repository/materialImportRepository.js';
import type { FileStorage } from '../storage/fileStorage.js';
import type { PdfTextExtractor } from '../pdf/pdfTextExtractor.js';
import type { ZipReader } from '../import/zipReader.js';
import { TopicService } from './topicService.js';
import {
  ALLOWED_IMPORT_EXTENSIONS,
  ImportError,
  ImportErrorCode,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_ZIP_FILES,
  MAX_ZIP_SIZE_BYTES,
  type AllowedImportExtension,
} from '../import/importErrors.js';

export const UNCLASSIFIED_TOPIC_TITLE = 'Material importado sin clasificar';

export interface ImportFile {
  original_filename: string;
  mime_type?: string | null;
  bytes: Uint8Array;
}

export interface ImportFilesInput {
  opposition_id?: string;
  topic_id?: string;
  files?: ImportFile[];
  default_type?: MaterialType;
  uploaded_by?: string | null;
}

export interface ImportZipInput {
  opposition_id?: string;
  parent_topic_id?: string | null;
  zip?: { original_filename: string; bytes: Uint8Array };
  default_material_type?: MaterialType;
  uploaded_by?: string | null;
}

export interface ImportResult {
  batch: MaterialImportBatch;
  items: MaterialImportItem[];
}

export interface MaterialImportServiceDeps {
  materials: MaterialRepository;
  topics: TopicService;
  topicMaterialLinks: TopicMaterialLinkRepository;
  oppositions: OppositionRepository;
  storage: FileStorage;
  extractor: PdfTextExtractor;
  zipReader: ZipReader;
  batches: MaterialImportBatchRepository;
  items: MaterialImportItemRepository;
  generateId?: () => string;
  now?: () => Date;
}

export class MaterialImportService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(private readonly deps: MaterialImportServiceDeps) {
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  // 21.3 Subida (multiple) de archivos a un tema concreto.
  importFiles(input: ImportFilesInput): ImportResult {
    const oppositionId = this.requireOpposition(input.opposition_id);
    const topic = this.requireTopic(input.topic_id, oppositionId);
    const files = input.files ?? [];
    if (files.length === 0) {
      throw new ImportError([ImportErrorCode.FILE_REQUIRED]);
    }

    const batch = this.startBatch(
      oppositionId,
      'multi_file',
      null,
      input.uploaded_by ?? null,
    );
    const items: MaterialImportItem[] = [];
    for (const file of files) {
      items.push(
        this.ingestFile({
          batchId: batch.id,
          oppositionId,
          topicId: topic.id,
          originalPath: file.original_filename,
          filename: file.original_filename,
          mimeType: file.mime_type ?? null,
          bytes: file.bytes,
          type: input.default_type ?? 'other',
          uploadedBy: input.uploaded_by ?? null,
        }),
      );
    }
    return this.finishBatch(batch, items);
  }

  // 21.4 Importacion de ZIP: carpetas -> temas/subtemas, archivos -> materiales.
  importZip(input: ImportZipInput): ImportResult {
    const oppositionId = this.requireOpposition(input.opposition_id);
    const parentTopic =
      input.parent_topic_id != null
        ? this.requireTopic(input.parent_topic_id, oppositionId)
        : null;

    const zip = input.zip;
    if (!zip || !zip.bytes) {
      throw new ImportError([ImportErrorCode.ZIP_REQUIRED]);
    }
    if (zip.bytes.length === 0) {
      throw new ImportError([ImportErrorCode.ZIP_EMPTY]);
    }
    if (zip.bytes.length > MAX_ZIP_SIZE_BYTES) {
      throw new ImportError([ImportErrorCode.ZIP_TOO_LARGE]);
    }

    const entries = this.deps.zipReader
      .read(zip.bytes)
      // Ignora metadatos de macOS y entradas vacias.
      .filter((e) => e.path && !e.path.startsWith('__MACOSX/'));

    // Validacion de seguridad ANTES de tocar nada (aborta toda la importacion).
    for (const entry of entries) {
      if (isUnsafePath(entry.path)) {
        throw new ImportError([ImportErrorCode.ZIP_UNSAFE_PATH]);
      }
      if (!isDirectory(entry.path) && extensionOf(entry.path) === 'zip') {
        throw new ImportError([ImportErrorCode.ZIP_NESTED_NOT_ALLOWED]);
      }
    }

    const fileEntries = entries.filter((e) => !isDirectory(e.path));
    if (fileEntries.length === 0) {
      throw new ImportError([ImportErrorCode.ZIP_EMPTY]);
    }
    if (fileEntries.length > MAX_ZIP_FILES) {
      throw new ImportError([ImportErrorCode.ZIP_TOO_MANY_FILES]);
    }

    const batch = this.startBatch(
      oppositionId,
      'zip',
      zip.original_filename,
      input.uploaded_by ?? null,
    );

    // Cache de temas por (parentId, titulo) para reutilizar y evitar duplicados.
    const topicCache = new Map<string, string>();
    const rootParentId = parentTopic?.id ?? null;

    // Crea primero los temas de las carpetas explicitas (incluidas vacias).
    for (const entry of entries) {
      if (isDirectory(entry.path)) {
        const segments = splitPath(entry.path);
        this.ensureTopicChain(segments, rootParentId, oppositionId, topicCache);
      }
    }

    const items: MaterialImportItem[] = [];
    for (const entry of fileEntries) {
      const segments = splitPath(entry.path);
      const filename = segments[segments.length - 1] ?? entry.path;
      const dirSegments = segments.slice(0, -1);

      let topicId: string;
      if (dirSegments.length > 0) {
        topicId = this.ensureTopicChain(
          dirSegments,
          rootParentId,
          oppositionId,
          topicCache,
        );
      } else if (rootParentId) {
        topicId = rootParentId;
      } else {
        // Archivos en raiz sin tema seleccionado -> tema "sin clasificar".
        topicId = this.ensureTopicChain(
          [UNCLASSIFIED_TOPIC_TITLE],
          null,
          oppositionId,
          topicCache,
        );
      }

      items.push(
        this.ingestFile({
          batchId: batch.id,
          oppositionId,
          topicId,
          originalPath: entry.path,
          filename,
          mimeType: null,
          bytes: entry.bytes,
          type: input.default_material_type ?? 'other',
          uploadedBy: input.uploaded_by ?? null,
        }),
      );
    }
    return this.finishBatch(batch, items);
  }

  // 21.5 Consultar lote de importacion (resumen + items).
  getBatch(batchId: string): ImportResult | null {
    const batch = this.deps.batches.findById(batchId);
    if (!batch) {
      return null;
    }
    return { batch, items: this.deps.items.findByBatch(batchId) };
  }

  // --- Internos ------------------------------------------------------------

  private ingestFile(args: {
    batchId: string;
    oppositionId: string;
    topicId: string;
    originalPath: string;
    filename: string;
    mimeType: string | null;
    bytes: Uint8Array;
    type: MaterialType;
    uploadedBy: string | null;
  }): MaterialImportItem {
    const ext = extensionOf(args.filename);

    if (!args.filename.trim()) {
      return this.recordItem(args, null, null, 'failed', ImportErrorCode.FILE_REQUIRED);
    }
    if (!isAllowedExtension(ext)) {
      return this.recordItem(
        args,
        null,
        null,
        'skipped',
        ImportErrorCode.FILE_EXTENSION_NOT_ALLOWED,
      );
    }
    if (args.bytes.length > MAX_IMPORT_FILE_SIZE_BYTES) {
      return this.recordItem(args, null, null, 'failed', ImportErrorCode.FILE_TOO_LARGE);
    }
    if (this.isDuplicate(args.topicId, args.filename)) {
      return this.recordItem(
        args,
        null,
        args.topicId,
        'skipped',
        ImportErrorCode.DUPLICATE_SKIPPED,
      );
    }

    const storagePath = `uploads/materials/${this.generateId()}.${ext}`;
    try {
      this.deps.storage.save(storagePath, args.bytes);
    } catch {
      return this.recordItem(args, null, args.topicId, 'failed', ImportErrorCode.STORAGE_FAILED);
    }

    const { contentText, extractionStatus, extractionError, pageCount } =
      this.extractContent(ext, args.bytes);

    const timestamp = this.now();
    const material: Material = {
      id: this.generateId(),
      opposition_id: args.oppositionId,
      title: stripExtension(args.filename),
      description: null,
      type: args.type,
      status: 'active',
      original_filename: args.filename,
      mime_type: args.mimeType ?? mimeForExtension(ext),
      size_bytes: args.bytes.length,
      storage_path: storagePath,
      content_text: contentText,
      reference: null,
      file_extension: ext,
      extraction_status: extractionStatus,
      extraction_error: extractionError,
      page_count: pageCount,
      uploaded_by: args.uploadedBy,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const created = this.deps.materials.create(material);
    this.deps.topicMaterialLinks.create({
      id: this.generateId(),
      material_id: created.id,
      topic_id: args.topicId,
      reference: null,
      created_at: timestamp,
    });
    return this.recordItem(args, created.id, args.topicId, 'imported', null);
  }

  private extractContent(
    ext: AllowedImportExtension,
    bytes: Uint8Array,
  ): {
    contentText: string | null;
    extractionStatus: Material['extraction_status'];
    extractionError: string | null;
    pageCount: number | null;
  } {
    if (ext === 'pdf') {
      const result = this.deps.extractor.extract(bytes);
      return {
        contentText: result.status === 'completed' ? result.text : null,
        extractionStatus: result.status,
        extractionError:
          result.status === 'completed'
            ? null
            : 'No se pudo extraer texto del PDF (posible PDF escaneado).',
        pageCount: result.page_count,
      };
    }
    // TXT / MD: el contenido es texto directamente.
    const text = new TextDecoder('utf-8').decode(bytes);
    return {
      contentText: text,
      extractionStatus: 'completed',
      extractionError: null,
      pageCount: null,
    };
  }

  private isDuplicate(topicId: string, filename: string): boolean {
    const links = this.deps.topicMaterialLinks.findAll({ topic_id: topicId });
    return links.some((link) => {
      const material = this.deps.materials.findById(link.material_id);
      return material?.original_filename === filename;
    });
  }

  // Crea o reutiliza la cadena de temas que representa una ruta de carpetas.
  private ensureTopicChain(
    segments: string[],
    rootParentId: string | null,
    oppositionId: string,
    cache: Map<string, string>,
  ): string {
    let parentId = rootParentId;
    for (const rawSegment of segments) {
      const title = rawSegment.trim();
      if (!title) {
        continue;
      }
      const key = `${parentId ?? ''} ${title}`;
      const cached = cache.get(key);
      if (cached) {
        parentId = cached;
        continue;
      }
      const existing = this.deps.topics
        .listTopics()
        .find(
          (t) =>
            t.opposition_id === oppositionId &&
            (t.parent_id ?? null) === parentId &&
            t.title === title,
        );
      const topic: Topic =
        existing ??
        this.deps.topics.createTopic({
          opposition_id: oppositionId,
          title,
          parent_id: parentId,
        });
      cache.set(key, topic.id);
      parentId = topic.id;
    }
    // `parentId` nunca es null aqui salvo segmentos vacios; el caller solo llama
    // con al menos un segmento valido.
    return parentId as string;
  }

  private startBatch(
    oppositionId: string,
    sourceType: ImportSourceType,
    originalFilename: string | null,
    uploadedBy: string | null,
  ): MaterialImportBatch {
    const opposition = this.deps.oppositions.findById(oppositionId);
    const timestamp = this.now();
    return this.deps.batches.create({
      id: this.generateId(),
      workspace_id: opposition?.workspace_id ?? '',
      opposition_id: oppositionId,
      uploaded_by: uploadedBy,
      status: 'processing',
      source_type: sourceType,
      original_filename: originalFilename,
      total_files: 0,
      imported_files: 0,
      skipped_files: 0,
      failed_files: 0,
      errors: [],
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  private finishBatch(
    batch: MaterialImportBatch,
    items: MaterialImportItem[],
  ): ImportResult {
    const imported = items.filter((i) => i.status === 'imported').length;
    const skipped = items.filter((i) => i.status === 'skipped').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    const errors = [
      ...new Set(items.map((i) => i.error).filter((e): e is string => !!e)),
    ];
    let status: ImportBatchStatus;
    if (imported === 0) {
      status = 'failed';
    } else if (skipped > 0 || failed > 0) {
      status = 'completed_with_errors';
    } else {
      status = 'completed';
    }
    const saved = this.deps.batches.save({
      ...batch,
      status,
      total_files: items.length,
      imported_files: imported,
      skipped_files: skipped,
      failed_files: failed,
      errors,
      updated_at: this.now(),
    });
    return { batch: saved, items };
  }

  private recordItem(
    args: {
      batchId: string;
      topicId: string;
      originalPath: string;
      filename: string;
    },
    materialId: string | null,
    topicId: string | null,
    status: MaterialImportItem['status'],
    error: ImportErrorCode | null,
  ): MaterialImportItem {
    const timestamp = this.now();
    return this.deps.items.create({
      id: this.generateId(),
      batch_id: args.batchId,
      material_id: materialId,
      topic_id: topicId,
      original_path: args.originalPath,
      original_filename: args.filename,
      status,
      error,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  private requireOpposition(oppositionId: string | undefined): string {
    if (!isNonEmptyString(oppositionId)) {
      throw new ImportError([ImportErrorCode.OPPOSITION_REQUIRED]);
    }
    if (!this.deps.oppositions.findById(oppositionId)) {
      throw new ImportError([ImportErrorCode.OPPOSITION_NOT_FOUND]);
    }
    return oppositionId;
  }

  private requireTopic(
    topicId: string | undefined | null,
    oppositionId: string,
  ): Topic {
    if (!isNonEmptyString(topicId)) {
      throw new ImportError([ImportErrorCode.TOPIC_NOT_FOUND]);
    }
    const topic = this.deps.topics.getTopic(topicId);
    if (!topic) {
      throw new ImportError([ImportErrorCode.TOPIC_NOT_FOUND]);
    }
    if (topic.opposition_id !== oppositionId) {
      throw new ImportError([ImportErrorCode.TOPIC_OPPOSITION_MISMATCH]);
    }
    return topic;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDirectory(path: string): boolean {
  return path.endsWith('/');
}

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

function extensionOf(filename: string): string {
  const base = filename.split('/').pop() ?? filename;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

function isAllowedExtension(ext: string): ext is AllowedImportExtension {
  return (ALLOWED_IMPORT_EXTENSIONS as readonly string[]).includes(ext);
}

function mimeForExtension(ext: string): string {
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'md':
      return 'text/markdown';
    default:
      return 'application/octet-stream';
  }
}

// Rutas peligrosas: absolutas, con `..`, con backslash o estilo Windows `C:`.
function isUnsafePath(path: string): boolean {
  if (path.includes('\\')) {
    return true;
  }
  if (path.startsWith('/')) {
    return true;
  }
  if (/^[A-Za-z]:/.test(path)) {
    return true;
  }
  return path.split('/').some((segment) => segment === '..');
}
