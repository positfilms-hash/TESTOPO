// Configuracion de la clasificacion documental (SPEC 028-B, 11). El umbral de
// confianza decide cuando una clasificacion necesita revision humana. Valores
// por defecto en la spec; sobreescribibles por entorno (solo servidor).

import type { EnvLike } from '../generation/generationConfig.js';

export const DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.75;
export const DEFAULT_MAX_CLASSIFICATION_INPUT_CHARS = 20000;

export interface DocumentClassificationConfig {
  /** Por debajo de este umbral la clasificacion queda `needs_review`. */
  confidence_threshold: number;
  /** Maximo de caracteres de texto enviados al proveedor por documento. */
  max_input_chars: number;
}

function readProcessEnv(): EnvLike {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvLike;
  }
  return {};
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseThreshold(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function loadDocumentClassificationConfig(
  env: EnvLike = readProcessEnv(),
): DocumentClassificationConfig {
  return {
    confidence_threshold: parseThreshold(
      env.DOCUMENT_CLASSIFICATION_CONFIDENCE_THRESHOLD,
      DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD,
    ),
    max_input_chars: parsePositiveInt(
      env.MAX_DOCUMENT_CLASSIFICATION_INPUT_CHARS,
      DEFAULT_MAX_CLASSIFICATION_INPUT_CHARS,
    ),
  };
}
