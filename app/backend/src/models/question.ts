// Modelo de pregunta tipo test de respuesta unica (SPEC 001, seccion 6).
//
// Los campos opcionales (explanation, source, topic, difficulty,
// correct_answer) pueden estar vacios mientras la pregunta esta en `draft`.
// La regla central del proyecto es que NINGUNA pregunta puede pasar a
// `validated` sin todos ellos; esa regla vive en `validation/validateQuestion`.

import type { Difficulty, QuestionStatus } from './enums.js';
import type { Option } from './option.js';
import type { Source } from './source.js';
import type { GenerationMetadata } from './generationMetadata.js';

export interface Question {
  id: string;
  statement: string;
  options: Option[];
  /**
   * Referencia a la opcion correcta (su `id`). Se deriva de la unica opcion
   * con `is_correct === true`; es `null` mientras no haya exactamente una.
   */
  correct_answer: string | null;
  explanation: string | null;
  source: Source | null;
  /** Tema en texto (SPEC 001). Sigue siendo el valor visible/obligatorio. */
  topic: string | null;
  /**
   * Vinculo opcional al `Topic` registrado del mapa del temario (SPEC 003).
   * Cuando esta presente, una pregunta no puede validarse si ese tema esta
   * `obsolete`. Es aditivo: no sustituye a `topic`.
   */
  topic_id?: string | null;
  difficulty: Difficulty | null;
  status: QuestionStatus;
  /**
   * Trazabilidad de generacion (SPEC 004). Presente solo en preguntas creadas
   * por el generador de borradores; las preguntas manuales lo dejan vacio.
   */
  generation_metadata?: GenerationMetadata | null;
  created_at: Date;
  updated_at: Date;
}
