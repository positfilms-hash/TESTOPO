// Contrato de persistencia del historial de generacion (SPEC 004, 13.5).

import type { QuestionGenerationRun } from '../models/questionGenerationRun.js';

export interface GenerationRunRepository {
  create(run: QuestionGenerationRun): QuestionGenerationRun;
  findAll(): QuestionGenerationRun[];
  findById(id: string): QuestionGenerationRun | null;
}
