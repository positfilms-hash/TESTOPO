// Implementacion en memoria del historial de generacion (SPEC 004).

import type { QuestionGenerationRun } from '../models/questionGenerationRun.js';
import type { GenerationRunRepository } from './generationRunRepository.js';

export class InMemoryGenerationRunRepository
  implements GenerationRunRepository
{
  private readonly runs = new Map<string, QuestionGenerationRun>();

  create(run: QuestionGenerationRun): QuestionGenerationRun {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  findAll(): QuestionGenerationRun[] {
    return [...this.runs.values()].map(clone);
  }

  findById(id: string): QuestionGenerationRun | null {
    const run = this.runs.get(id);
    return run ? clone(run) : null;
  }
}

function clone(run: QuestionGenerationRun): QuestionGenerationRun {
  return structuredClone(run);
}
