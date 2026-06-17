// Historial basico de una ejecucion de generacion (SPEC 004, 13.5).

import type { GenerationMode } from './generationMetadata.js';
import type { QuestionGenerationErrorCode } from '../generation/generationErrors.js';

export const GENERATION_RUN_STATUSES = [
  'completed', // se crearon todas las preguntas pedidas
  'partial', // se crearon algunas; otras se descartaron (duplicados/invalidas)
  'failed', // no se creo ninguna
] as const;
export type GenerationRunStatus = (typeof GENERATION_RUN_STATUSES)[number];

export interface QuestionGenerationRun {
  id: string;
  material_id: string | null;
  topic_id: string | null;
  mode: GenerationMode;
  requested_count: number;
  created_count: number;
  status: GenerationRunStatus;
  errors: QuestionGenerationErrorCode[];
  /** Proveedor IA usado (SPEC 018.4, 23). P.ej. `mock`, `anthropic`. */
  provider: string;
  /** Modelo concreto, si aplica (null en mock). */
  model: string | null;
  /** Si la generacion uso feedback de revisiones anteriores. */
  feedback_used: boolean;
  created_at: Date;
}
