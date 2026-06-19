// Tipos del proveedor de indice de temario ANCLADO A DOCUMENTOS (SPEC 028-D). A
// diferencia de SPEC 019 (que recibe materiales con texto), aqui el proveedor
// recibe documentos clasificados con sus secciones (SPEC 028-B/028-C) y debe
// devolver temas/subtemas con FUENTES concretas (material/seccion/referencia).
//
// El proveedor SOLO organiza evidencia: no escribe temario, no inventa temas, no
// genera preguntas/opciones/tests. Los examenes antiguos son contexto secundario.

import type { DocumentClass } from '../models/documentClassification.js';

export interface GroundedSectionInput {
  section_id: string;
  title: string;
  excerpt: string;
  source_reference_id?: string | null;
}

export interface GroundedDocumentInput {
  material_id: string;
  title: string;
  classification: DocumentClass;
  /** Primaria (temario/legal/apuntes/indice) o contexto secundario (examen). */
  is_primary: boolean;
  confidence: number | null;
  sections: GroundedSectionInput[];
}

export interface GroundedIndexProviderInput {
  opposition_title: string | null;
  documents: GroundedDocumentInput[];
  max_topics: number;
  max_depth: number;
}

// Fuentes que respaldan un nodo: ids de material/secciones/referencias.
export interface GroundedNodeSources {
  material_id: string;
  section_ids: string[];
  reference_ids: string[];
}

export interface GroundedTopicNode {
  title: string;
  description?: string | null;
  order: number;
  confidence?: number | null;
  warnings?: string[];
  children?: GroundedTopicNode[];
  /** Fuentes concretas del nodo (al menos una primaria en las raices). */
  sources: GroundedNodeSources[];
}

export interface GroundedIndexOutput {
  title: string;
  summary: string;
  topics: GroundedTopicNode[];
  warnings: string[];
  provider: string;
  model: string | null;
}

export interface DocumentGroundedIndexProvider {
  readonly name: string;
  readonly model: string | null;
  proposeIndex(
    input: GroundedIndexProviderInput,
  ): Promise<GroundedIndexOutput>;
}

// Clases documentales que pueden ser FUENTE PRIMARIA de un tema (SPEC 028-D).
export const PRIMARY_INDEX_CLASSES: DocumentClass[] = [
  'syllabus_material',
  'legal_text',
  'notes_or_summary',
  'index_or_table_of_contents',
];

// Clases que solo aportan CONTEXTO SECUNDARIO (cobertura/estilo), nunca fuente
// unica de un tema.
export const SECONDARY_INDEX_CLASSES: DocumentClass[] = ['old_exam_or_test'];

export function isPrimaryIndexClass(cls: DocumentClass): boolean {
  return PRIMARY_INDEX_CLASSES.includes(cls);
}

export function isSecondaryIndexClass(cls: DocumentClass): boolean {
  return SECONDARY_INDEX_CLASSES.includes(cls);
}
