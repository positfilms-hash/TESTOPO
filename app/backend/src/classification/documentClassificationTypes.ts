// Tipos del proveedor de clasificacion documental (SPEC 028-B, 10/14). El
// proveedor SOLO clasifica un documento: no genera indice ni preguntas.

import type { DocumentClass } from '../models/documentClassification.js';
import type {
  DetectedCategory,
  UploadCategory,
} from '../models/uploadCategory.js';

// Documento que entra al clasificador (texto ya extraido y recortado por el
// servicio). Incluye senales utiles: nombre, ruta y categoria de subida.
export interface DocumentClassificationProviderInput {
  material_id: string;
  title: string;
  filename: string;
  original_path: string;
  upload_category?: UploadCategory | null;
  detected_category?: DetectedCategory | null;
  /** Texto extraido del documento; vacio si no hay texto (PDF escaneado). */
  text: string;
  page_count?: number | null;
}

export interface DocumentClassificationProviderOutput {
  classification: DocumentClass;
  confidence: number;
  reason: string | null;
  detected_title: string | null;
  detected_question_count: number | null;
  warnings: string[];
  provider: string;
  model: string | null;
}

export interface DocumentClassificationProvider {
  readonly name: string;
  readonly model: string | null;
  classify(
    input: DocumentClassificationProviderInput,
  ): Promise<DocumentClassificationProviderOutput>;
}
