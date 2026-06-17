// Errores del proveedor de IA (SPEC 018.4-B, 17). Codigos contractuales para
// distinguir fallos de configuracion, llamada y formato de respuesta.

export enum AiProviderErrorCode {
  PROVIDER_NOT_CONFIGURED = 'AI_PROVIDER_NOT_CONFIGURED',
  PROVIDER_INVALID = 'AI_PROVIDER_INVALID',
  OPENAI_API_KEY_MISSING = 'OPENAI_API_KEY_MISSING',
  ANTHROPIC_API_KEY_MISSING = 'ANTHROPIC_API_KEY_MISSING',
  OPENAI_GENERATION_FAILED = 'OPENAI_GENERATION_FAILED',
  OPENAI_INVALID_RESPONSE = 'OPENAI_INVALID_RESPONSE',
  OPENAI_EMPTY_RESPONSE = 'OPENAI_EMPTY_RESPONSE',
  AI_OUTPUT_SCHEMA_INVALID = 'AI_OUTPUT_SCHEMA_INVALID',
  AI_GENERATED_TOO_FEW_QUESTIONS = 'AI_GENERATED_TOO_FEW_QUESTIONS',
  AI_GENERATED_QUESTION_INVALID = 'AI_GENERATED_QUESTION_INVALID',
}

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;

  constructor(code: AiProviderErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AiProviderError';
    this.code = code;
  }
}
