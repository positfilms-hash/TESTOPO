// Factory de proveedor de generacion (SPEC 018.4, 8, 20, 21).
//
// Selecciona el proveedor segun variables de entorno, con `mock` por defecto
// para que los tests y el MVP nunca dependan de una API externa real:
//
//   AI_PROVIDER  -> `mock` (defecto) | `anthropic`
//   AI_API_KEY   -> clave (solo `anthropic`)
//   AI_MODEL     -> modelo concreto (solo `anthropic`)
//
// Las claves NO se hardcodean: solo se leen de entorno.

import type { QuestionGenerationProvider } from './generationTypes.js';
import { MockQuestionGenerationProvider } from './mockQuestionGenerationProvider.js';
import { AnthropicQuestionGenerationProvider } from './anthropicQuestionGenerationProvider.js';
import type { EnvLike } from './generationConfig.js';

function readProcessEnv(): EnvLike {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvLike;
  }
  return {};
}

export function createQuestionGenerationProvider(
  env: EnvLike = readProcessEnv(),
): QuestionGenerationProvider {
  const provider = (env.AI_PROVIDER ?? 'mock').trim().toLowerCase();

  switch (provider) {
    case '':
    case 'mock':
      return new MockQuestionGenerationProvider();
    case 'anthropic': {
      const apiKey = env.AI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'AI_PROVIDER=anthropic requiere AI_API_KEY (no se puede hardcodear)',
        );
      }
      return new AnthropicQuestionGenerationProvider({
        apiKey,
        model: env.AI_MODEL,
      });
    }
    default:
      throw new Error(`AI_PROVIDER no soportado: ${provider}`);
  }
}
