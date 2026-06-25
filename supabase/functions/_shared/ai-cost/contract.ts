// TESTOPO - tracking de coste de IA por run (SPEC 038/039). Logica PURA (sin Node
// ni Deno) compartida por las Edge Functions `generate-questions-from-studied-material`
// y `study-material` y por los tests de vitest.
//
// Aqui NO se llama a ningun proveedor ni a Supabase. Solo: lectura/normalizacion del
// `usage` de OpenAI, estimacion de coste por tabla de precios (configurable por
// secreto), coste por pregunta y limites (coste por run, preguntas por run, coste
// diario por workspace+oposicion). NUNCA toca prompts, excerpts ni la respuesta cruda.

// ---------------------------------------------------------------------------
// 1) Tokens: normaliza el `usage` de OpenAI (Chat Completions usa prompt_tokens/
//    completion_tokens; la Responses API usa input_tokens/output_tokens).
// ---------------------------------------------------------------------------
export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

function asNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

export function parseOpenAIUsage(raw: unknown): AiUsage {
  const u = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const input = asNum(u.prompt_tokens) ?? asNum(u.input_tokens) ?? 0;
  const output = asNum(u.completion_tokens) ?? asNum(u.output_tokens) ?? 0;
  const total = asNum(u.total_tokens) ?? input + output;
  return { input_tokens: input, output_tokens: output, total_tokens: total };
}

export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    total_tokens: a.total_tokens + b.total_tokens,
  };
}
export const EMPTY_USAGE: AiUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

// ---------------------------------------------------------------------------
// 2) Precios por 1M tokens (USD). APROXIMADOS y configurables por secreto (override
//    explicito). `cost_model` registra el origen para auditar el calculo.
// ---------------------------------------------------------------------------
export interface ModelPrice {
  input_per_m: number;
  output_per_m: number;
}

export const DEFAULT_PRICES: Record<string, ModelPrice> = {
  'gpt-4o-mini': { input_per_m: 0.15, output_per_m: 0.6 },
  'gpt-4o': { input_per_m: 2.5, output_per_m: 10.0 },
};
export const FALLBACK_PRICE: ModelPrice = { input_per_m: 0.15, output_per_m: 0.6 };

export interface ResolvedPrice extends ModelPrice {
  /** Etiqueta auditable: de donde salio el precio. */
  cost_model: string;
}

export function resolvePrice(
  model: string,
  env: { AI_PRICE_INPUT_PER_M?: string | null; AI_PRICE_OUTPUT_PER_M?: string | null } = {},
): ResolvedPrice {
  const inEnv = parseFloatSafe(env.AI_PRICE_INPUT_PER_M);
  const outEnv = parseFloatSafe(env.AI_PRICE_OUTPUT_PER_M);
  if (inEnv != null && outEnv != null) {
    return { input_per_m: inEnv, output_per_m: outEnv, cost_model: `${model}@env` };
  }
  const table = DEFAULT_PRICES[model];
  if (table) return { ...table, cost_model: `${model}@table` };
  return { ...FALLBACK_PRICE, cost_model: 'default-gpt-4o-mini@fallback' };
}

function parseFloatSafe(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string') return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ---------------------------------------------------------------------------
// 3) Coste estimado y coste por pregunta. Redondeo a 6 decimales (microUSD).
// ---------------------------------------------------------------------------
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function estimateCostUsd(usage: AiUsage, price: ModelPrice): number {
  const cost =
    (usage.input_tokens / 1_000_000) * price.input_per_m +
    (usage.output_tokens / 1_000_000) * price.output_per_m;
  return round6(cost);
}

export function costPerQuestion(estimatedCostUsd: number, createdCount: number): number | null {
  if (!Number.isFinite(createdCount) || createdCount <= 0) return null;
  return round6(estimatedCostUsd / createdCount);
}

export interface CostBreakdown {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  cost_model: string;
}

// Construye la fila de coste a persistir (sin prompts/excerpts).
export function buildCostBreakdown(usage: AiUsage, price: ResolvedPrice): CostBreakdown {
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    estimated_cost_usd: estimateCostUsd(usage, price),
    cost_model: price.cost_model,
  };
}

// ---------------------------------------------------------------------------
// 4) Limites de coste/cantidad. Defaults seguros; un secreto SOLO puede REDUCIR.
// ---------------------------------------------------------------------------
export const MAX_QUESTIONS_PER_RUN = 20;
export const MAX_COST_PER_RUN_USD = 0.5;
export const MAX_DAILY_COST_USD = 5.0; // por workspace + oposicion (staging)

export interface CostLimits {
  maxQuestionsPerRun: number;
  maxCostPerRunUsd: number;
  maxDailyCostUsd: number;
}

function clampNum(raw: string | null | undefined, min: number, max: number): number {
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : NaN;
  if (!Number.isFinite(n) || n < min) return max;
  return Math.min(n, max);
}

export function resolveCostLimits(env: {
  MAX_QUESTIONS_PER_RUN?: string | null;
  MAX_COST_PER_RUN_USD?: string | null;
  MAX_DAILY_COST_USD?: string | null;
}): CostLimits {
  return {
    maxQuestionsPerRun: Math.round(clampNum(env.MAX_QUESTIONS_PER_RUN, 1, MAX_QUESTIONS_PER_RUN)),
    maxCostPerRunUsd: clampNum(env.MAX_COST_PER_RUN_USD, 0.000001, MAX_COST_PER_RUN_USD),
    maxDailyCostUsd: clampNum(env.MAX_DAILY_COST_USD, 0.000001, MAX_DAILY_COST_USD),
  };
}

// Estimacion APROXIMADA del coste de un run ANTES de llamar al proveedor (para el
// guard de presupuesto). Aproxima tokens de entrada desde los chars de evidencia
// (~4 chars/token) y los de salida desde el numero de preguntas (~180 tokens/pregunta).
export function estimateRunCostUsd(args: {
  sourceChars: number;
  questionCount: number;
  price: ModelPrice;
}): number {
  const inputTokens = Math.ceil(Math.max(0, args.sourceChars) / 4);
  const outputTokens = Math.max(0, args.questionCount) * 180;
  return estimateCostUsd(
    { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
    args.price,
  );
}

// ---------------------------------------------------------------------------
// 4b) Estimacion de coste de OCR por documento (SPEC 034/035). El coste de la
//     vision/file input lo domina el numero de PAGINAS (tokens de imagen de
//     entrada + transcripcion de salida). Aproximacion documentada; el coste REAL
//     se calcula despues con el `usage` que devuelve el proveedor.
// ---------------------------------------------------------------------------
export const OCR_INPUT_TOKENS_PER_PAGE = 1200;
export const OCR_OUTPUT_TOKENS_PER_PAGE = 700;

export function estimateOcrCostUsd(args: {
  pages: number;
  model: string;
  env?: { AI_PRICE_INPUT_PER_M?: string | null; AI_PRICE_OUTPUT_PER_M?: string | null };
}): { estimatedCostUsd: number; cost_model: string } {
  const price = resolvePrice(args.model, args.env ?? {});
  const pages = Math.max(0, Math.floor(args.pages));
  const inputTokens = pages * OCR_INPUT_TOKENS_PER_PAGE;
  const outputTokens = pages * OCR_OUTPUT_TOKENS_PER_PAGE;
  const estimatedCostUsd = estimateCostUsd(
    { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
    price,
  );
  return { estimatedCostUsd, cost_model: price.cost_model };
}

export type BudgetDecision =
  | { ok: true }
  | { ok: false; reason: 'run_cost_exceeded' | 'daily_cost_exceeded' };

// Decide si un run cabe en el presupuesto. `todayCostSoFarUsd` = suma del coste
// estimado de los runs de HOY de ese workspace+oposicion (lo aporta el servidor).
export function evaluateBudget(args: {
  estimatedRunCostUsd: number;
  todayCostSoFarUsd: number;
  limits: CostLimits;
}): BudgetDecision {
  if (args.estimatedRunCostUsd > args.limits.maxCostPerRunUsd) {
    return { ok: false, reason: 'run_cost_exceeded' };
  }
  if (args.todayCostSoFarUsd + args.estimatedRunCostUsd > args.limits.maxDailyCostUsd) {
    return { ok: false, reason: 'daily_cost_exceeded' };
  }
  return { ok: true };
}
