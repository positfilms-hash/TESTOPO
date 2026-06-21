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
import {
  IMPORT_SOURCE_TYPES,
  type MaterialImportBatch,
  type ImportBatchStatus,
  type ImportSourceType,
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
import {
  isUploadCategory,
  type DetectedCategory,
  type UploadCategory,
} from '../models/uploadCategory.js';
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
import {
  fromImportError,
  SmartUploadError,
  SmartUploadErrorCode,
} from '../import/smartUploadErrors.js';

export const UNCLASSIFIED_TOPIC_TITLE = 'Material importado sin clasificar';

// Nombres de carpeta top-level que la app reconoce en un ZIP/carpeta combinado
// (SPEC 028, 12.3). Se comparan normalizados (sin acentos, en minusculas).
const OPPOSITION_FOLDER_HINTS = ['material de la oposicion', 'material'];
const OLD_TESTS_FOLDER_HINTS = ['tests antiguos', 'examenes', 'examenes oficiales'];

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

// --- Carga masiva inteligente (SPEC 028) --------------------------------------

// Un archivo de la carga masiva. Para ZIP el servicio expande las entradas; para
// carpeta/multi-archivo el frontend ya envia un archivo por elemento con su ruta
// relativa (`original_path`, p. ej. `Tema 1/Constitucion.pdf`).
export interface SmartUploadFile {
  original_path: string;
  original_filename: string;
  mime_type?: string | null;
  bytes: Uint8Array;
}

export interface SmartUploadInput {
  opposition_id?: string;
  upload_category?: UploadCategory;
  source_type?: ImportSourceType;
  /** ZIP a expandir (cuando `source_type = 'zip'`). */
  zip?: { original_filename: string; bytes: Uint8Array };
  /** Archivos ya expandidos (carpeta o multi-archivo). */
  files?: SmartUploadFile[];
  uploaded_by?: string | null;
}

export interface SmartUploadResult {
  batch: MaterialImportBatch;
  items: MaterialImportItem[];
}

// Argumentos internos de ingesta de un archivo (compartidos por la importacion
// clasica SPEC 017 y la carga masiva SPEC 028).
interface IngestArgs {
  batchId: string;
  workspaceId: string | null;
  oppositionId: string;
  /** Tema al que vincular el material; null en carga masiva (no crea temas). */
  topicId: string | null;
  originalPath: string;
  filename: string;
  mimeType: string | null;
  bytes: Uint8Array;
  type: MaterialType;
  uploadCategory: UploadCategory;
  detectedCategory: DetectedCategory;
  aiConfidence: number | null;
  uploadedBy: string | null;
  /** Marca `needs_review` ante problema de extraccion/clasificacion (SPEC 028). */
  flagNeedsReview: boolean;
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
  async importFiles(input: ImportFilesInput): Promise<ImportResult> {
    const oppositionId = await this.requireOpposition(input.opposition_id);
    const topic = await this.requireTopic(input.topic_id, oppositionId);
    const files = input.files ?? [];
    if (files.length === 0) {
      throw new ImportError([ImportErrorCode.FILE_REQUIRED]);
    }

    const batch = await this.startBatch(
      oppositionId,
      'multi_file',
      null,
      input.uploaded_by ?? null,
    );
    const items: MaterialImportItem[] = [];
    for (const file of files) {
      items.push(
        await this.ingestFile({
          batchId: batch.id,
          workspaceId: batch.workspace_id || null,
          oppositionId,
          topicId: topic.id,
          originalPath: file.original_filename,
          filename: file.original_filename,
          mimeType: file.mime_type ?? null,
          bytes: file.bytes,
          type: input.default_type ?? 'other',
          uploadCategory: 'opposition_material',
          detectedCategory: 'opposition_material',
          aiConfidence: null,
          uploadedBy: input.uploaded_by ?? null,
          flagNeedsReview: false,
        }),
      );
    }
    return this.finishBatch(batch, items);
  }

  // 21.4 Importacion de ZIP: carpetas -> temas/subtemas, archivos -> materiales.
  async importZip(input: ImportZipInput): Promise<ImportResult> {
    const oppositionId = await this.requireOpposition(input.opposition_id);
    const parentTopic =
      input.parent_topic_id != null
        ? await this.requireTopic(input.parent_topic_id, oppositionId)
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

    const batch = await this.startBatch(
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
        await this.ensureTopicChain(
          segments,
          rootParentId,
          oppositionId,
          topicCache,
        );
      }
    }

    const items: MaterialImportItem[] = [];
    for (const entry of fileEntries) {
      const segments = splitPath(entry.path);
      const filename = segments[segments.length - 1] ?? entry.path;
      const dirSegments = segments.slice(0, -1);

      let topicId: string;
      if (dirSegments.length > 0) {
        topicId = await this.ensureTopicChain(
          dirSegments,
          rootParentId,
          oppositionId,
          topicCache,
        );
      } else if (rootParentId) {
        topicId = rootParentId;
      } else {
        // Archivos en raiz sin tema seleccionado -> tema "sin clasificar".
        topicId = await this.ensureTopicChain(
          [UNCLASSIFIED_TOPIC_TITLE],
          null,
          oppositionId,
          topicCache,
        );
      }

      items.push(
        await this.ingestFile({
          batchId: batch.id,
          workspaceId: batch.workspace_id || null,
          oppositionId,
          topicId,
          originalPath: entry.path,
          filename,
          mimeType: null,
          bytes: entry.bytes,
          type: input.default_material_type ?? 'other',
          uploadCategory: 'opposition_material',
          detectedCategory: 'opposition_material',
          aiConfidence: null,
          uploadedBy: input.uploaded_by ?? null,
          flagNeedsReview: false,
        }),
      );
    }
    return this.finishBatch(batch, items);
  }

  // --- Carga masiva inteligente (SPEC 028) ---------------------------------

  // Punto de entrada unico de subida masiva. Reutiliza la validacion de
  // seguridad y la ingesta de la importacion clasica, pero clasifica por
  // categoria y NO crea temas (las asociaciones se proponen luego via IA).
  async smartUpload(input: SmartUploadInput): Promise<SmartUploadResult> {
    const oppositionId = await this.requireOppositionSmart(input.opposition_id);
    // Validacion en runtime: una llamada directa (no por TS) podria colar valores
    // que romperian el check constraint de la tabla. SPEC 028.
    const uploadCategory = input.upload_category ?? 'opposition_material';
    if (!isUploadCategory(uploadCategory)) {
      throw new SmartUploadError([SmartUploadErrorCode.INVALID_CATEGORY]);
    }
    const sourceType: ImportSourceType = input.source_type ?? 'multi_file';
    if (!(IMPORT_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      throw new SmartUploadError([SmartUploadErrorCode.INVALID_FILE_TYPE]);
    }
    const uploadedBy = input.uploaded_by ?? null;

    // Resolver la lista de archivos (expandir ZIP o usar los ya expandidos).
    let files: SmartUploadFile[];
    let originalFilename: string | null;
    if (sourceType === 'zip') {
      files = this.expandZip(input.zip);
      originalFilename = input.zip?.original_filename ?? null;
    } else {
      files = (input.files ?? []).filter((f) => f && f.bytes);
      originalFilename = null;
    }
    if (files.length === 0) {
      throw new SmartUploadError([SmartUploadErrorCode.FILE_REQUIRED]);
    }
    if (files.length > MAX_ZIP_FILES) {
      throw new SmartUploadError([SmartUploadErrorCode.TOO_MANY_FILES]);
    }
    // Validacion de seguridad de rutas (aborta todo el lote, como el ZIP).
    for (const file of files) {
      if (isUnsafePath(file.original_path)) {
        throw new SmartUploadError([SmartUploadErrorCode.UNSAFE_PATH]);
      }
      if (extensionOf(file.original_filename) === 'zip') {
        throw new SmartUploadError([
          SmartUploadErrorCode.NESTED_ZIP_NOT_ALLOWED,
        ]);
      }
    }

    const batch = await this.startBatch(
      oppositionId,
      sourceType,
      originalFilename,
      uploadedBy,
      uploadCategory,
    );

    const warnings: string[] = [];
    const items: MaterialImportItem[] = [];
    for (const file of files) {
      const { detected, confidence } = this.classifyFile(
        file.original_path,
        uploadCategory,
      );
      if (detected === 'unknown') {
        warnings.push(
          `No se ha podido clasificar "${file.original_filename}"; queda pendiente de revision.`,
        );
      }
      items.push(
        await this.ingestFile({
          batchId: batch.id,
          workspaceId: batch.workspace_id || null,
          oppositionId,
          topicId: null,
          originalPath: file.original_path,
          filename: file.original_filename,
          mimeType: file.mime_type ?? null,
          bytes: file.bytes,
          type: defaultTypeForCategory(detected),
          uploadCategory,
          detectedCategory: detected,
          aiConfidence: confidence,
          uploadedBy,
          flagNeedsReview: true,
        }),
      );
    }
    return this.finishBatch(batch, items, warnings);
  }

  // 21.5 Consultar lote de importacion (resumen + items).
  async getBatch(batchId: string): Promise<ImportResult | null> {
    const batch = await this.deps.batches.findById(batchId);
    if (!batch) {
      return null;
    }
    return { batch, items: await this.deps.items.findByBatch(batchId) };
  }

  // --- Internos ------------------------------------------------------------

  private async ingestFile(args: IngestArgs): Promise<MaterialImportItem> {
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
    const duplicate =
      args.topicId != null
        ? await this.isDuplicate(args.topicId, args.filename)
        : await this.isDuplicateInOpposition(args.oppositionId, args.filename);
    if (duplicate) {
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
      await this.extractContent(ext, args.bytes);

    // SPEC 028, 30: en la carga masiva, un PDF sin texto o un archivo de
    // categoria ambigua nace `needs_review`. En la importacion clasica
    // (SPEC 017) el material nace `active` como hasta ahora.
    const status: Material['status'] =
      args.flagNeedsReview &&
      (extractionStatus === 'not_supported' ||
        extractionStatus === 'failed' ||
        args.detectedCategory === 'unknown')
        ? 'needs_review'
        : 'active';

    const timestamp = this.now();
    const material: Material = {
      id: this.generateId(),
      opposition_id: args.oppositionId,
      title: stripExtension(args.filename),
      description: null,
      type: args.type,
      status,
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
    const created = await this.deps.materials.create(material);
    // Solo se vincula a un tema en la importacion clasica por-tema (SPEC 017).
    // La carga masiva (SPEC 028) NO crea temas: las asociaciones se proponen
    // luego via el indice IA (SPEC 019), con revision humana.
    if (args.topicId != null) {
      await this.deps.topicMaterialLinks.create({
        id: this.generateId(),
        material_id: created.id,
        topic_id: args.topicId,
        reference: null,
        created_at: timestamp,
      });
    }
    return this.recordItem(args, created.id, args.topicId, 'imported', null);
  }

  private async extractContent(
    ext: AllowedImportExtension,
    bytes: Uint8Array,
  ): Promise<{
    contentText: string | null;
    extractionStatus: Material['extraction_status'];
    extractionError: string | null;
    pageCount: number | null;
  }> {
    if (ext === 'pdf') {
      const result = await this.deps.extractor.extract(bytes);
      return {
        contentText: result.status === 'completed' ? result.text : null,
        extractionStatus: result.status,
        extractionError: result.status === 'completed' ? null : result.message,
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

  private async isDuplicate(
    topicId: string,
    filename: string,
  ): Promise<boolean> {
    const links = await this.deps.topicMaterialLinks.findAll({
      topic_id: topicId,
    });
    for (const link of links) {
      const material = await this.deps.materials.findById(link.material_id);
      if (material?.original_filename === filename) {
        return true;
      }
    }
    return false;
  }

  // Crea o reutiliza la cadena de temas que representa una ruta de carpetas.
  private async ensureTopicChain(
    segments: string[],
    rootParentId: string | null,
    oppositionId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    let parentId = rootParentId;
    for (const rawSegment of segments) {
      const title = rawSegment.trim();
      if (!title) {
        continue;
      }
      const key = `${parentId ?? ''} ${title}`;
      const cached = cache.get(key);
      if (cached) {
        parentId = cached;
        continue;
      }
      const existing = (await this.deps.topics.listTopics()).find(
        (t) =>
          t.opposition_id === oppositionId &&
          (t.parent_id ?? null) === parentId &&
          t.title === title,
      );
      const topic: Topic =
        existing ??
        (await this.deps.topics.createTopic({
          opposition_id: oppositionId,
          title,
          parent_id: parentId,
        }));
      cache.set(key, topic.id);
      parentId = topic.id;
    }
    // `parentId` nunca es null aqui salvo segmentos vacios; el caller solo llama
    // con al menos un segmento valido.
    return parentId as string;
  }

  private async startBatch(
    oppositionId: string,
    sourceType: ImportSourceType,
    originalFilename: string | null,
    uploadedBy: string | null,
    uploadCategory: UploadCategory = 'opposition_material',
  ): Promise<MaterialImportBatch> {
    const opposition = await this.deps.oppositions.findById(oppositionId);
    const timestamp = this.now();
    return this.deps.batches.create({
      id: this.generateId(),
      workspace_id: opposition?.workspace_id ?? '',
      opposition_id: oppositionId,
      uploaded_by: uploadedBy,
      status: 'processing',
      source_type: sourceType,
      upload_category: uploadCategory,
      original_filename: originalFilename,
      total_files: 0,
      imported_files: 0,
      skipped_files: 0,
      failed_files: 0,
      analyzed_files: 0,
      errors: [],
      warnings: [],
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  private async finishBatch(
    batch: MaterialImportBatch,
    items: MaterialImportItem[],
    extraWarnings: string[] = [],
  ): Promise<ImportResult> {
    const imported = items.filter((i) => i.status === 'imported').length;
    const skipped = items.filter((i) => i.status === 'skipped').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    // Materiales con texto extraido: se consulta el material de cada item importado.
    let analyzed = 0;
    for (const item of items) {
      if (item.status !== 'imported' || !item.material_id) {
        continue;
      }
      const material = await this.deps.materials.findById(item.material_id);
      if (material?.extraction_status === 'completed') {
        analyzed += 1;
      }
    }
    const errors = [
      ...new Set(items.map((i) => i.error).filter((e): e is string => !!e)),
    ];
    const warnings = [...new Set(extraWarnings)];
    let status: ImportBatchStatus;
    if (imported === 0) {
      status = 'failed';
    } else if (skipped > 0 || failed > 0) {
      status = 'completed_with_errors';
    } else {
      status = 'completed';
    }
    const saved = await this.deps.batches.save({
      ...batch,
      status,
      total_files: items.length,
      imported_files: imported,
      skipped_files: skipped,
      failed_files: failed,
      analyzed_files: analyzed,
      errors,
      warnings,
      updated_at: this.now(),
    });
    return { batch: saved, items };
  }

  private recordItem(
    args: IngestArgs,
    materialId: string | null,
    topicId: string | null,
    status: MaterialImportItem['status'],
    error: ImportErrorCode | null,
  ): Promise<MaterialImportItem> {
    const timestamp = this.now();
    return this.deps.items.create({
      id: this.generateId(),
      batch_id: args.batchId,
      workspace_id: args.workspaceId,
      opposition_id: args.oppositionId,
      material_id: materialId,
      topic_id: topicId,
      original_path: args.originalPath,
      original_filename: args.filename,
      upload_category: args.uploadCategory,
      detected_category: args.detectedCategory,
      ai_classification_confidence: args.aiConfidence,
      status,
      error,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  // Duplicado a nivel de oposicion (carga masiva sin tema): mismo nombre de
  // archivo en un material ya existente de la misma oposicion.
  private async isDuplicateInOpposition(
    oppositionId: string,
    filename: string,
  ): Promise<boolean> {
    const materials = await this.deps.materials.findAll({});
    return materials.some(
      (m) =>
        m.opposition_id === oppositionId && m.original_filename === filename,
    );
  }

  private async requireOpposition(
    oppositionId: string | undefined,
  ): Promise<string> {
    if (!isNonEmptyString(oppositionId)) {
      throw new ImportError([ImportErrorCode.OPPOSITION_REQUIRED]);
    }
    if (!(await this.deps.oppositions.findById(oppositionId))) {
      throw new ImportError([ImportErrorCode.OPPOSITION_NOT_FOUND]);
    }
    return oppositionId;
  }

  private async requireTopic(
    topicId: string | undefined | null,
    oppositionId: string,
  ): Promise<Topic> {
    if (!isNonEmptyString(topicId)) {
      throw new ImportError([ImportErrorCode.TOPIC_NOT_FOUND]);
    }
    const topic = await this.deps.topics.getTopic(topicId);
    if (!topic) {
      throw new ImportError([ImportErrorCode.TOPIC_NOT_FOUND]);
    }
    if (topic.opposition_id !== oppositionId) {
      throw new ImportError([ImportErrorCode.TOPIC_OPPOSITION_MISMATCH]);
    }
    return topic;
  }

  // --- Internos de carga masiva (SPEC 028) ---------------------------------

  private async requireOppositionSmart(
    oppositionId: string | undefined,
  ): Promise<string> {
    if (!isNonEmptyString(oppositionId)) {
      throw new SmartUploadError([
        SmartUploadErrorCode.OPPOSITION_REQUIRED,
      ]);
    }
    if (!(await this.deps.oppositions.findById(oppositionId))) {
      throw new SmartUploadError([
        SmartUploadErrorCode.OPPOSITION_REQUIRED,
      ]);
    }
    return oppositionId;
  }

  // Expande un ZIP a archivos, reutilizando la validacion de seguridad de la
  // importacion clasica pero traduciendo sus errores a codigos SMART_UPLOAD_*.
  private expandZip(
    zip: { original_filename: string; bytes: Uint8Array } | undefined,
  ): SmartUploadFile[] {
    if (!zip || !zip.bytes || zip.bytes.length === 0) {
      throw new SmartUploadError([SmartUploadErrorCode.FILE_REQUIRED]);
    }
    if (zip.bytes.length > MAX_ZIP_SIZE_BYTES) {
      throw new SmartUploadError([SmartUploadErrorCode.ZIP_TOO_LARGE]);
    }
    const entries = this.deps.zipReader
      .read(zip.bytes)
      .filter((e) => e.path && !e.path.startsWith('__MACOSX/'));
    for (const entry of entries) {
      if (isUnsafePath(entry.path)) {
        throw new SmartUploadError([SmartUploadErrorCode.UNSAFE_PATH]);
      }
      if (!isDirectory(entry.path) && extensionOf(entry.path) === 'zip') {
        throw new SmartUploadError([
          SmartUploadErrorCode.NESTED_ZIP_NOT_ALLOWED,
        ]);
      }
    }
    const fileEntries = entries.filter((e) => !isDirectory(e.path));
    if (fileEntries.length === 0) {
      throw new SmartUploadError([SmartUploadErrorCode.FILE_REQUIRED]);
    }
    return fileEntries.map((entry) => {
      const segments = splitPath(entry.path);
      return {
        original_path: entry.path,
        original_filename: segments[segments.length - 1] ?? entry.path,
        mime_type: null,
        bytes: entry.bytes,
      };
    });
  }

  // Clasifica un archivo en una categoria detectada (SPEC 028, 16). Para una
  // carga no combinada manda la eleccion del usuario; para `mixed` se infiere
  // por la carpeta top-level del path.
  private classifyFile(
    path: string,
    uploadCategory: UploadCategory,
  ): { detected: DetectedCategory; confidence: number | null } {
    if (uploadCategory === 'opposition_material') {
      return { detected: 'opposition_material', confidence: 1 };
    }
    if (uploadCategory === 'old_tests') {
      return { detected: 'old_tests', confidence: 1 };
    }
    // Combinado: mirar la carpeta principal del path.
    const segments = splitPath(path);
    const top = normalizeFolder(segments[0] ?? '');
    if (OPPOSITION_FOLDER_HINTS.includes(top)) {
      return { detected: 'opposition_material', confidence: 0.9 };
    }
    if (OLD_TESTS_FOLDER_HINTS.includes(top)) {
      return { detected: 'old_tests', confidence: 0.9 };
    }
    return { detected: 'unknown', confidence: null };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Tipo de material por defecto segun la categoria detectada (SPEC 028, 9/30).
function defaultTypeForCategory(detected: DetectedCategory): MaterialType {
  switch (detected) {
    case 'opposition_material':
      return 'syllabus';
    case 'old_tests':
      return 'old_test';
    default:
      return 'other';
  }
}

// Normaliza un nombre de carpeta para comparar pistas de categoria: minusculas,
// sin acentos, sin espacios sobrantes.
function normalizeFolder(name: string): string {
  // Quita las marcas diacriticas combinantes (U+0300..U+036F) tras NFD, sin
  // incluir esos caracteres en el fuente (mantiene el archivo en ASCII).
  return Array.from(name.normalize('NFD'))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('')
    .trim()
    .toLowerCase();
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
