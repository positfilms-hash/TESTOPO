// Factory de proveedor de generacion (SPEC 018.4 / 018.4-B).
//
// Selecciona el proveedor segun variables de entorno. OpenAI es el proveedor
// PRINCIPAL recomendado; Anthropic queda como alternativa; `mock` es el de
// tests/desarrollo local y el valor por defecto seguro (CI no depende de APIs):
//
//   AI_PROVIDER=openai     -> OpenAiQuestionGenerationProvider   (OPENAI_API_KEY/OPENAI_MODEL)
//   AI_PROVIDER=anthropic  -> AnthropicQuestionGenerationProvider(ANTHROPIC_API_KEY/ANTHROPIC_MODEL)
//   AI_PROVIDER=mock       -> MockQuestionGenerationProvider
//   sin configuracion      -> mock
//
// Compatibilidad temporal: si no hay ANTHROPIC_API_KEY/ANTHROPIC_MODEL se cae a
// las antiguas AI_API_KEY/AI_MODEL. Las claves NO se hardcodean: solo de entorno.

import type { QuestionGenerationProvider } from './generationTypes.js';
import { MockQuestionGenerationProvider } from './mockQuestionGenerationProvider.js';
import { OpenAiQuestionGenerationProvider } from './openAiQuestionGenerationProvider.js';
import { AnthropicQuestionGenerationProvider } from './anthropicQuestionGenerationProvider.js';
import { AiProviderError, AiProviderErrorCode } from './aiProviderErrors.js';
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
    case 'openai': {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new AiProviderError(
          AiProviderErrorCode.OPENAI_API_KEY_MISSING,
          'AI_PROVIDER=openai requiere OPENAI_API_KEY (no se puede hardcodear)',
        );
      }
      return new OpenAiQuestionGenerationProvider({
        apiKey,
        model: env.OPENAI_MODEL,
      });
    }
    case 'anthropic': {
      // Compatibilidad: ANTHROPIC_* nuevo, AI_* antiguo (SPEC 018.4).
      const apiKey = env.ANTHROPIC_API_KEY ?? env.AI_API_KEY;
      if (!apiKey) {
        throw new AiProviderError(
          AiProviderErrorCode.ANTHROPIC_API_KEY_MISSING,
          'AI_PROVIDER=anthropic requiere ANTHROPIC_API_KEY (no se puede hardcodear)',
        );
      }
      return new AnthropicQuestionGenerationProvider({
        apiKey,
        model: env.ANTHROPIC_MODEL ?? env.AI_MODEL,
      });
    }
    default:
      throw new AiProviderError(
        AiProviderErrorCode.PROVIDER_INVALID,
        `AI_PROVIDER no soportado: ${provider}`,
      );
  }
}
