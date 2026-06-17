// Factory del proveedor de indice de temario (SPEC 019, usa SPEC 018.4-B).
//
//   AI_PROVIDER=openai  -> OpenAiSyllabusIndexProvider (OPENAI_API_KEY/OPENAI_MODEL)
//   AI_PROVIDER=mock    -> MockSyllabusIndexProvider
//   sin configuracion   -> mock (tests/desarrollo local, sin red)
//
// Mantiene `mock` como defecto seguro: CI nunca depende de APIs externas.

import type { SyllabusIndexProvider } from './syllabusIndexTypes.js';
import { MockSyllabusIndexProvider } from './mockSyllabusIndexProvider.js';
import { OpenAiSyllabusIndexProvider } from './openAiSyllabusIndexProvider.js';
import {
  SyllabusIndexError,
  SyllabusIndexErrorCode,
} from '../syllabus/syllabusIndexErrors.js';
import type { EnvLike } from './generationConfig.js';

function readProcessEnv(): EnvLike {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvLike;
  }
  return {};
}

export function createSyllabusIndexProvider(
  env: EnvLike = readProcessEnv(),
): SyllabusIndexProvider {
  const provider = (env.AI_PROVIDER ?? 'mock').trim().toLowerCase();

  switch (provider) {
    case '':
    case 'mock':
      return new MockSyllabusIndexProvider();
    case 'openai': {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new SyllabusIndexError(
          [SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED],
          'AI_PROVIDER=openai requiere OPENAI_API_KEY',
        );
      }
      return new OpenAiSyllabusIndexProvider({ apiKey, model: env.OPENAI_MODEL });
    }
    default:
      // El indice IA solo soporta openai/mock por ahora (SPEC 019).
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED],
        `AI_PROVIDER no soportado para el indice de temario: ${provider}`,
      );
  }
}
