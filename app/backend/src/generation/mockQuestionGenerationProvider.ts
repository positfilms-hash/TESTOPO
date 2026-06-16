// Proveedor de generacion simulado (SPEC 004, 10). No llama a ninguna IA ni
// servicio externo: produce candidatos deterministas a partir del texto, util
// para el MVP y para los tests. Una IA real implementaria la misma interfaz.

import type { Difficulty } from '../models/enums.js';
import type { RequestedDifficulty } from '../models/generationMetadata.js';
import type {
  GeneratedCandidate,
  GenerationContext,
  QuestionGenerationProvider,
} from './generationTypes.js';

export class MockQuestionGenerationProvider
  implements QuestionGenerationProvider
{
  readonly version = 'mock-generator-1';

  generate(context: GenerationContext): GeneratedCandidate[] {
    const difficulties = distributeDifficulty(
      context.difficulty,
      context.count,
    );
    const snippet = context.text.trim().replace(/\s+/g, ' ').slice(0, 60);
    const prefix = context.topic_title ? `[${context.topic_title}] ` : '';

    return Array.from({ length: context.count }, (_, index) => {
      const n = index + 1;
      return {
        statement: `${prefix}Pregunta ${n}: segun el material ("${snippet}"), cual es la afirmacion correcta?`,
        options: [
          { text: `Afirmacion correcta ${n}`, is_correct: true },
          { text: `Afirmacion incorrecta ${n}-A`, is_correct: false },
          { text: `Afirmacion incorrecta ${n}-B`, is_correct: false },
          { text: `Afirmacion incorrecta ${n}-C`, is_correct: false },
        ],
        explanation: `La afirmacion correcta ${n} se deduce del material proporcionado; las demas no se sostienen con ese material.`,
        difficulty: difficulties[index] ?? 'medium',
      };
    });
  }
}

// Distribucion simple para `mixed` (SPEC 004, 7): 40% easy, 40% medium, 20% hard.
function distributeDifficulty(
  difficulty: RequestedDifficulty,
  count: number,
): Difficulty[] {
  if (difficulty !== 'mixed') {
    return Array.from({ length: count }, () => difficulty);
  }
  const easy = Math.round(count * 0.4);
  const medium = Math.round(count * 0.4);
  const hard = Math.max(0, count - easy - medium);
  return [
    ...Array<Difficulty>(easy).fill('easy'),
    ...Array<Difficulty>(medium).fill('medium'),
    ...Array<Difficulty>(hard).fill('hard'),
  ].slice(0, count);
}
