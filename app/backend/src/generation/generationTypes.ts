// Tipos de la generacion de preguntas (SPEC 004, secciones 7, 8 y 10).

import type { Difficulty } from '../models/enums.js';
import type {
  GenerationMode,
  RequestedDifficulty,
} from '../models/generationMetadata.js';

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
}

// Proveedor desacoplado de generacion (SPEC 004, 10). Permite enchufar una IA
// real en el futuro sin reescribir la logica de orquestacion.
export interface QuestionGenerationProvider {
  readonly version: string;
  generate(context: GenerationContext): GeneratedCandidate[];
}
