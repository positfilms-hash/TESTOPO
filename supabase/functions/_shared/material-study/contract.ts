// TESTOPO - SPEC 038: contrato COMPARTIDO del estudio interno de material. Logica
// PURA (sin Node ni Deno) = UNICA fuente de verdad usada por:
//   - la Edge Function `study-material` (Deno), y
//   - los tests de vitest del backend (sin red, sin proveedor real).
//
// Aqui NO se llama a ningun proveedor, ni a Supabase, ni se leen secretos. Solo:
// codigos de error de wire, limites, validacion ESTRICTA del body (solo IDs/
// opciones; nunca texto/prompt/imagen/clave), elegibilidad de material, resolucion
// de proveedor (OpenAI-only), validacion de unidades/conceptos anclados a fuente y
// mapeo HONESTO de estados. No crea preguntas ni nada `validated`.

// ---------------------------------------------------------------------------
// Codigos de error de wire (estables, seguros). Sin prompts/errores crudos/
// excerpts completos/rutas internas/secretos.
// ---------------------------------------------------------------------------
export const STUDY_ERROR = {
  AUTH_REQUIRED: 'MATERIAL_STUDY_AUTH_REQUIRED',
  ACCESS_DENIED: 'MATERIAL_STUDY_ACCESS_DENIED',
  WORKSPACE_REQUIRED: 'MATERIAL_STUDY_WORKSPACE_REQUIRED',
  OPPOSITION_REQUIRED: 'MATERIAL_STUDY_OPPOSITION_REQUIRED',
  ARBITRARY_INPUT_FORBIDDEN: 'MATERIAL_STUDY_ARBITRARY_INPUT_FORBIDDEN',
  NO_ELIGIBLE_MATERIAL: 'MATERIAL_STUDY_NO_ELIGIBLE_MATERIAL',
  PROVIDER_NOT_CONFIGURED: 'MATERIAL_STUDY_PROVIDER_NOT_CONFIGURED',
  PROVIDER_FAILED: 'MATERIAL_STUDY_PROVIDER_FAILED',
  INVALID_OUTPUT: 'MATERIAL_STUDY_INVALID_OUTPUT',
  NO_VALID_UNITS: 'MATERIAL_STUDY_NO_VALID_UNITS',
  SAVE_FAILED: 'MATERIAL_STUDY_SAVE_FAILED',
  INVALID_REQUEST: 'MATERIAL_STUDY_INVALID_REQUEST',
} as const;

export type StudyErrorCode = (typeof STUDY_ERROR)[keyof typeof STUDY_ERROR];

export const STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE =
  'El estudio de material todavía no está configurado en servidor.';

// ---------------------------------------------------------------------------
// Limites (acotan lo que se envia/persiste).
// ---------------------------------------------------------------------------
export const MAX_STUDY_MATERIALS = 200;
export const MAX_STUDY_UNITS_PER_MATERIAL = 20;
export const MAX_STUDY_EXCERPT_CHARS = 2000;
export const MAX_STUDY_SOURCE_CHARS = 20000;

export const STUDY_MODES = ['all_eligible'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

export type StudyRunStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed';

export type MaterialStudyStatus =
  | 'not_studied'
  | 'studying'
  | 'studied'
  | 'studied_with_warnings'
  | 'study_failed';

// ---------------------------------------------------------------------------
// Validacion ESTRICTA del body. El navegador solo manda scope + opciones; jamas
// texto/prompt/imagen/clave/user_id.
// ---------------------------------------------------------------------------
export const ALLOWED_REQUEST_FIELDS = new Set([
  'workspace_id',
  'opposition_id',
  'mode',
  'force_retry',
]);

export const FORBIDDEN_REQUEST_FIELDS = [
  'user_id',
  'material_text',
  'raw_text',
  'ocr_text',
  'text',
  'prompt',
  'concepts',
  'units',
  'image_base64',
  'image_url',
  'api_key',
];

export interface NormalizedStudyRequest {
  workspace_id: string;
  opposition_id: string;
  mode: StudyMode;
  force_retry: boolean;
}

export type StudyRequestValidation =
  | { ok: true; value: NormalizedStudyRequest }
  | { ok: false; code: StudyErrorCode };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateStudyRequest(raw: unknown): StudyRequestValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, code: STUDY_ERROR.INVALID_REQUEST };
  }
  const body = raw as Record<string, unknown>;
  for (const forbidden of FORBIDDEN_REQUEST_FIELDS) {
    if (forbidden in body) {
      return { ok: false, code: STUDY_ERROR.ARBITRARY_INPUT_FORBIDDEN };
    }
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED_REQUEST_FIELDS.has(key)) {
      return { ok: false, code: STUDY_ERROR.ARBITRARY_INPUT_FORBIDDEN };
    }
  }
  if (!isNonEmptyString(body.workspace_id)) {
    return { ok: false, code: STUDY_ERROR.WORKSPACE_REQUIRED };
  }
  if (!isNonEmptyString(body.opposition_id)) {
    return { ok: false, code: STUDY_ERROR.OPPOSITION_REQUIRED };
  }
  const mode: StudyMode = body.mode === undefined ? 'all_eligible' : (body.mode as StudyMode);
  if (!STUDY_MODES.includes(mode)) {
    return { ok: false, code: STUDY_ERROR.INVALID_REQUEST };
  }
  if (body.force_retry !== undefined && typeof body.force_retry !== 'boolean') {
    return { ok: false, code: STUDY_ERROR.INVALID_REQUEST };
  }
  return {
    ok: true,
    value: {
      workspace_id: body.workspace_id.trim(),
      opposition_id: body.opposition_id.trim(),
      mode,
      force_retry: body.force_retry === true,
    },
  };
}

// ---------------------------------------------------------------------------
// Elegibilidad de material como evidencia de estudio (misma regla que SPEC 037 /
// generate-questions): legible, no obsoleto, clasificacion efectiva PRIMARIA y SIN
// needs_review. Los examenes antiguos solo aportan estilo (nunca unidad factual).
// ---------------------------------------------------------------------------
export const STUDY_READABLE_EXTRACTION = new Set([
  'completed',
  'completed_ocr',
  'completed_ocr_with_warnings',
]);

export const STUDY_ELIGIBLE_CLASSES = new Set([
  'syllabus_material',
  'legal_text',
  'notes_or_summary',
  'index_or_table_of_contents',
]);

export function isStudyEligibleMaterial(args: {
  material: { status?: string | null; extraction_status?: string | null } | null | undefined;
  classification: { classification?: string | null; needs_review?: boolean | null } | null | undefined;
}): boolean {
  const m = args.material;
  if (!m) return false;
  if (m.status === 'obsolete') return false;
  if (!STUDY_READABLE_EXTRACTION.has(m.extraction_status ?? '')) return false;
  const c = args.classification;
  if (!c) return false;
  if (c.needs_review === true) return false;
  return STUDY_ELIGIBLE_CLASSES.has(c.classification ?? '');
}

export function materialHasOcrWarnings(extractionStatus: string | null | undefined): boolean {
  return extractionStatus === 'completed_ocr_with_warnings';
}

// ---------------------------------------------------------------------------
// Proveedor (OpenAI-only; usa OPENAI_API_KEY). Sin proveedor real -> 501 honesto.
// ---------------------------------------------------------------------------
export interface ResolvedStudyProvider {
  provider: 'openai';
  apiKey: string;
  model: string;
}
export const DEFAULT_STUDY_MODEL = 'gpt-4o-mini';

export function resolveStudyProvider(env: {
  STUDY_PROVIDER?: string | null;
  OPENAI_API_KEY?: string | null;
  STUDY_MODEL?: string | null;
}): ResolvedStudyProvider | null {
  if ((env.STUDY_PROVIDER ?? '').toLowerCase() !== 'openai') return null;
  if (!isNonEmptyString(env.OPENAI_API_KEY)) return null;
  return {
    provider: 'openai',
    apiKey: env.OPENAI_API_KEY.trim(),
    model: isNonEmptyString(env.STUDY_MODEL) ? env.STUDY_MODEL.trim() : DEFAULT_STUDY_MODEL,
  };
}

export const STUDY_SYSTEM_PROMPT = [
  'Eres un asistente que ORGANIZA evidencia de estudio de oposiciones en español.',
  'Recibes fragmentos de material clasificado (con material_id y un puntero de',
  'fuente: material_section_id o source_reference_id) y devuelves BLOQUES de estudio',
  '(units) anclados a esos punteros, con un titulo conciso, un resumen breve y un',
  'source_excerpt CONTENIDO en la evidencia. Opcionalmente, conceptos por bloque.',
  'USA SOLO los punteros e ids proporcionados; no inventes datos, no copies preguntas',
  'de examenes antiguos, no generes preguntas ni nada validated.',
].join(' ');

// ---------------------------------------------------------------------------
// Validacion ESTRUCTURAL de una unidad del proveedor (antes de persistir). PURA.
// ---------------------------------------------------------------------------
export interface ProviderUnit {
  title?: unknown;
  summary?: unknown;
  material_id?: unknown;
  material_section_id?: unknown;
  source_reference_id?: unknown;
  source_excerpt?: unknown;
  importance?: unknown;
  confidence?: unknown;
}

export interface StudyEvidenceScope {
  material_ids: ReadonlySet<string>;
  material_section_ids: ReadonlySet<string>;
  source_reference_ids: ReadonlySet<string>;
  evidence_text: string;
}

export interface ValidatedStudyUnit {
  title: string;
  summary: string;
  material_id: string;
  material_section_id: string | null;
  source_reference_id: string | null;
  excerpt: string;
  importance: string | null;
  confidence: number | null;
}

export type StudyUnitValidation =
  | { ok: true; value: ValidatedStudyUnit }
  | { ok: false; code: StudyErrorCode };

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Devuelve el excerpt SOLO si esta contenido en la evidencia recuperada; si no, la
// evidencia (nunca se guarda una cita inventada). Igual patron que SPEC 033.
export function groundedExcerpt(
  aiExcerpt: string | null | undefined,
  evidence: string | null | undefined,
): string | null {
  const evidenceText = isNonEmptyString(evidence) ? evidence.trim() : null;
  if (isNonEmptyString(aiExcerpt) && evidenceText) {
    const needle = normalizeForMatch(aiExcerpt);
    if (needle.length > 0 && normalizeForMatch(evidenceText).includes(needle)) {
      return aiExcerpt.trim().slice(0, MAX_STUDY_EXCERPT_CHARS);
    }
  }
  return evidenceText ? evidenceText.slice(0, MAX_STUDY_EXCERPT_CHARS) : null;
}

// Valida una unidad: titulo/resumen, material del scope, puntero concreto del scope
// (seccion o referencia) y excerpt anclado. Sin puntero o sin anclaje -> invalida.
export function validateStudyUnit(
  unit: ProviderUnit,
  scope: StudyEvidenceScope,
): StudyUnitValidation {
  if (!isNonEmptyString(unit.title)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  if (!isNonEmptyString(unit.summary)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  if (!isNonEmptyString(unit.material_id) || !scope.material_ids.has(unit.material_id)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  const sectionId = isNonEmptyString(unit.material_section_id) ? unit.material_section_id : null;
  const referenceId = isNonEmptyString(unit.source_reference_id) ? unit.source_reference_id : null;
  if (sectionId && !scope.material_section_ids.has(sectionId)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  if (referenceId && !scope.source_reference_ids.has(referenceId)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  if (!sectionId && !referenceId) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  const grounded = groundedExcerpt(
    typeof unit.source_excerpt === 'string' ? unit.source_excerpt : null,
    scope.evidence_text,
  );
  if (!isNonEmptyString(grounded)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  const confidence =
    typeof unit.confidence === 'number' && Number.isFinite(unit.confidence)
      ? Math.min(1, Math.max(0, unit.confidence))
      : null;
  return {
    ok: true,
    value: {
      title: unit.title.trim(),
      summary: unit.summary.trim(),
      material_id: unit.material_id,
      material_section_id: sectionId,
      source_reference_id: referenceId,
      excerpt: grounded,
      importance: isNonEmptyString(unit.importance) ? unit.importance.trim() : null,
      confidence,
    },
  };
}

export type ParseUnitsResult =
  | { ok: true; units: ProviderUnit[] }
  | { ok: false; code: StudyErrorCode };

export function parseProviderUnits(content: unknown): ParseUnitsResult {
  if (!isNonEmptyString(content)) return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  const root = parsed as { units?: unknown };
  if (typeof root !== 'object' || root === null || !Array.isArray(root.units)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  return { ok: true, units: root.units as ProviderUnit[] };
}

// ---------------------------------------------------------------------------
// Mapeo HONESTO de estados.
// ---------------------------------------------------------------------------
export function mapStudyRunStatus(args: {
  unitsCreated: number;
  hadErrors: boolean;
  hadWarnings: boolean;
}): StudyRunStatus {
  if (args.unitsCreated === 0) return 'failed';
  if (args.hadWarnings || args.hadErrors) return 'completed_with_warnings';
  return 'completed';
}

// Estado de estudio de UN material: studied solo si produjo unidades usables;
// con avisos OCR -> studied_with_warnings; sin unidades -> study_failed.
export function mapMaterialStudyStatus(args: {
  hasUsableUnits: boolean;
  hadOcrWarnings: boolean;
}): MaterialStudyStatus {
  if (!args.hasUsableUnits) return 'study_failed';
  return args.hadOcrWarnings ? 'studied_with_warnings' : 'studied';
}
