// Contrato del historial de informes de validacion (SPEC 005, 10.5).

import type { QuestionValidationResult } from '../models/questionValidationResult.js';

export interface QuestionValidationReportRepository {
  save(result: QuestionValidationResult): QuestionValidationResult;
  // Ultimo informe guardado para una pregunta, o null si no hay ninguno.
  findLastByQuestion(questionId: string): QuestionValidationResult | null;
}
