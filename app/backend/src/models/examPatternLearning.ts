// Modelos de aprendizaje de patrones de examen (SPEC 028-F).
//
// La IA aprende ESTILO/dificultad/formato/cobertura de los examenes antiguos y
// del feedback humano para mejorar la generacion anclada a fuentes (028-E), SIN
// dejar de usar el material primario como UNICA fuente factual. Es contexto de
// prompt adaptativo: NO fine-tuning, OCR, RAG, embeddings ni almacen vectorial.
// Aqui solo viven AGREGADOS y huellas anti-copia; nunca un banco copiable ni
// enunciados verbatim de examenes antiguos. Ninguna candidata nace `validated`.

import type { Difficulty } from './enums.js';

// =====================================================================
// Ejecucion de analisis de patrones (cuando los runs existentes no bastan).
// =====================================================================
export const EXAM_PATTERN_RUN_STATUSES = [
  'pending',
  'processing',
  'completed',
  'completed_with_warnings',
  'failed',
] as const;
export type ExamPatternRunStatus = (typeof EXAM_PATTERN_RUN_STATUSES)[number];

export interface ExamPatternAnalysisRun {
  id: string;
  workspace_id: string | null;
  opposition_id: string;
  created_by: string | null;
  status: ExamPatternRunStatus;
  provider: string;
  model: string | null;
  input_material_ids: string[];
  input_section_ids: string[];
  old_exam_count: number;
  analyzed_question_count: number;
  warnings: string[];
  errors: string[];
  created_at: Date;
  updated_at: Date;
}

// =====================================================================
// Reglas agregadas de estilo (lo que se inyecta como CONTEXTO, no como hecho).
// Distribuciones/recuentos; nunca contenido copiable.
// =====================================================================
export interface StyleProfileRules {
  /** Frecuencia por numero de opciones: "4" -> 0.8. */
  option_count_distribution: Record<string, number>;
  /** Frecuencia por dificultad observada. */
  difficulty_distribution: Partial<Record<Difficulty, number>>;
  /** Tipos de pregunta recurrentes (p. ej. "negativa", "excepto", "caso"). */
  common_question_types: string[];
  /** Patrones de trampa/distractor recurrentes (descriptivos, no verbatim). */
  trap_patterns: string[];
  /** Proporcion legal vs conceptual (0..1 cada uno). */
  legal_vs_conceptual: { legal: number; conceptual: number };
  /** Longitud de enunciado observada (caracteres). */
  statement_length: { min: number; max: number; avg: number } | null;
  /** Notas de estilo/redaccion agregadas. */
  style_notes: string | null;
}

// =====================================================================
// Perfil de estilo versionado (humano-activado; 1 activo por oposicion).
// =====================================================================
export const STYLE_PROFILE_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'rejected',
  'superseded',
] as const;
export type StyleProfileStatus = (typeof STYLE_PROFILE_STATUSES)[number];

export interface QuestionStyleProfile {
  id: string;
  workspace_id: string | null;
  opposition_id: string;
  /** Version incremental por oposicion. */
  version: number;
  status: StyleProfileStatus;
  /** ExamPatternSummary (SPEC 019/028) seleccionados para el perfil. */
  selected_summary_ids: string[];
  rules: StyleProfileRules;
  /** Enunciados normalizados de examenes antiguos para el chequeo ANTI-COPIA
   *  (no es contenido copiable; sirve para rechazar candidatas demasiado
   *  parecidas). */
  fingerprints: string[];
  /** Cobertura tematica agregada (notas por tema/aprobados). */
  coverage_notes: string | null;
  confidence: number | null;
  warnings: string[];
  created_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// =====================================================================
// Patron de examen por tema (cuando hay datos suficientes).
// =====================================================================
export interface TopicExamPattern {
  id: string;
  workspace_id: string | null;
  opposition_id: string;
  topic_id: string;
  /** Perfil de estilo al que pertenece (scope). */
  style_profile_id: string | null;
  frequency_score: number | null;
  difficulty_score: number | null;
  common_question_types: string[];
  trap_patterns: string[];
  style_notes: string | null;
  coverage_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// =====================================================================
// Memoria de errores IA: entradas auditables derivadas de
// feedback/review/validacion, con una instruccion de "evitar".
// =====================================================================
export const AI_ERROR_MEMORY_SOURCES = [
  'review_feedback',
  'review_outcome',
  'validation',
] as const;
export type AIErrorMemorySource = (typeof AI_ERROR_MEMORY_SOURCES)[number];

export interface AIErrorMemory {
  id: string;
  workspace_id: string | null;
  opposition_id: string;
  topic_id: string | null;
  material_id: string | null;
  /** Tipo (taxonomia de feedback o categoria de validacion). */
  type: string;
  severity: string;
  summary: string;
  /** Instruccion concreta para el generador ("evita ..."). */
  avoid_instruction: string;
  source: AIErrorMemorySource;
  /** Numero de observaciones que respaldan la entrada. */
  occurrences: number;
  created_at: Date;
  updated_at: Date;
}

// =====================================================================
// Puntuacion de calidad por candidata (transparente; NUNCA aprueba/valida).
// Componentes en [0,1].
// =====================================================================
export interface AIQuestionQualityScore {
  id: string;
  question_id: string;
  run_id: string | null;
  workspace_id: string | null;
  opposition_id: string | null;
  source_grounding: number;
  exam_style_similarity: number;
  clarity: number;
  single_answer_confidence: number;
  difficulty_fit: number;
  overall: number;
  warnings: string[];
  created_at: Date;
  updated_at: Date;
}
