// Intento de realizacion de un test de practica (SPEC 008, seccion 6).
// Para el MVP no hay usuarios: el intento existe sin `user_id`.

export const TEST_ATTEMPT_STATUSES = [
  'in_progress',
  'submitted',
  'cancelled',
] as const;
export type TestAttemptStatus = (typeof TEST_ATTEMPT_STATUSES)[number];

export interface TestAttempt {
  id: string;
  test_id: string;
  /** Oposicion del test (SPEC 010). Obligatorio. */
  opposition_id: string;
  /** Usuario que realiza el intento (SPEC 010). `null` si no hay usuario. */
  user_id: string | null;
  status: TestAttemptStatus;
  started_at: Date;
  /** Vacio mientras el intento esta `in_progress`. */
  submitted_at: Date | null;
  /** Puntuacion simple: `score = correct_count` (sin penalizacion). */
  score: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  created_at: Date;
  updated_at: Date;
}
