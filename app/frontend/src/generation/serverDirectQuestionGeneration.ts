// SPEC 039: cliente del frontend para la generacion DIRECTA de preguntas desde
// MATERIAL ESTUDIADO. En modo Supabase, la generacion real corre en la Edge
// Function autenticada `generate-questions-from-studied-material`. El navegador
// SOLO envia IDs de alcance y parametros acotados; jamas texto, fuente, extracto,
// prompt, `user_id` ni secretos. La clave del proveedor vive solo en el servidor.
//
// Reutiliza el contrato COMPARTIDO (`supabase/functions/_shared/...`) para que la
// forma del body y los codigos de error sean una unica fuente de verdad con la
// Edge Function. NO depende del flujo por tema (`generate-questions`).

import { getSupabase, isSupabaseConfigured } from '../auth/supabaseClient.js';
import { requestedPersistenceMode } from '../store/supabaseGateway.js';
import {
  DQG_ERROR,
  validateDirectGenerateRequest,
  type DirectScope,
  type RequestDifficulty,
} from '../../../../supabase/functions/_shared/direct-question-generation/contract';

// ¿La generacion directa debe ir al servidor (Supabase) en vez de en proceso?
export function shouldUseServerDirectGeneration(): boolean {
  return requestedPersistenceMode().toLowerCase() === 'supabase' && isSupabaseConfigured();
}

export interface ServerDirectGenerationInput {
  workspace_id: string;
  opposition_id: string;
  scope: DirectScope;
  question_count: number;
  difficulty: RequestDifficulty;
  material_study_run_id?: string | null;
  material_ids?: string[];
  material_study_unit_ids?: string[];
  material_study_concept_ids?: string[];
}

export interface ServerDirectGenerationSummary {
  run_id: string | null;
  study_run_id: string | null;
  created: number;
  requested: number;
  warnings: string[];
  /** Coste estimado de IA del run (tokens + USD), para QA/admin. */
  cost: ServerDirectGenerationCost | null;
}

export interface ServerDirectGenerationCost {
  total_tokens: number;
  estimated_cost_usd: number;
  cost_model: string;
  cost_per_question_usd: number | null;
}

export class ServerDirectGenerationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServerDirectGenerationError';
  }
}

// Mensajes SEGUROS y humanos por codigo (sin filtrar prompts ni internals).
const MESSAGES: Record<string, string> = {
  [DQG_ERROR.AUTH_REQUIRED]: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  [DQG_ERROR.ACCESS_DENIED]: 'No tienes permisos para generar preguntas en esta oposición.',
  [DQG_ERROR.ARBITRARY_INPUT_FORBIDDEN]:
    'Petición no válida: no se permite enviar texto ni fuentes desde el navegador.',
  [DQG_ERROR.STUDY_NOT_READY]:
    'Primero estudia el material. La generación necesita un estudio completado.',
  [DQG_ERROR.NO_EVIDENCE]:
    'El material estudiado no tiene evidencia utilizable para generar preguntas. Revisa el material y vuelve a estudiarlo.',
  [DQG_ERROR.SELECTION_FORBIDDEN]:
    'La selección no pertenece a este material estudiado.',
  [DQG_ERROR.PROVIDER_NOT_CONFIGURED]:
    'La generación de preguntas desde material estudiado todavía no está configurada en servidor.',
  [DQG_ERROR.PROVIDER_FAILED]:
    'El proveedor de IA no pudo completar la generación. Inténtalo de nuevo más tarde.',
  [DQG_ERROR.NO_VALID_CANDIDATES]:
    'No se obtuvieron preguntas válidas con fuente. No se ha creado ninguna candidata.',
  [DQG_ERROR.INVALID_OUTPUT]:
    'La respuesta del generador no era válida. No se ha creado ninguna candidata.',
  [DQG_ERROR.SAVE_FAILED]: 'No se pudieron guardar las candidatas. Inténtalo de nuevo.',
  [DQG_ERROR.COST_LIMIT]:
    'Se alcanzó el límite de coste de IA (por run o diario de esta oposición). Inténtalo más tarde o ajusta el presupuesto.',
  [DQG_ERROR.INVALID_REQUEST]: 'Petición no válida.',
};

function safeMessage(code: string | undefined): string {
  return (
    (code && MESSAGES[code]) ||
    'No se pudieron generar preguntas desde el material estudiado. Inténtalo de nuevo.'
  );
}

// Llama a la Edge Function autenticada. Construye el body SOLO con campos
// permitidos y lo valida con el contrato compartido ANTES de enviarlo (defensa en
// profundidad: el navegador nunca debe mandar texto/fuente arbitrarios).
export async function generateFromStudiedMaterialViaEdgeFunction(
  input: ServerDirectGenerationInput,
): Promise<ServerDirectGenerationSummary> {
  const body: Record<string, unknown> = {
    workspace_id: input.workspace_id,
    opposition_id: input.opposition_id,
    scope: input.scope,
    question_count: input.question_count,
    difficulty: input.difficulty,
    material_ids: input.material_ids ?? [],
    material_study_unit_ids: input.material_study_unit_ids ?? [],
    material_study_concept_ids: input.material_study_concept_ids ?? [],
  };
  if (input.material_study_run_id) {
    body.material_study_run_id = input.material_study_run_id;
  }

  const check = validateDirectGenerateRequest(body);
  if (!check.ok) {
    throw new ServerDirectGenerationError(check.code, safeMessage(check.code));
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(
    'generate-questions-from-studied-material',
    { body },
  );

  if (error) {
    const code = await readErrorCode(error);
    throw new ServerDirectGenerationError(code ?? 'UNKNOWN', safeMessage(code));
  }

  const summary = (data ?? {}) as Partial<ServerDirectGenerationSummary>;
  return {
    run_id: typeof summary.run_id === 'string' ? summary.run_id : null,
    study_run_id: typeof summary.study_run_id === 'string' ? summary.study_run_id : null,
    created: typeof summary.created === 'number' ? summary.created : 0,
    requested: typeof summary.requested === 'number' ? summary.requested : input.question_count,
    warnings: Array.isArray(summary.warnings) ? summary.warnings.map(String) : [],
    cost: normalizeCost((data ?? {}) as { cost?: unknown }),
  };
}

function normalizeCost(data: { cost?: unknown }): ServerDirectGenerationCost | null {
  const c = data.cost;
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const usd = Number(o.estimated_cost_usd);
  if (!Number.isFinite(usd)) return null;
  const cpq = Number(o.cost_per_question_usd);
  return {
    total_tokens: Number.isFinite(Number(o.total_tokens)) ? Number(o.total_tokens) : 0,
    estimated_cost_usd: usd,
    cost_model: typeof o.cost_model === 'string' ? o.cost_model : 'unknown',
    cost_per_question_usd: Number.isFinite(cpq) ? cpq : null,
  };
}

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
