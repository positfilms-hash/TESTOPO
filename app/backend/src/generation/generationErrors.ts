// Codigos de error de la generacion de borradores (SPEC 004, seccion 12).
// Los valores de cadena son contractuales y deben coincidir con la spec.

export enum QuestionGenerationErrorCode {
  MATERIAL_REQUIRED = 'QUESTION_GENERATION_MATERIAL_REQUIRED',
  MATERIAL_NOT_FOUND = 'QUESTION_GENERATION_MATERIAL_NOT_FOUND',
  MATERIAL_OBSOLETE = 'QUESTION_GENERATION_MATERIAL_OBSOLETE',
  TOPIC_NOT_FOUND = 'QUESTION_GENERATION_TOPIC_NOT_FOUND',
  TOPIC_OBSOLETE = 'QUESTION_GENERATION_TOPIC_OBSOLETE',
  CONTENT_REQUIRED = 'QUESTION_GENERATION_CONTENT_REQUIRED',
  INVALID_DIFFICULTY = 'QUESTION_GENERATION_INVALID_DIFFICULTY',
  INVALID_COUNT = 'QUESTION_GENERATION_INVALID_COUNT',
  MAX_COUNT_EXCEEDED = 'QUESTION_GENERATION_MAX_COUNT_EXCEEDED',
  INVALID_MODE = 'QUESTION_GENERATION_INVALID_MODE',
  EMPTY_RESULT = 'QUESTION_GENERATION_EMPTY_RESULT',
  INVALID_OUTPUT = 'QUESTION_GENERATION_INVALID_OUTPUT',
  DUPLICATE_STATEMENT = 'QUESTION_GENERATION_DUPLICATE_STATEMENT',
  SOURCE_REQUIRED = 'QUESTION_GENERATION_SOURCE_REQUIRED',
  EXPLANATION_REQUIRED = 'QUESTION_GENERATION_EXPLANATION_REQUIRED',
  // SPEC 028-E: no hay ninguna fuente primaria elegible para el tema.
  NO_SOURCES = 'QUESTION_GENERATION_NO_SOURCES',
  // SPEC 028-E: el tema es obligatorio para la generacion anclada a fuentes.
  TOPIC_REQUIRED = 'QUESTION_GENERATION_TOPIC_REQUIRED',
  // SPEC 028-E: una candidata referencia una fuente ajena/inexistente.
  FOREIGN_SOURCE = 'QUESTION_GENERATION_FOREIGN_SOURCE',
  // Revision Codex: el fragmento pegado no esta contenido en el texto del
  // material seleccionado (no se puede anclar a una fuente real).
  EXCERPT_NOT_IN_SOURCE = 'QUESTION_GENERATION_EXCERPT_NOT_IN_SOURCE',
  // Revision Codex: una candidata no se pudo persistir/finalizar de forma fiable
  // (fallo parcial). Se registra en el run y la candidata nunca queda en `draft`.
  PERSIST_FAILED = 'QUESTION_GENERATION_PERSIST_FAILED',
  // Revision Codex (staging): no hay proveedor de IA real configurado. NO se
  // generan candidatas con el mock como si fueran reales; se bloquea con aviso.
  AI_NOT_CONFIGURED = 'QUESTION_GENERATION_AI_NOT_CONFIGURED',
}

// Limites de numero de preguntas por solicitud (SPEC 004, 7 y 9.7).
export const MIN_QUESTION_COUNT = 1;
export const MAX_QUESTION_COUNT = 20;
