// Contrato de persistencia del historial de generacion (SPEC 004, 13.5).

import type { QuestionGenerationRun } from '../models/questionGenerationRun.js';

export interface GenerationRunRepository {
  create(run: QuestionGenerationRun): Promise<QuestionGenerationRun>;
  findAll(): Promise<QuestionGenerationRun[]>;
  findById(id: string): Promise<QuestionGenerationRun | null>;
}
