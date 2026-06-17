// Tipos de la generacion de preguntas (SPEC 004, secciones 7, 8 y 10).

import type { Difficulty } from '../models/enums.js';
import type {
  GenerationMode,
  RequestedDifficulty,
} from '../models/generationMetadata.js';
import type { QuestionGenerationFeedbackSummary } from '../models/questionReviewFeedback.js';

// Solicitud generica de generacion. Los wrappers del servicio rellenan `mode`.
export interface GenerateQuestionsRequest {
  mode: GenerationMode;
  /** Oposicion (SPEC 010). Para modos con material se infiere del material. */
  opposition_id?: string | null;
  material_id?: string | null;
  topic_id?: string | null;
  difficulty: RequestedDifficulty;
  question_count: number;
  reference?: string | null;
  /** Fragmento concreto (modo `from_material_excerpt`). */
  excerpt?: string | null;
  /** Texto pegado manualmente (modo `manual_seed`). */
  manual_text?: string | null;
}

// Contexto que recibe el proveedor para generar. No incluye secretos.
export interface GenerationContext {
  text: string;
  reference: string | null;
  difficulty: RequestedDifficulty;
  count: number;
  topic_title: string | null;
  /**
   * Resumen de errores detectados en revisiones anteriores (SPEC 018.4, 15-16).
   * El proveedor lo usa como contexto adicional para evitar repetir fallos.
   * No es entrenamiento: es mejora por contexto y reglas.
   */
  previous_feedback?: QuestionGenerationFeedbackSummary[];
}

export interface GeneratedOption {
  text: string;
  is_correct: boolean;
}

// Candidato crudo devuelto por el proveedor, antes de validar y guardar.
export interface GeneratedCandidate {
  statement: string;
  options: GeneratedOption[];
  explanation: string;
  difficulty: Difficulty;
  /**
   * Fragmento exacto del material en el que se basa la pregunta (SPEC 018.4,
   * 9-11, regla 5). Lo aporta la IA real; el servicio lo conserva en la fuente.
   * Opcional: el mock y el modo manual no lo rellenan.
   */
  source_excerpt?: string | null;
  /** Referencia exacta de la fuente indicada por la IA (articulo, apartado…). */
  source_reference?: string | null;
}

// Proveedor desacoplado de generacion (SPEC 004, 10; SPEC 018.4, 8). Permite
// enchufar una IA real (o el mock de tests) sin reescribir la orquestacion.
// `generate` es asincrono (SPEC 018.3/018.4): una IA real llama por red.
export interface QuestionGenerationProvider {
  /** Version del generador, para trazabilidad de la pregunta. */
  readonly version: string;
  /** Nombre del proveedor (p.ej. `mock`, `anthropic`). */
  readonly name: string;
  /** Modelo concreto usado, si aplica (null en mock). */
  readonly model: string | null;
  generate(context: GenerationContext): Promise<GeneratedCandidate[]>;
}
