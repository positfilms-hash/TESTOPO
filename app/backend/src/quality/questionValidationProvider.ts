// Proveedor desacoplado de validacion critica (SPEC 005, 12). Permite enchufar
// en el futuro una IA que detecte riesgos mas sutiles, devolviendo hallazgos
// adicionales. Para el MVP se usa un mock no-op.

import type { Question } from '../models/question.js';
import type { Finding } from './qualityCodes.js';

export interface QuestionValidationProvider {
  readonly version: string;
  // Devuelve hallazgos adicionales (warnings/info normalmente). No debe lanzar.
  review(question: Question): Finding[];
}

// Mock no-op: no añade hallazgos. Sirve de costura para una IA real futura.
export class MockQuestionValidationProvider
  implements QuestionValidationProvider
{
  readonly version = 'mock-validator-1';

  review(_question: Question): Finding[] {
    return [];
  }
}
