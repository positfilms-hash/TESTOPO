// Respuesta del usuario a una pregunta de un intento (SPEC 008, seccion 8).

export interface TestAnswer {
  id: string;
  attempt_id: string;
  test_question_id: string;
  question_id: string;
  /** Opcion elegida. `null` si la pregunta no se ha respondido. */
  selected_option_id: string | null;
  /** Se calcula al enviar el test; `null` mientras esta `in_progress`. */
  is_correct: boolean | null;
  answered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
