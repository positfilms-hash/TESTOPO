// Modelos del constructor de indice de temario con IA (SPEC 019).
//
// La IA SOLO propone: el flujo es Run -> Proposal (+ nodos + sugerencias) ->
// revision humana -> aprobacion -> aplicacion al Topic Map (SPEC 003). Ningun
// estado se aplica sin una accion humana explicita.

// --- Ejecucion de analisis (SPEC 019, 11) ---
export const SYLLABUS_RUN_STATUSES = [
  'pending',
  'processing',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
] as const;
export type SyllabusRunStatus = (typeof SYLLABUS_RUN_STATUSES)[number];

export interface SyllabusIndexRun {
  id: string;
  workspace_id: string | null;
  opposition_id: string;
  created_by: string | null;
  status: SyllabusRunStatus;
  provider: string;
  model: string | null;
  /** Materiales considerados para el analisis. */
  material_ids: string[];
  input_summary: string;
  total_materials: number;
  analyzed_materials: number;
  ignored_materials: number;
  proposed_topics_count: number;
  warnings: string[];
  errors: string[];
  created_at: Date;
  updated_at: Date;
}

// --- Propuesta de indice (SPEC 019, 12) ---
export const SYLLABUS_PROPOSAL_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'applied',
] as const;
export type SyllabusProposalStatus = (typeof SYLLABUS_PROPOSAL_STATUSES)[number];

export interface SyllabusIndexProposal {
  id: string;
  run_id: string;
  workspace_id: string | null;
  opposition_id: string;
  title: string;
  summary: string | null;
  status: SyllabusProposalStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  applied_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// --- Nodo (tema/subtema) propuesto (SPEC 019, 13) ---
export const SYLLABUS_NODE_STATUSES = [
  'proposed',
  'edited',
  'accepted',
  'rejected',
  'merged',
] as const;
export type SyllabusNodeStatus = (typeof SYLLABUS_NODE_STATUSES)[number];

export interface SyllabusIndexNodeProposal {
  id: string;
  proposal_id: string;
  /** Nodo padre dentro de la propuesta; null en un nodo raiz. */
  parent_id: string | null;
  title: string;
  description: string | null;
  code: string | null;
  order: number;
  /** Confianza opcional 0..1. Nunca aprueba nada automaticamente. */
  confidence: number | null;
  source_material_ids: string[];
  source_references: string[];
  warnings: string[];
  status: SyllabusNodeStatus;
  created_at: Date;
  updated_at: Date;
}

// --- Sugerencia de asociacion material-tema (SPEC 019, 14) ---
export const MATERIAL_SUGGESTION_STATUSES = [
  'suggested',
  'accepted',
  'rejected',
  'unclassified',
] as const;
export type MaterialSuggestionStatus =
  (typeof MATERIAL_SUGGESTION_STATUSES)[number];

export interface MaterialTopicSuggestion {
  id: string;
  run_id: string;
  /** Nodo propuesto al que se sugiere asociar el material; null si sin clasificar. */
  proposal_node_id: string | null;
  material_id: string;
  confidence: number | null;
  reason: string | null;
  status: MaterialSuggestionStatus;
  created_at: Date;
  updated_at: Date;
}

// --- Resumen de patron de examen (SPEC 019, 15). Contexto, NO banco de preguntas. ---
// SPEC 028 anade scope (`workspace_id`/`opposition_id`), el lote de subida que lo
// origino (`batch_id`) y notas de cobertura (`coverage_notes`).
export interface ExamPatternSummary {
  id: string;
  run_id: string;
  workspace_id: string | null;
  opposition_id: string | null;
  /** Lote de subida masiva que origino el analisis (SPEC 028); null si no aplica. */
  batch_id: string | null;
  material_id: string;
  detected_question_count: number | null;
  detected_topics: string[];
  difficulty_notes: string | null;
  style_notes: string | null;
  /** Notas de cobertura tematica aproximada del examen (SPEC 028). */
  coverage_notes: string | null;
  warnings: string[];
  created_at: Date;
  updated_at: Date;
}
