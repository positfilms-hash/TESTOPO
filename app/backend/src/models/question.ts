// Modelo de pregunta tipo test de respuesta unica (SPEC 001, seccion 6).
//
// Los campos opcionales (explanation, source, topic, difficulty,
// correct_answer) pueden estar vacios mientras la pregunta esta en `draft`.
// La regla central del proyecto es que NINGUNA pregunta puede pasar a
// `validated` sin todos ellos; esa regla vive en `validation/validateQuestion`.

import type { Difficulty, QuestionStatus } from './enums.js';
import type { Option } from './option.js';
import type { Source } from './source.js';

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
  topic: string | null;
  difficulty: Difficulty | null;
  status: QuestionStatus;
  created_at: Date;
  updated_at: Date;
}
