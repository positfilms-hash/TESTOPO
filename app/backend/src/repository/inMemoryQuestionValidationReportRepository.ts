// Historial en memoria de informes de validacion (SPEC 005). Guarda todos los
// informes y permite recuperar el ultimo por pregunta.

import type { QuestionValidationResult } from '../models/questionValidationResult.js';
import type { QuestionValidationReportRepository } from './questionValidationReportRepository.js';

export class InMemoryQuestionValidationReportRepository
  implements QuestionValidationReportRepository
{
  private readonly reports: QuestionValidationResult[] = [];

  async save(result: QuestionValidationResult): Promise<QuestionValidationResult> {
    this.reports.push(clone(result));
    return clone(result);
  }

  async findLastByQuestion(questionId: string): Promise<QuestionValidationResult | null> {
    for (let i = this.reports.length - 1; i >= 0; i--) {
      const report = this.reports[i];
      if (report.question_id === questionId) {
        return clone(report);
      }
    }
    return null;
  }
}

function clone(
  result: QuestionValidationResult,
): QuestionValidationResult {
  return structuredClone(result);
}
