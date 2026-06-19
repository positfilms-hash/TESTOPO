// Secciones de material (SPEC 028-C). Tras clasificar (SPEC 028-B), cada material
// util se divide en secciones/fragmentos referenciables (pagina, epigrafe o
// chunk). Las secciones son la base para que specs futuras (indice, generacion)
// citen una fuente concreta. NO se generan preguntas ni indice aqui.

import type { DocumentClass } from './documentClassification.js';

// Tipo estructural de la seccion.
export const SECTION_TYPES = [
  'page',
  'heading',
  'chunk',
  'exam_question_block',
  'toc_block',
  'unknown',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

// Clasificacion interna de la seccion (heredada de la clase documental).
export const SECTION_CLASSES = [
  'study_content',
  'legal_content',
  'summary_content',
  'index_content',
  'old_exam_content',
  'unknown',
] as const;
export type SectionClass = (typeof SECTION_CLASSES)[number];

export const SECTION_STATUSES = ['active', 'needs_review', 'obsolete'] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export function isSectionClass(value: unknown): value is SectionClass {
  return (
    typeof value === 'string' &&
    (SECTION_CLASSES as readonly string[]).includes(value)
  );
}

// Clases documentales (028-B) que SI generan secciones, y el mapeo a la clase de
// seccion (SPEC 028-C, 7/24). Las demas no son elegibles.
const DOC_TO_SECTION_CLASS: Partial<Record<DocumentClass, SectionClass>> = {
  syllabus_material: 'study_content',
  legal_text: 'legal_content',
  notes_or_summary: 'summary_content',
  index_or_table_of_contents: 'index_content',
  old_exam_or_test: 'old_exam_content',
};

export function isEligibleDocumentClass(cls: DocumentClass): boolean {
  return cls in DOC_TO_SECTION_CLASS;
}

export function sectionClassForDocument(cls: DocumentClass): SectionClass {
  return DOC_TO_SECTION_CLASS[cls] ?? 'unknown';
}

export interface MaterialSection {
  id: string;
  workspace_id: string | null;
  opposition_id: string | null;
  material_id: string;
  section_title: string;
  section_type: SectionType;
  page_start: number | null;
  page_end: number | null;
  /** Fragmento corto para mostrar/referenciar en UI. */
  content_excerpt: string;
  /** Texto completo de la seccion. */
  content_text: string;
  order_index: number;
  classification: SectionClass;
  /** Referencia legible al origen (p. ej. "Tema 1.pdf - paginas 3-4"). */
  source_path: string | null;
  status: SectionStatus;
  created_at: Date;
  updated_at: Date;
}
