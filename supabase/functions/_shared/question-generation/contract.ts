// TESTOPO - SPEC 033: contrato COMPARTIDO de la generacion de preguntas anclada
// a fuentes en SERVIDOR. Logica PURA (sin dependencias de Node ni de Deno) para
// que sea la UNICA fuente de verdad usada por:
//   - la Edge Function `generate-questions` (Deno), y
//   - los tests de vitest del backend (sin red, sin proveedor real).
//
// Aqui NO se llama a ningun proveedor, ni a Supabase, ni se leen secretos. Solo
// se definen: codigos de error de wire, limites, validacion ESTRICTA del body de
// la peticion (solo IDs/parametros; nunca texto/fuente/prompt arbitrarios),
// elegibilidad de clasificacion y validacion estructural de la salida del
// proveedor (incluida la regla dura de que la IA NUNCA produce `validated`).
//
// Reglas reflejadas (canonicas en el backend): SPEC 028-E (anclaje a fuente),
// SPEC 028-C/D (secciones/referencias) y CLAUDE.md (modelo minimo de pregunta).

// ---------------------------------------------------------------------------
// Codigos de error de wire (estables, seguros para el cliente). NO se devuelven
// prompts, errores del proveedor, excerpts completos, rutas internas ni secretos.
// ---------------------------------------------------------------------------
export const QG_ERROR = {
  AUTH_REQUIRED: 'QUESTION_GENERATION_AUTH_REQUIRED',
  ACCESS_DENIED: 'QUESTION_GENERATION_ACCESS_DENIED',
  WORKSPACE_REQUIRED: 'QUESTION_GENERATION_WORKSPACE_REQUIRED',
  OPPOSITION_REQUIRED: 'QUESTION_GENERATION_OPPOSITION_REQUIRED',
  TOPIC_REQUIRED: 'QUESTION_GENERATION_TOPIC_REQUIRED',
  TOPIC_NOT_FOUND: 'QUESTION_GENERATION_TOPIC_NOT_FOUND',
  TOPIC_NOT_APPLIED: 'QUESTION_GENERATION_TOPIC_NOT_APPLIED',
  NO_SOURCES: 'QUESTION_GENERATION_NO_SOURCES',
  SOURCE_REQUIRED: 'QUESTION_GENERATION_SOURCE_REQUIRED',
  SOURCE_FORBIDDEN: 'QUESTION_GENERATION_SOURCE_FORBIDDEN',
  SOURCE_WORKSPACE_MISMATCH: 'QUESTION_GENERATION_SOURCE_WORKSPACE_MISMATCH',
  SOURCE_OPPOSITION_MISMATCH: 'QUESTION_GENERATION_SOURCE_OPPOSITION_MISMATCH',
  ARBITRARY_TEXT_FORBIDDEN: 'QUESTION_GENERATION_ARBITRARY_TEXT_FORBIDDEN',
  PROVIDER_NOT_CONFIGURED: 'QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED',
  PROVIDER_FAILED: 'QUESTION_GENERATION_PROVIDER_FAILED',
  INVALID_OUTPUT: 'QUESTION_GENERATION_INVALID_OUTPUT',
  NO_VALID_CANDIDATES: 'QUESTION_GENERATION_NO_VALID_CANDIDATES',
  SAVE_FAILED: 'QUESTION_GENERATION_SAVE_FAILED',
  INVALID_REQUEST: 'QUESTION_GENERATION_INVALID_REQUEST',
} as const;

export type QgErrorCode = (typeof QG_ERROR)[keyof typeof QG_ERROR];

// Mensaje seguro y humano para el bloqueo honesto sin proveedor (SPEC 033).
export const PROVIDER_NOT_CONFIGURED_MESSAGE =
  'La generación de preguntas todavía no está configurada en servidor.';

// ---------------------------------------------------------------------------
// Limites (SPEC 028-E / 033). Acotan fuentes y caracteres enviados al proveedor.
// ---------------------------------------------------------------------------
export const MAX_QUESTION_COUNT = 20;
export const MIN_QUESTION_COUNT = 1;
export const MAX_QUESTION_SOURCE_CHARS = 20000;
export const MAX_QUESTION_SOURCE_REFERENCES = 20;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SOURCE_MODES = ['topic_sources', 'manual_source_selection'] as const;
export type SourceMode = (typeof SOURCE_MODES)[number];

// Clases primarias ELEGIBLES como evidencia factual (SPEC 028-E §49-72).
export const ELIGIBLE_PRIMARY_CLASSES = [
  'syllabus_material',
  'legal_text',
  'notes_or_summary',
  'index_or_table_of_contents',
] as const;
export type EligiblePrimaryClass = (typeof ELIGIBLE_PRIMARY_CLASSES)[number];

// Estados de pregunta permitidos para una candidata IA (NUNCA `validated`).
export type CandidateStatus = 'pending_review' | 'needs_fix';

// Estados del run permitidos por el esquema actual (CHECK de 023:
// completed/partial/failed). SPEC 033 nombra mas estados de ciclo de vida; se
// MAPEAN a estos valores para no migrar el constraint (SPEC 033: migracion solo
// si falta un campo genuinamente). Ver docs/architecture/server-side-question-generation.md.
export type RunDbStatus = 'completed' | 'partial' | 'failed';

// ---------------------------------------------------------------------------
// Validacion ESTRICTA del body de la peticion. El navegador solo puede mandar
// IDs y parametros acotados; jamas texto/fuente/prompt arbitrarios (SPEC 033).
// ---------------------------------------------------------------------------
export const ALLOWED_REQUEST_FIELDS = new Set([
  'workspace_id',
  'opposition_id',
  'topic_id',
  'difficulty',
  'question_count',
  'source_mode',
  'selected_source_reference_ids',
  'selected_material_section_ids',
]);

// Campos que, si aparecen, son intento de inyectar contenido factual/prompt.
export const FORBIDDEN_REQUEST_FIELDS = [
  'user_id',
  'source_text',
  'raw_text',
  'manual_context',
  'custom_prompt',
  'prompt',
  'context',
  'system_prompt',
  'messages',
];

export interface NormalizedRequest {
  workspace_id: string;
  opposition_id: string;
  topic_id: string;
  difficulty: Difficulty;
  question_count: number;
  source_mode: SourceMode;
  selected_source_reference_ids: string[];
  selected_material_section_ids: string[];
}

export type RequestValidation =
  | { ok: true; value: NormalizedRequest }
  | { ok: false; code: QgErrorCode };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asStringIdArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (!isNonEmptyString(item)) return null;
    out.push(item.trim());
  }
  return out;
}

// Valida y normaliza el body. NO confia en `user_id` (el actor sale del JWT).
export function validateGenerateRequest(raw: unknown): RequestValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, code: QG_ERROR.INVALID_REQUEST };
  }
  const body = raw as Record<string, unknown>;

  // 1) Campos prohibidos = intento de texto/fuente/prompt arbitrario.
  for (const forbidden of FORBIDDEN_REQUEST_FIELDS) {
    if (forbidden in body) {
      return { ok: false, code: QG_ERROR.ARBITRARY_TEXT_FORBIDDEN };
    }
  }
  // 2) Campos desconocidos: se rechazan (whitelist estricta).
  for (const key of Object.keys(body)) {
    if (!ALLOWED_REQUEST_FIELDS.has(key)) {
      return { ok: false, code: QG_ERROR.ARBITRARY_TEXT_FORBIDDEN };
    }
  }

  // 3) Scope obligatorio.
  if (!isNonEmptyString(body.workspace_id)) {
    return { ok: false, code: QG_ERROR.WORKSPACE_REQUIRED };
  }
  if (!isNonEmptyString(body.opposition_id)) {
    return { ok: false, code: QG_ERROR.OPPOSITION_REQUIRED };
  }
  if (!isNonEmptyString(body.topic_id)) {
    return { ok: false, code: QG_ERROR.TOPIC_REQUIRED };
  }

  // 4) Parametros acotados.
  if (!isDifficulty(body.difficulty)) {
    return { ok: false, code: QG_ERROR.INVALID_REQUEST };
  }
  if (
    typeof body.question_count !== 'number' ||
    !Number.isInteger(body.question_count) ||
    body.question_count < MIN_QUESTION_COUNT ||
    body.question_count > MAX_QUESTION_COUNT
  ) {
    return { ok: false, code: QG_ERROR.INVALID_REQUEST };
  }

  const sourceMode: SourceMode =
    body.source_mode === undefined ? 'topic_sources' : (body.source_mode as SourceMode);
  if (!SOURCE_MODES.includes(sourceMode)) {
    return { ok: false, code: QG_ERROR.INVALID_REQUEST };
  }

  const refIds = asStringIdArray(body.selected_source_reference_ids);
  const sectionIds = asStringIdArray(body.selected_material_section_ids);
  if (refIds === null || sectionIds === null) {
    return { ok: false, code: QG_ERROR.INVALID_REQUEST };
  }
  if (
    refIds.length > MAX_QUESTION_SOURCE_REFERENCES ||
    sectionIds.length > MAX_QUESTION_SOURCE_REFERENCES
  ) {
    return { ok: false, code: QG_ERROR.INVALID_REQUEST };
  }

  return {
    ok: true,
    value: {
      workspace_id: body.workspace_id.trim(),
      opposition_id: body.opposition_id.trim(),
      topic_id: body.topic_id.trim(),
      difficulty: body.difficulty,
      question_count: body.question_count,
      source_mode: sourceMode,
      selected_source_reference_ids: refIds,
      selected_material_section_ids: sectionIds,
    },
  };
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

// Elegibilidad de clasificacion como evidencia primaria factual (SPEC 028-E).
// `old_exam_or_test` NUNCA es primaria (solo estilo/cobertura secundaria).
export function isEligiblePrimaryClass(cls: unknown): cls is EligiblePrimaryClass {
  return (
    typeof cls === 'string' &&
    (ELIGIBLE_PRIMARY_CLASSES as readonly string[]).includes(cls)
  );
}

// ---------------------------------------------------------------------------
// Validacion ESTRUCTURAL de la salida del proveedor (antes de persistir).
// ---------------------------------------------------------------------------
export interface CandidateOption {
  text: string;
  is_correct: boolean;
}

export interface ProviderCandidate {
  statement?: unknown;
  options?: unknown;
  explanation?: unknown;
  difficulty?: unknown;
  topic_id?: unknown;
  material_id?: unknown;
  material_section_id?: unknown;
  source_reference_id?: unknown;
  source_excerpt?: unknown;
  warnings?: unknown;
  status?: unknown;
}

export interface EvidenceScope {
  topic_id: string;
  // IDs concretos recuperados del lado servidor (misma oposicion/workspace).
  material_ids: ReadonlySet<string>;
  material_section_ids: ReadonlySet<string>;
  source_reference_ids: ReadonlySet<string>;
  topic_source_reference_ids?: ReadonlySet<string>;
  // Texto de evidencia recuperado (concatenado) para anclar el excerpt.
  evidence_text: string;
}

export interface ValidatedCandidate {
  statement: string;
  options: CandidateOption[];
  explanation: string;
  difficulty: Difficulty;
  topic_id: string;
  material_id: string;
  material_section_id: string | null;
  source_reference_id: string | null;
  source_excerpt: string;
  warnings: string[];
}

export type CandidateValidation =
  | { ok: true; value: ValidatedCandidate; warnings: string[] }
  | { ok: false; code: QgErrorCode };

// Normaliza para comparar texto (espacios/mayusculas/acentos da igual el caso).
export function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Devuelve el excerpt de la IA SOLO si esta contenido en la evidencia recuperada;
// si no, devuelve la evidencia (nunca se guarda una cita inventada). Igual que el
// backend (`groundedExcerpt`, SPEC 028-E).
export function groundedExcerpt(
  aiExcerpt: string | null | undefined,
  evidence: string | null | undefined,
): string | null {
  const evidenceText = isNonEmptyString(evidence) ? evidence.trim() : null;
  if (isNonEmptyString(aiExcerpt) && evidenceText) {
    const needle = normalizeForMatch(aiExcerpt);
    if (needle.length > 0 && normalizeForMatch(evidenceText).includes(needle)) {
      return aiExcerpt.trim();
    }
  }
  return evidenceText;
}

// Valida una candidata del proveedor contra la evidencia recuperada. Rechaza:
// estructura incompleta, < 2 opciones, distinto de exactamente 1 correcta,
// dificultad invalida, tema que no coincide, material/seccion/referencia ajenos
// o ausentes (sin puntero concreto), y cualquier `validated` propuesto por la IA.
// Si la candidata es valida pero el excerpt no estaba anclado, se sustituye por
// la evidencia recuperada y se devuelve un warning (=> candidata `needs_fix`).
export function validateCandidate(
  candidate: ProviderCandidate,
  scope: EvidenceScope,
): CandidateValidation {
  const warnings: string[] = [];

  // Regla dura: la IA jamas crea `validated`.
  if (candidate.status === 'validated') {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }

  if (!isNonEmptyString(candidate.statement)) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }
  if (!isNonEmptyString(candidate.explanation)) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }
  if (!isDifficulty(candidate.difficulty)) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }

  // Opciones: >= 2, todas con texto, exactamente una correcta, sin duplicados.
  if (!Array.isArray(candidate.options) || candidate.options.length < 2) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }
  const options: CandidateOption[] = [];
  const seenOptions = new Set<string>();
  for (const raw of candidate.options) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
    }
    const o = raw as Record<string, unknown>;
    if (!isNonEmptyString(o.text) || typeof o.is_correct !== 'boolean') {
      return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
    }
    const norm = normalizeForMatch(o.text);
    if (seenOptions.has(norm)) {
      return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
    }
    seenOptions.add(norm);
    options.push({ text: o.text.trim(), is_correct: o.is_correct });
  }
  if (options.filter((o) => o.is_correct).length !== 1) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }

  // Tema: debe coincidir con el solicitado.
  if (candidate.topic_id !== scope.topic_id) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }

  // Material: debe existir entre los recuperados (no ajeno).
  if (!isNonEmptyString(candidate.material_id)) {
    return { ok: false, code: QG_ERROR.SOURCE_REQUIRED };
  }
  if (!scope.material_ids.has(candidate.material_id)) {
    return { ok: false, code: QG_ERROR.SOURCE_FORBIDDEN };
  }

  // Punteros concretos: si vienen, deben pertenecer al scope recuperado.
  const sectionId = isNonEmptyString(candidate.material_section_id)
    ? candidate.material_section_id
    : null;
  const referenceId = isNonEmptyString(candidate.source_reference_id)
    ? candidate.source_reference_id
    : null;
  if (sectionId && !scope.material_section_ids.has(sectionId)) {
    return { ok: false, code: QG_ERROR.SOURCE_FORBIDDEN };
  }
  if (referenceId && !scope.source_reference_ids.has(referenceId)) {
    return { ok: false, code: QG_ERROR.SOURCE_FORBIDDEN };
  }
  // Anclaje obligatorio: al menos un puntero concreto.
  if (!sectionId && !referenceId) {
    return { ok: false, code: QG_ERROR.SOURCE_REQUIRED };
  }

  // Excerpt anclado: si la IA inventa una cita, se sustituye por la evidencia.
  const grounded = groundedExcerpt(
    typeof candidate.source_excerpt === 'string' ? candidate.source_excerpt : null,
    scope.evidence_text,
  );
  if (!isNonEmptyString(grounded)) {
    return { ok: false, code: QG_ERROR.SOURCE_REQUIRED };
  }
  if (
    isNonEmptyString(candidate.source_excerpt) &&
    normalizeForMatch(candidate.source_excerpt) !== normalizeForMatch(grounded)
  ) {
    warnings.push(
      'El fragmento citado por la IA no estaba contenido en la evidencia; se conservó la evidencia recuperada.',
    );
  }

  const providerWarnings = Array.isArray(candidate.warnings)
    ? candidate.warnings.filter(isNonEmptyString).map((w) => w.trim())
    : [];

  return {
    ok: true,
    warnings: [...warnings, ...providerWarnings],
    value: {
      statement: candidate.statement.trim(),
      options,
      explanation: candidate.explanation.trim(),
      difficulty: candidate.difficulty,
      topic_id: scope.topic_id,
      material_id: candidate.material_id,
      material_section_id: sectionId,
      source_reference_id: referenceId,
      source_excerpt: grounded,
      warnings: [...warnings, ...providerWarnings],
    },
  };
}

// Estado final de la candidata: sin hallazgo critico -> pending_review; con
// warnings/reparacion -> needs_fix. NUNCA validated (SPEC 033).
export function candidateStatus(args: {
  hasCriticalFinding: boolean;
  warnings: string[];
}): CandidateStatus {
  if (args.hasCriticalFinding || args.warnings.length > 0) {
    return 'needs_fix';
  }
  return 'pending_review';
}

// Mapea el ciclo de vida del run de SPEC 033 a los valores admitidos por el
// CHECK actual de `question_generation_runs` (023).
export function mapRunStatus(args: {
  created: number;
  requested: number;
  hadErrors: boolean;
}): RunDbStatus {
  if (args.created === 0) return 'failed';
  if (args.hadErrors || args.created < args.requested) return 'partial';
  return 'completed';
}
