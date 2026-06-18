// Tipos del proveedor de indice de temario (SPEC 019, 16). El proveedor SOLO
// propone una estructura: no crea temas reales ni genera preguntas.

import type { MaterialType } from '../models/enums.js';

// Material que entra al analisis (ya con texto extraido, recortado por el servicio).
export interface SyllabusMaterialInput {
  id: string;
  title: string;
  type: MaterialType;
  text: string;
  /** Ruta de carpeta original del material (SPEC 028); pista para sugerir temas. */
  folder_path?: string | null;
}

export interface SyllabusIndexProviderInput {
  opposition_title: string | null;
  materials: SyllabusMaterialInput[];
  max_topics: number;
}

// Nodo (tema/subtema) propuesto por la IA. Arbol anidado por `children`.
export interface AISyllabusTopicNode {
  title: string;
  description?: string | null;
  code?: string | null;
  order: number;
  confidence?: number | null;
  source_material_ids?: string[];
  source_references?: string[];
  children?: AISyllabusTopicNode[];
  warnings?: string[];
}

export interface AIExamPatternSummary {
  material_id: string;
  detected_question_count?: number | null;
  detected_topics?: string[];
  difficulty_notes?: string | null;
  style_notes?: string | null;
  /** Notas de cobertura tematica aproximada del examen (SPEC 028). */
  coverage_notes?: string | null;
  warnings?: string[];
}

export interface SyllabusIndexOutput {
  title: string;
  summary: string;
  topics: AISyllabusTopicNode[];
  /** Ids de materiales que la IA no ha sabido clasificar (SPEC 019, 21). */
  unclassified_material_ids?: string[];
  /** Tests/examenes antiguos como CONTEXTO, no como banco de preguntas (SPEC 019, 15). */
  exam_patterns?: AIExamPatternSummary[];
  warnings?: string[];
  provider: string;
  model: string | null;
}

export interface SyllabusIndexProvider {
  readonly name: string;
  readonly model: string | null;
  proposeIndex(input: SyllabusIndexProviderInput): Promise<SyllabusIndexOutput>;
}

// Tipos de material que se tratan como examen/test antiguo (contexto, no temas).
export const EXAM_MATERIAL_TYPES: MaterialType[] = ['old_test', 'official_exam'];
