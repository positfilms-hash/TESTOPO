// Factory del proveedor de indice anclado a documentos (SPEC 028-D).
//
//   AI_PROVIDER=openai -> OpenAiDocumentGroundedIndexProvider (OPENAI_API_KEY)
//   resto / sin config -> MockDocumentGroundedIndexProvider (determinista, sin red)
//
// El mock es el defecto seguro: CI/tests nunca dependen de APIs externas.

import type { EnvLike } from './generationConfig.js';
import type { DocumentGroundedIndexProvider } from './documentGroundedIndexTypes.js';
import { MockDocumentGroundedIndexProvider } from './mockDocumentGroundedIndexProvider.js';
import { OpenAiDocumentGroundedIndexProvider } from './openAiDocumentGroundedIndexProvider.js';
import {
  SyllabusIndexError,
  SyllabusIndexErrorCode,
} from '../syllabus/syllabusIndexErrors.js';

function readProcessEnv(): EnvLike {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvLike;
  }
  return {};
}

export function createDocumentGroundedIndexProvider(
  env: EnvLike = readProcessEnv(),
): DocumentGroundedIndexProvider {
  const provider = (env.AI_PROVIDER ?? 'mock').trim().toLowerCase();
  switch (provider) {
    case '':
    case 'mock':
      return new MockDocumentGroundedIndexProvider();
    case 'openai': {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new SyllabusIndexError(
          [SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED],
          'AI_PROVIDER=openai requiere OPENAI_API_KEY',
        );
      }
      return new OpenAiDocumentGroundedIndexProvider({
        apiKey,
        model: env.OPENAI_MODEL,
      });
    }
    default:
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED],
        `AI_PROVIDER no soportado para el indice anclado: ${provider}`,
      );
  }
}
