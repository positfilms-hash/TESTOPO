// SPEC 033: cliente del frontend para la generacion de preguntas en SERVIDOR.
// En modo Supabase, la generacion real corre en la Edge Function autenticada
// `generate-questions`. El navegador SOLO envia IDs y parametros acotados; jamas
// texto, fuente, prompt, `user_id` ni secretos. La clave del proveedor y la
// clave de servicio viven exclusivamente en el servidor (nunca en el bundle).
//
// Reutiliza el contrato COMPARTIDO (`supabase/functions/_shared/...`) para que la
// forma del body y los codigos de error sean una unica fuente de verdad con la
// Edge Function.

import { getSupabase, isSupabaseConfigured } from '../auth/supabaseClient.js';
import { requestedPersistenceMode } from '../store/supabaseGateway.js';
import {
  QG_ERROR,
  validateGenerateRequest,
  type Difficulty,
  type SourceMode,
} from '../../../../supabase/functions/_shared/question-generation/contract';

// ¿La generacion debe ir al servidor (Supabase) en vez de en proceso (InMemory)?
export function shouldUseServerGeneration(): boolean {
  return (
    requestedPersistenceMode().toLowerCase() === 'supabase' && isSupabaseConfigured()
  );
}

export interface ServerGenerationInput {
  workspace_id: string;
  opposition_id: string;
  topic_id: string;
  difficulty: Difficulty;
  question_count: number;
  source_mode?: SourceMode;
  selected_source_reference_ids?: string[];
  selected_material_section_ids?: string[];
}

export interface ServerGenerationSummary {
  run_id: string | null;
  created: number;
  requested: number;
  warnings: string[];
}

export class ServerGenerationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServerGenerationError';
  }
}

// Mensajes SEGUROS y humanos por codigo (sin filtrar prompts ni internals).
const MESSAGES: Record<string, string> = {
  [QG_ERROR.AUTH_REQUIRED]: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  [QG_ERROR.ACCESS_DENIED]: 'No tienes permisos para generar en esta oposición.',
  [QG_ERROR.TOPIC_NOT_FOUND]: 'El tema seleccionado no existe en esta oposición.',
  [QG_ERROR.TOPIC_NOT_APPLIED]:
    'El tema no está aplicado. Aplica el índice de temario antes de generar.',
  [QG_ERROR.NO_SOURCES]:
    'Este tema no tiene fuentes elegibles. Clasifica y secciona el material de estudio primero.',
  [QG_ERROR.SOURCE_REQUIRED]: 'No se puede generar sin una fuente concreta.',
  [QG_ERROR.ARBITRARY_TEXT_FORBIDDEN]:
    'Petición no válida: no se permite enviar texto o fuentes desde el navegador.',
  [QG_ERROR.PROVIDER_NOT_CONFIGURED]:
    'La generación de preguntas todavía no está configurada en servidor.',
  [QG_ERROR.PROVIDER_FAILED]:
    'El proveedor de IA no pudo completar la generación. Inténtalo de nuevo más tarde.',
  [QG_ERROR.NO_VALID_CANDIDATES]:
    'No se obtuvieron preguntas válidas con fuente. No se ha creado ninguna candidata.',
  [QG_ERROR.INVALID_OUTPUT]:
    'La respuesta del generador no era válida. No se ha creado ninguna candidata.',
  [QG_ERROR.SAVE_FAILED]: 'No se pudieron guardar las candidatas. Inténtalo de nuevo.',
  [QG_ERROR.INVALID_REQUEST]: 'Petición no válida.',
};

function safeMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || 'No se pudo generar. Inténtalo de nuevo.';
}

// Llama a la Edge Function autenticada. Construye el body SOLO con campos
// permitidos y lo valida con el contrato compartido ANTES de enviarlo (defensa
// en profundidad: el navegador nunca debe mandar texto/fuente arbitrarios).
export async function generateQuestionsViaEdgeFunction(
  input: ServerGenerationInput,
): Promise<ServerGenerationSummary> {
  const body = {
    workspace_id: input.workspace_id,
    opposition_id: input.opposition_id,
    topic_id: input.topic_id,
    difficulty: input.difficulty,
    question_count: input.question_count,
    source_mode: input.source_mode ?? 'topic_sources',
    selected_source_reference_ids: input.selected_source_reference_ids ?? [],
    selected_material_section_ids: input.selected_material_section_ids ?? [],
  };

  const check = validateGenerateRequest(body);
  if (!check.ok) {
    throw new ServerGenerationError(check.code, safeMessage(check.code));
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke('generate-questions', {
    body,
  });

  if (error) {
    const code = await readErrorCode(error);
    throw new ServerGenerationError(code ?? 'UNKNOWN', safeMessage(code));
  }

  const summary = (data ?? {}) as Partial<ServerGenerationSummary>;
  return {
    run_id: typeof summary.run_id === 'string' ? summary.run_id : null,
    created: typeof summary.created === 'number' ? summary.created : 0,
    requested:
      typeof summary.requested === 'number' ? summary.requested : input.question_count,
    warnings: Array.isArray(summary.warnings) ? summary.warnings.map(String) : [],
  };
}

// Lee el codigo de error del cuerpo de la respuesta de la Edge Function, si lo
// hay (mismo patron que authService.mapDeleteError).
async function readErrorCode(error: unknown): Promise<string | undefined> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = (await ctx.json()) as { error?: string };
      return payload?.error;
    }
  } catch {
    // cuerpo no JSON: codigo desconocido -> mensaje generico.
  }
  return undefined;
}
