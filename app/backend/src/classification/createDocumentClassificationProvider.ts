// Factory del proveedor de clasificacion documental (SPEC 028-B, 14).
//
//   AI_PROVIDER=openai -> OpenAiDocumentClassifier (requiere OPENAI_API_KEY)
//   resto / sin config -> HeuristicDocumentClassifier (determinista, sin red)
//
// El heuristico es el defecto seguro: CI/tests nunca dependen de APIs externas, y
// si no hay IA configurada la app sigue clasificando con heuristica basica.

import type { EnvLike } from '../generation/generationConfig.js';
import type { DocumentClassificationProvider } from './documentClassificationTypes.js';
import { HeuristicDocumentClassifier } from './heuristicDocumentClassifier.js';
import { OpenAiDocumentClassifier } from './openAiDocumentClassifier.js';

function readProcessEnv(): EnvLike {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvLike;
  }
  return {};
}

export function createDocumentClassificationProvider(
  env: EnvLike = readProcessEnv(),
): DocumentClassificationProvider {
  const provider = (env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (provider === 'openai' && isNonEmptyString(env.OPENAI_API_KEY)) {
    return new OpenAiDocumentClassifier({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    });
  }
  // Heuristico por defecto y como fallback si openai no esta bien configurado.
  return new HeuristicDocumentClassifier();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
