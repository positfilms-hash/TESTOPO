// TESTOPO - SPEC 040: contrato COMPARTIDO del motor de fiabilidad y memoria de
// feedback. Logica PURA (sin Node ni Deno) = UNICA fuente de verdad usada por:
//   - la Edge Function `generate-questions-from-studied-material` (inyeccion de
//     memoria server-side), y
//   - el backend/frontend (catalogo de feedback, validacion, metricas).
//
// Principios (SPEC 040): la memoria NO es fuente factual, NUNCA valida una pregunta
// ni publica un test; se aisla ESTRICTAMENTE por workspace + oposicion (no hay
// memoria global ni cruce entre academias) y nunca contiene fuentes, extractos,
// prompts, secretos ni datos de otro cliente. Aqui no se llama a proveedor ni a
// Supabase: solo catalogo, validacion, seleccion/format de memoria y metricas.

// ---------------------------------------------------------------------------
// 1) Catalogo UNICO de tipos de feedback + severidad (validado en server y cliente).
// ---------------------------------------------------------------------------
export const RELIABILITY_FEEDBACK_TYPES = [
  'ambiguous_question',
  'multiple_correct_answers',
  'wrong_correct_answer',
  'weak_distractors',
  'too_easy',
  'too_hard',
  'difficulty_mismatch',
  'source_missing',
  'source_insufficient',
  'source_mismatch',
  'explanation_missing',
  'explanation_weak',
  'hallucinated_content',
  'copied_old_exam',
  'bad_wording',
  'too_literal',
  'too_broad',
  'too_narrow',
  'not_exam_style',
  'duplicate_question',
  'obsolete_source',
  'format_error',
  'other',
] as const;
export type ReliabilityFeedbackType = (typeof RELIABILITY_FEEDBACK_TYPES)[number];

export const RELIABILITY_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ReliabilitySeverity = (typeof RELIABILITY_SEVERITIES)[number];

export const SEVERITY_RANK: Record<ReliabilitySeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// Severidad por defecto por tipo (se aplica si quien revisa no indica una).
export const DEFAULT_FEEDBACK_SEVERITY: Record<ReliabilityFeedbackType, ReliabilitySeverity> = {
  ambiguous_question: 'high',
  multiple_correct_answers: 'critical',
  wrong_correct_answer: 'critical',
  weak_distractors: 'medium',
  too_easy: 'low',
  too_hard: 'low',
  difficulty_mismatch: 'medium',
  source_missing: 'critical',
  source_insufficient: 'high',
  source_mismatch: 'critical',
  explanation_missing: 'high',
  explanation_weak: 'medium',
  hallucinated_content: 'critical',
  copied_old_exam: 'high',
  bad_wording: 'medium',
  too_literal: 'low',
  too_broad: 'medium',
  too_narrow: 'medium',
  not_exam_style: 'low',
  duplicate_question: 'high',
  obsolete_source: 'high',
  format_error: 'low',
  other: 'low',
};

export function isReliabilityFeedbackType(value: unknown): value is ReliabilityFeedbackType {
  return typeof value === 'string' && (RELIABILITY_FEEDBACK_TYPES as readonly string[]).includes(value);
}
export function isReliabilitySeverity(value: unknown): value is ReliabilitySeverity {
  return typeof value === 'string' && (RELIABILITY_SEVERITIES as readonly string[]).includes(value);
}
export function severityRank(severity: string): number {
  return (SEVERITY_RANK as Record<string, number>)[severity] ?? 0;
}
export function resolveSeverity(
  type: ReliabilityFeedbackType,
  severity?: unknown,
): ReliabilitySeverity {
  return isReliabilitySeverity(severity) ? severity : DEFAULT_FEEDBACK_SEVERITY[type];
}

// Instruccion NO factual de "evitar" por tipo. Orienta la redaccion; nunca aporta
// hechos, fuentes ni datos del cliente.
export const AVOID_INSTRUCTION: Record<ReliabilityFeedbackType, string> = {
  ambiguous_question: 'Evita enunciados ambiguos: una sola interpretacion posible.',
  multiple_correct_answers: 'Garantiza EXACTAMENTE una opcion correcta; opciones mutuamente excluyentes.',
  wrong_correct_answer: 'Verifica que la opcion marcada como correcta lo es segun la evidencia.',
  weak_distractors: 'Distractores plausibles pero claramente incorrectos; nada defendible desde el mismo extracto.',
  too_easy: 'Sube la exigencia: evita preguntas triviales.',
  too_hard: 'Evita preguntas excesivamente rebuscadas o de memoria pura.',
  difficulty_mismatch: 'Ajusta la dificultad a la solicitada.',
  source_missing: 'No generes preguntas sin una fuente concreta del material estudiado.',
  source_insufficient: 'Apoya cada pregunta en evidencia suficiente, no en una frase aislada.',
  source_mismatch: 'Ancla cada pregunta a la unidad/extracto correcto; sin mezclar fuentes.',
  explanation_missing: 'Incluye SIEMPRE una explicacion.',
  explanation_weak: 'Explica el porque de la correcta y de los distractores con claridad.',
  hallucinated_content: 'No inventes datos: usa solo lo que aparece en la evidencia estudiada.',
  copied_old_exam: 'No copies ni parafrasees de cerca preguntas de examenes antiguos.',
  bad_wording: 'Redacta con precision gramatical y sin ambiguedad.',
  too_literal: 'Evita copiar literalmente el texto; reformula comprobando comprension.',
  too_broad: 'Acota el enunciado a un punto concreto y evaluable.',
  too_narrow: 'Evita preguntas triviales por excesivamente especificas o anecdoticas.',
  not_exam_style: 'Ajusta el estilo al de un examen tipo test de oposicion.',
  duplicate_question: 'Evita repetir enunciados ya generados.',
  obsolete_source: 'No te apoyes en fuentes marcadas como obsoletas.',
  format_error: 'Respeta el formato: enunciado, 3-4 opciones y una correcta.',
  other: 'Ten en cuenta el feedback humano previo de este contexto.',
};

export function avoidInstructionFor(type: string): string {
  return isReliabilityFeedbackType(type) ? AVOID_INSTRUCTION[type] : AVOID_INSTRUCTION.other;
}

// ---------------------------------------------------------------------------
// 2) Acciones de revision + senales de resultado (auditables, NUNCA auto-validan).
// ---------------------------------------------------------------------------
export const REVIEW_ACTIONS = ['reject', 'needs_fix', 'edit', 'reopen', 'validate'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

// Senales POSITIVAS de resultado al validar (no son aprobacion automatica: las
// produce un humano que valida; aqui solo se clasifica el resultado).
export const REVIEW_OUTCOME_SIGNALS = [
  'validated_without_changes',
  'validated_with_minor_changes',
  'validated_after_major_edit',
] as const;
export type ReviewOutcomeSignal = (typeof REVIEW_OUTCOME_SIGNALS)[number];

// Clasifica el resultado de una validacion segun la magnitud de la edicion previa.
export function classifyValidationOutcome(args: {
  edited: boolean;
  majorEdit?: boolean;
}): ReviewOutcomeSignal {
  if (!args.edited) return 'validated_without_changes';
  return args.majorEdit ? 'validated_after_major_edit' : 'validated_with_minor_changes';
}

export const RELIABILITY_ERROR = {
  INVALID_ACTION: 'RELIABILITY_INVALID_ACTION',
  REASON_REQUIRED: 'RELIABILITY_REASON_REQUIRED',
  INVALID_FEEDBACK_TYPE: 'RELIABILITY_INVALID_FEEDBACK_TYPE',
  INVALID_SEVERITY: 'RELIABILITY_INVALID_SEVERITY',
} as const;
export type ReliabilityErrorCode = (typeof RELIABILITY_ERROR)[keyof typeof RELIABILITY_ERROR];

export interface ReviewFeedbackEntryInput {
  feedback_type?: unknown;
  severity?: unknown;
  comment?: unknown;
  suggested_fix?: unknown;
  source_issue?: unknown;
}
export interface NormalizedFeedbackEntry {
  feedback_type: ReliabilityFeedbackType;
  severity: ReliabilitySeverity;
  comment: string | null;
  suggested_fix: string | null;
  source_issue: string | null;
}
export type ReviewFeedbackValidation =
  | { ok: true; value: NormalizedFeedbackEntry[] }
  | { ok: false; code: ReliabilityErrorCode };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function optString(v: unknown): string | null {
  return isNonEmptyString(v) ? v.trim() : null;
}

// Valida y normaliza el feedback de una accion de revision (SPEC 040):
// - reject  -> motivo estructurado OBLIGATORIO (>=1) y severidad por entrada.
// - needs_fix -> feedback OPCIONAL; si se aporta, se valida.
// - edit/reopen/validate -> sin feedback obligatorio; si se aporta, se valida.
// Ninguna accion valida automaticamente: esto solo estructura/auditiza la senal.
export function validateReviewFeedback(
  action: ReviewAction,
  entries: ReviewFeedbackEntryInput[] | null | undefined,
): ReviewFeedbackValidation {
  if (!(REVIEW_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, code: RELIABILITY_ERROR.INVALID_ACTION };
  }
  const list = Array.isArray(entries) ? entries : [];
  if (action === 'reject' && list.length === 0) {
    return { ok: false, code: RELIABILITY_ERROR.REASON_REQUIRED };
  }
  const out: NormalizedFeedbackEntry[] = [];
  for (const e of list) {
    if (!isReliabilityFeedbackType(e.feedback_type)) {
      return { ok: false, code: RELIABILITY_ERROR.INVALID_FEEDBACK_TYPE };
    }
    // En reject la severidad es OBLIGATORIA y debe ser valida; en el resto se
    // permite y, si falta, se resuelve por el catalogo.
    if (action === 'reject') {
      if (e.severity !== undefined && !isReliabilitySeverity(e.severity)) {
        return { ok: false, code: RELIABILITY_ERROR.INVALID_SEVERITY };
      }
    } else if (e.severity !== undefined && !isReliabilitySeverity(e.severity)) {
      return { ok: false, code: RELIABILITY_ERROR.INVALID_SEVERITY };
    }
    out.push({
      feedback_type: e.feedback_type,
      severity: resolveSeverity(e.feedback_type, e.severity),
      comment: optString(e.comment),
      suggested_fix: optString(e.suggested_fix),
      source_issue: optString(e.source_issue),
    });
  }
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------
// 3) Memoria de errores: seleccion + formato para el prompt. Limites ESTRICTOS.
// ---------------------------------------------------------------------------
export const MAX_ERROR_MEMORIES_IN_PROMPT = 10;
export const MAX_ERROR_MEMORY_CHARS = 3000;

export interface MemoryLimits {
  maxEntries: number;
  maxChars: number;
}
// Los secretos SOLO pueden REDUCIR los topes (nunca superarlos).
export function resolveMemoryLimits(env: {
  MAX_ERROR_MEMORIES_IN_PROMPT?: string | null;
  MAX_ERROR_MEMORY_CHARS?: string | null;
}): MemoryLimits {
  const clamp = (raw: string | null | undefined, min: number, max: number): number => {
    const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n < min) return max;
    return Math.min(n, max);
  };
  return {
    maxEntries: clamp(env.MAX_ERROR_MEMORIES_IN_PROMPT, 1, MAX_ERROR_MEMORIES_IN_PROMPT),
    maxChars: clamp(env.MAX_ERROR_MEMORY_CHARS, 1, MAX_ERROR_MEMORY_CHARS),
  };
}

// Entrada de memoria tal como llega de la BD (solo campos NO factuales).
export interface ErrorMemoryRecord {
  workspace_id?: string | null;
  opposition_id?: string | null;
  type?: string | null;
  severity?: string | null;
  summary?: string | null;
  avoid_instruction?: string | null;
  occurrences?: number | null;
  difficulty?: string | null;
  last_seen_at?: string | null;
}

export interface MemoryScope {
  workspace_id: string;
  opposition_id: string;
  // Pista de dificultad para priorizar (request.difficulty si no es 'mixed').
  difficulty?: string | null;
}

// Selecciona la memoria RELEVANTE del MISMO workspace + oposicion (aislamiento
// reforzado tambien en codigo puro), priorizando: criticas y recientes, mas
// repetidas, y coincidencia de dificultad. Deduplica por instruccion. Acota a
// `limits.maxEntries`.
export function selectErrorMemories(
  memories: ReadonlyArray<ErrorMemoryRecord>,
  scope: MemoryScope,
  limits: MemoryLimits,
): ErrorMemoryRecord[] {
  const scoped = memories.filter(
    (m) =>
      m.workspace_id === scope.workspace_id &&
      m.opposition_id === scope.opposition_id &&
      isNonEmptyString(m.avoid_instruction),
  );
  const wantDifficulty = isNonEmptyString(scope.difficulty) ? scope.difficulty : null;
  const ts = (m: ErrorMemoryRecord): number => {
    const t = m.last_seen_at ? Date.parse(m.last_seen_at) : NaN;
    return Number.isFinite(t) ? t : 0;
  };
  const diffMatch = (m: ErrorMemoryRecord): number =>
    wantDifficulty && m.difficulty === wantDifficulty ? 1 : 0;

  const sorted = [...scoped].sort((a, b) => {
    const sev = severityRank(b.severity ?? '') - severityRank(a.severity ?? '');
    if (sev !== 0) return sev;
    const dm = diffMatch(b) - diffMatch(a);
    if (dm !== 0) return dm;
    const occ = (b.occurrences ?? 0) - (a.occurrences ?? 0);
    if (occ !== 0) return occ;
    return ts(b) - ts(a);
  });

  const out: ErrorMemoryRecord[] = [];
  const seen = new Set<string>();
  for (const m of sorted) {
    const key = (m.avoid_instruction ?? '').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limits.maxEntries) break;
  }
  return out;
}

// Formatea el bloque "errores a evitar" (NO factual), separado de la evidencia.
// Devuelve null si no hay memoria. Acota duro a `maxChars`.
export const AVOID_BLOCK_HEADER =
  'ERRORES A EVITAR (consejos de calidad de revisiones humanas previas; NO son fuente factual, NO uses su contenido como dato):';

export function formatAvoidBlock(
  entries: ReadonlyArray<ErrorMemoryRecord>,
  maxChars: number,
): string | null {
  if (entries.length === 0) return null;
  const lines: string[] = [AVOID_BLOCK_HEADER];
  for (const e of entries) {
    const instr = (e.avoid_instruction ?? '').trim();
    if (!instr) continue;
    const next = `- ${instr}`;
    // +1 por el salto de linea al unir.
    if ([...lines, next].join('\n').length > maxChars) break;
    lines.push(next);
  }
  if (lines.length <= 1) return null;
  return lines.join('\n').slice(0, maxChars);
}

// ---------------------------------------------------------------------------
// 4) Metricas basicas por workspace + oposicion (puras, bajo demanda).
// ---------------------------------------------------------------------------
export interface ReliabilityMetricsInput {
  generated_count: number;
  validated_count: number;
  rejected_count: number;
  needs_fix_count: number;
  review_times_ms?: number[];
  top_error_types?: { type: string; count: number }[];
}
export interface ReliabilityMetrics {
  generated_count: number;
  validated_count: number;
  rejected_count: number;
  needs_fix_count: number;
  validation_rate: number;
  rejection_rate: number;
  needs_fix_rate: number;
  average_review_time_ms: number | null;
  top_error_types: { type: string; count: number }[];
}

export function computeReliabilityMetrics(input: ReliabilityMetricsInput): ReliabilityMetrics {
  const total = Math.max(0, input.generated_count);
  const rate = (n: number): number => (total > 0 ? Math.round((n / total) * 1000) / 1000 : 0);
  const times = (input.review_times_ms ?? []).filter((t) => Number.isFinite(t) && t >= 0);
  const avg =
    times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const top = [...(input.top_error_types ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    generated_count: total,
    validated_count: input.validated_count,
    rejected_count: input.rejected_count,
    needs_fix_count: input.needs_fix_count,
    validation_rate: rate(input.validated_count),
    rejection_rate: rate(input.rejected_count),
    needs_fix_rate: rate(input.needs_fix_count),
    average_review_time_ms: avg,
    top_error_types: top,
  };
}
