// Utilidades de test con datos ficticios (la constitucion prohibe usar
// material real o sensible en fixtures/seeds/tests).

import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import {
  QuestionService,
  type CreateQuestionInput,
} from '../src/service/questionService.js';
import type { Source } from '../src/models/source.js';

// Oposicion ficticia compartida por los tests (SPEC 010).
export const TEST_OPPOSITION_ID = 'opp-test';

export const activeSource: Source = {
  id: 'src-1',
  title: 'Temario ficticio - Tema 1',
  type: 'syllabus',
  reference: 'Tema 1, apartado 2',
  status: 'active',
};

export function validInput(
  overrides: Partial<CreateQuestionInput> = {},
): CreateQuestionInput {
  return {
    opposition_id: TEST_OPPOSITION_ID,
    statement: '¿Cual es la capital ficticia de Ejemploland?',
    options: [
      { text: 'Ciudad A', is_correct: true, order: 0 },
      { text: 'Ciudad B', is_correct: false, order: 1 },
      { text: 'Ciudad C', is_correct: false, order: 2 },
      { text: 'Ciudad D', is_correct: false, order: 3 },
    ],
    explanation: 'Ciudad A es la capital segun el temario ficticio.',
    source: activeSource,
    topic: 'Tema 1',
    difficulty: 'easy',
    ...overrides,
  };
}

// Servicio con reloj e ids deterministas: el reloj avanza un segundo en cada
// llamada para poder comprobar que `updated_at` cambia al editar.
export function makeService(): QuestionService {
  let tick = 0;
  const now = (): Date => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
  let counter = 0;
  const generateId = (): string => `id-${++counter}`;
  return new QuestionService(new InMemoryQuestionRepository(), {
    generateId,
    now,
  });
}
