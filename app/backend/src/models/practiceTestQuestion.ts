// Pregunta incluida en un test de practica (SPEC 007, seccion 8).
// Apunta SIEMPRE a una pregunta `validated` del banco (SPEC 001).

export interface PracticeTestQuestion {
  id: string;
  test_id: string;
  question_id: string;
  /** Orden de aparicion de la pregunta en el test. */
  order: number;
  /** Ids de las opciones en el orden (barajado) en que se muestran. */
  options_order: string[];
  created_at: Date;
}
