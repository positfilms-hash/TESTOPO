// Clasificacion documental e inventario de importacion (SPEC 028-B).
//
// Tras subir material (SPEC 028), la app responde "que es cada archivo": cada
// material importado recibe una `DocumentClassification` y cada ejecucion de
// clasificacion se registra como un `DocumentUnderstandingRun`. La IA/heuristica
// SOLO clasifica; no genera indice ni preguntas. La correccion humana prevalece.

// --- Clases documentales (SPEC 028-B, 6) -------------------------------------
export const DOCUMENT_CLASSES = [
  'syllabus_material',
  'old_exam_or_test',
  'legal_text',
  'notes_or_summary',
  'index_or_table_of_contents',
  'irrelevant',
  'not_analyzable',
  'ambiguous',
] as const;
export type DocumentClass = (typeof DOCUMENT_CLASSES)[number];

// Etiquetas visibles para la UI (SPEC 028-B, 6).
export const DOCUMENT_CLASS_LABELS: Record<DocumentClass, string> = {
  syllabus_material: 'Temario / material de estudio',
  old_exam_or_test: 'Test antiguo / examen',
  legal_text: 'Texto legal',
  notes_or_summary: 'Apuntes o resumen',
  index_or_table_of_contents: 'Indice o tabla de contenidos',
  irrelevant: 'Irrelevante',
  not_analyzable: 'No analizable',
  ambiguous: 'Dudoso',
};

export function isDocumentClass(value: unknown): value is DocumentClass {
  return (
    typeof value === 'string' &&
    (DOCUMENT_CLASSES as readonly string[]).includes(value)
  );
}

// Clases que un alumno NUNCA debe ver (cierra el riesgo de SPEC 028 §17.1): los
// tests/examenes son fuente interna; lo dudoso/no-analizable/irrelevante no es
// material de estudio.
export const STUDENT_HIDDEN_CLASSES: ReadonlySet<DocumentClass> = new Set([
  'old_exam_or_test',
  'irrelevant',
  'not_analyzable',
  'ambiguous',
]);

// Clases que SI son material de estudio visible para el alumno (si `active`).
export const STUDENT_VISIBLE_CLASSES: ReadonlySet<DocumentClass> = new Set([
  'syllabus_material',
  'legal_text',
  'notes_or_summary',
  'index_or_table_of_contents',
]);

// --- Ejecucion de clasificacion (SPEC 028-B, 8) ------------------------------
export const DOCUMENT_RUN_STATUSES = [
  'pending',
  'processing',
  'completed',
  'completed_with_warnings',
  'failed',
] as const;
export type DocumentRunStatus = (typeof DOCUMENT_RUN_STATUSES)[number];

export interface DocumentUnderstandingRun {
  id: string;
  workspace_id: string | null;
  opposition_id: string | null;
  batch_id: string | null;
  created_by: string | null;
  status: DocumentRunStatus;
  provider: string;
  model: string | null;
  total_materials: number;
  classified_materials: number;
  needs_review_count: number;
  not_analyzable_count: number;
  warnings: string[];
  errors: string[];
  created_at: Date;
  updated_at: Date;
}

// --- Clasificacion por material (SPEC 028-B, 9) ------------------------------
export interface DocumentClassification {
  id: string;
  workspace_id: string | null;
  opposition_id: string | null;
  material_id: string;
  run_id: string;
  classification: DocumentClass;
  confidence: number | null;
  reason: string | null;
  detected_title: string | null;
  detected_document_date: string | null;
  detected_question_count: number | null;
  detected_page_count: number | null;
  needs_review: boolean;
  manually_corrected: boolean;
  corrected_by: string | null;
  corrected_at: Date | null;
  warnings: string[];
  created_at: Date;
  updated_at: Date;
}
