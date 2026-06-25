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
  // Bloqueo TRAZABLE al preparar la evidencia: error de lectura/escritura de la
  // seccion/fuente canonica o de la clasificacion (no se silencia; SPEC 038 fix).
  PREP_FAILED: 'MATERIAL_STUDY_PREP_FAILED',
  INVALID_REQUEST: 'MATERIAL_STUDY_INVALID_REQUEST',
} as const;

export type StudyErrorCode = (typeof STUDY_ERROR)[keyof typeof STUDY_ERROR];

export const STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE =
  'El estudio de material todavía no está configurado en servidor.';

// ---------------------------------------------------------------------------
// Limites (acotan lo que se envia/persiste).
// ---------------------------------------------------------------------------
export const MAX_STUDY_MATERIALS = 60;
export const MAX_STUDY_UNITS_PER_MATERIAL = 20;
export const MAX_STUDY_EXCERPT_CHARS = 2000;
// Presupuesto GLOBAL POR RUN (no por material): no se reinicia por material ni se
// lanzan llamadas sin limite. La Edge Function consume estos topes de forma
// acumulativa (chars y unidades) y para cuando se agotan.
export const MAX_STUDY_TOTAL_SOURCE_CHARS = 40000;
export const MAX_STUDY_TOTAL_UNITS = 60;
export const MAX_STUDY_CONCURRENCY = 1; // secuencial (cota superior segura)
export const STUDY_PER_CALL_TIMEOUT_MS = 60000;

export interface StudyLimits {
  maxMaterials: number;
  totalSourceChars: number;
  totalUnits: number;
  concurrency: number;
  perCallTimeoutMs: number;
}

function clampLimit(raw: string | null | undefined, min: number, max: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < min) return max;
  return Math.min(n, max);
}

// Limites por SECRETO de Edge Function: un valor del entorno solo puede ENDURECER
// (nunca superar el maximo seguro); ausente/invalido -> maximo. PURA.
export function resolveStudyLimits(env: {
  STUDY_MAX_MATERIALS?: string | null;
  STUDY_MAX_TOTAL_CHARS?: string | null;
  STUDY_MAX_TOTAL_UNITS?: string | null;
  STUDY_PER_CALL_TIMEOUT_SECONDS?: string | null;
}): StudyLimits {
  const timeoutSeconds = clampLimit(
    env.STUDY_PER_CALL_TIMEOUT_SECONDS,
    1,
    Math.floor(STUDY_PER_CALL_TIMEOUT_MS / 1000),
  );
  return {
    maxMaterials: clampLimit(env.STUDY_MAX_MATERIALS, 1, MAX_STUDY_MATERIALS),
    totalSourceChars: clampLimit(env.STUDY_MAX_TOTAL_CHARS, 1, MAX_STUDY_TOTAL_SOURCE_CHARS),
    totalUnits: clampLimit(env.STUDY_MAX_TOTAL_UNITS, 1, MAX_STUDY_TOTAL_UNITS),
    concurrency: MAX_STUDY_CONCURRENCY,
    perCallTimeoutMs: timeoutSeconds * 1000,
  };
}

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

// Motivos ESTABLES (seguros para el cliente) por los que un material legible no se
// estudia. La UI los mapea a un mensaje exacto (SPEC 038, fix staging).
export const STUDY_INELIGIBLE_REASON = {
  OBSOLETE: 'material_obsolete',
  NOT_READABLE: 'material_not_readable',
  UNCLASSIFIED: 'classification_unresolved',
  NEEDS_REVIEW: 'classification_needs_review',
  NOT_PRIMARY: 'classification_not_primary',
  // Material `completed` pero sin secciones y sin `content_text`: no hay texto que
  // estudiar. Motivo HONESTO y especifico (SPEC 038 fix staging).
  COMPLETED_WITHOUT_TEXT: 'material_completed_without_text',
} as const;
export type StudyIneligibleReason =
  (typeof STUDY_INELIGIBLE_REASON)[keyof typeof STUDY_INELIGIBLE_REASON];

// ---------------------------------------------------------------------------
// Seccion/fuente CANONICA (SPEC 038 fix): un material legible (`completed`) puede
// no tener `material_sections` (la seccion 028-C nunca corrio) pero SI tener texto
// en `materials.content_text`. En ese caso la Edge Function crea internamente una
// seccion canonica desde ese texto (recuperado SOLO en servidor) para poder
// clasificar y estudiar, y para que las unidades queden ancladas a ella (evidencia
// concreta para SPEC 039). Esta decision es PURA y testeable; la Edge Function la
// ejecuta y persiste. Nunca usa texto del frontend.
// ---------------------------------------------------------------------------
export const MAX_CANONICAL_SECTION_CHARS = 200000;
export const CANONICAL_SECTION_TITLE = 'Documento completo';

export interface CanonicalSectionPlan {
  section_title: string;
  section_type: 'chunk';
  classification: 'study_content';
  content_text: string;
  order_index: 0;
}

export type CanonicalSectionResolution =
  | { kind: 'has_sections' }
  | { kind: 'create'; section: CanonicalSectionPlan }
  | { kind: 'no_text'; reason: StudyIneligibleReason };

// Decide si hace falta crear una seccion canonica para un material legible:
// - ya tiene secciones activas -> nada que crear;
// - sin secciones pero con `content_text` -> crear seccion canonica desde ese texto;
// - sin secciones y sin `content_text` -> bloqueo HONESTO `completed_without_text`.
// Solo usa `materials.content_text` (servidor); ignora cualquier texto externo.
export function resolveCanonicalSection(args: {
  activeSectionCount: number;
  content_text?: string | null;
  title?: string | null;
}): CanonicalSectionResolution {
  if (args.activeSectionCount > 0) {
    return { kind: 'has_sections' };
  }
  const text = typeof args.content_text === 'string' ? args.content_text.trim() : '';
  if (text.length === 0) {
    return { kind: 'no_text', reason: STUDY_INELIGIBLE_REASON.COMPLETED_WITHOUT_TEXT };
  }
  const title = isNonEmptyString(args.title) ? args.title.trim() : CANONICAL_SECTION_TITLE;
  return {
    kind: 'create',
    section: {
      section_title: title.slice(0, 300),
      section_type: 'chunk',
      classification: 'study_content',
      content_text: text.slice(0, MAX_CANONICAL_SECTION_CHARS),
      order_index: 0,
    },
  };
}

export type StudyEligibility =
  | { eligible: true; ocrWarnings: boolean }
  | { eligible: false; reason: StudyIneligibleReason };

// Decide la elegibilidad de un material para estudiar y, si NO es elegible, el
// MOTIVO exacto. Fail-closed: sin clasificacion resuelta -> no elegible (la Edge
// Function debe resolver la clasificacion antes; este modulo no inventa estado).
export function evaluateStudyEligibility(args: {
  material: { status?: string | null; extraction_status?: string | null } | null | undefined;
  classification: { classification?: string | null; needs_review?: boolean | null } | null | undefined;
}): StudyEligibility {
  const m = args.material;
  if (!m) return { eligible: false, reason: STUDY_INELIGIBLE_REASON.NOT_READABLE };
  if (m.status === 'obsolete') return { eligible: false, reason: STUDY_INELIGIBLE_REASON.OBSOLETE };
  if (!STUDY_READABLE_EXTRACTION.has(m.extraction_status ?? '')) {
    return { eligible: false, reason: STUDY_INELIGIBLE_REASON.NOT_READABLE };
  }
  const c = args.classification;
  if (!c || !isNonEmptyString(c.classification)) {
    return { eligible: false, reason: STUDY_INELIGIBLE_REASON.UNCLASSIFIED };
  }
  if (c.needs_review === true) {
    return { eligible: false, reason: STUDY_INELIGIBLE_REASON.NEEDS_REVIEW };
  }
  if (!STUDY_ELIGIBLE_CLASSES.has(c.classification)) {
    return { eligible: false, reason: STUDY_INELIGIBLE_REASON.NOT_PRIMARY };
  }
  return { eligible: true, ocrWarnings: materialHasOcrWarnings(m.extraction_status) };
}

export function isStudyEligibleMaterial(args: {
  material: { status?: string | null; extraction_status?: string | null } | null | undefined;
  classification: { classification?: string | null; needs_review?: boolean | null } | null | undefined;
}): boolean {
  return evaluateStudyEligibility(args).eligible;
}

export function materialHasOcrWarnings(extractionStatus: string | null | undefined): boolean {
  return extractionStatus === 'completed_ocr_with_warnings';
}

// ---------------------------------------------------------------------------
// Clasificador documental HEURISTICO determinista (portado de
// app/backend/src/classification/heuristicDocumentClassifier.ts). PURO y sin red:
// permite que "Estudiar material" sea AUTOSUFICIENTE — si un material legible no
// tiene clasificacion previa, la Edge Function la resuelve internamente y la
// persiste de forma trazable, sin depender de que el usuario haya ejecutado antes
// "Analizar material"/indice. NO es un mock de IA: es una clasificacion real por
// senales de texto/nombre. Fail-closed: ante senales ambiguas -> needs_review.
// ---------------------------------------------------------------------------
export type StudyDocumentClass =
  | 'syllabus_material'
  | 'old_exam_or_test'
  | 'legal_text'
  | 'notes_or_summary'
  | 'index_or_table_of_contents'
  | 'irrelevant'
  | 'not_analyzable'
  | 'ambiguous';

// Umbral de confianza por debajo del cual se marca needs_review (igual que el
// backend: DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.75).
export const STUDY_CLASSIFY_CONFIDENCE_THRESHOLD = 0.75;
const STUDY_CLASSIFY_ALWAYS_REVIEW = new Set<StudyDocumentClass>([
  'not_analyzable',
  'ambiguous',
  'irrelevant',
]);
const STUDY_CLASSIFY_MIN_CHARS = 20;
const STUDY_CLASSIFY_PRIORITY: StudyDocumentClass[] = [
  'old_exam_or_test',
  'index_or_table_of_contents',
  'legal_text',
  'notes_or_summary',
  'irrelevant',
  'syllabus_material',
];

export interface StudyAutoClassification {
  classification: StudyDocumentClass;
  confidence: number;
  reason: string;
  needs_review: boolean;
  warnings: string[];
}

function classifyNormalize(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('')
    .toLowerCase();
}
function countOptionLines(text: string): number {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\(?[a-dA-D]\)|^\s*[a-dA-D][).\-]\s+/.test(line)) count += 1;
  }
  return count;
}
function countTemaLines(text: string): number {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*tema\s+\d+/i.test(line)) count += 1;
  }
  return count;
}
function isMostlyShortLines(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  const shortLines = lines.filter((l) => l.trim().length <= 60).length;
  return shortLines / lines.length >= 0.7;
}

// Clasifica un documento a partir de su texto (y opcionalmente nombre/categoria).
// El texto lo recupera el SERVIDOR de las secciones del material; el navegador
// nunca aporta texto.
export function classifyStudyDocument(input: {
  text?: string | null;
  filename?: string | null;
  detected_category?: string | null;
}): StudyAutoClassification {
  const text = input.text ?? '';
  if (text.trim().length < STUDY_CLASSIFY_MIN_CHARS) {
    return {
      classification: 'not_analyzable',
      confidence: 0.9,
      reason: 'No hay texto extraible suficiente para analizar el documento.',
      needs_review: true,
      warnings: [],
    };
  }
  const nameHay = classifyNormalize(input.filename ?? '');
  const textHay = classifyNormalize(text);
  const hay = `${nameHay} ${textHay}`;
  const scores: Record<StudyDocumentClass, number> = {
    syllabus_material: 0,
    old_exam_or_test: 0,
    legal_text: 0,
    notes_or_summary: 0,
    index_or_table_of_contents: 0,
    irrelevant: 0,
    not_analyzable: 0,
    ambiguous: 0,
  };

  if (countOptionLines(text) >= 3) scores.old_exam_or_test += 3;
  if (/\b(test|examen|examenes|simulacro|convocatoria|pregunta)\b/.test(hay)) scores.old_exam_or_test += 2;
  if (/respuestas?\s+correctas?|plantilla de respuestas/.test(hay)) scores.old_exam_or_test += 2;
  if (input.detected_category === 'old_tests') scores.old_exam_or_test += 1;

  if (/\bley\s+\d+\/\d+/.test(hay)) scores.legal_text += 3;
  if (/\b(ley|real decreto|constitucion|estatuto|reglamento|normativa|boe|articulo)\b/.test(hay)) {
    scores.legal_text += 2;
  }

  if (/\b(indice|programa|temario oficial|distribucion de temas|tabla de contenidos)\b/.test(nameHay)) {
    scores.index_or_table_of_contents += 2;
  }
  if (countTemaLines(text) >= 4 && isMostlyShortLines(text)) scores.index_or_table_of_contents += 2;

  if (/\b(resumen|esquema|cuadro|apuntes|chuleta|comparativa)\b/.test(nameHay)) scores.notes_or_summary += 2;

  if (/\btema\s+\d+/.test(hay)) scores.syllabus_material += 2;
  if (text.trim().length > 400 && !isMostlyShortLines(text)) scores.syllabus_material += 1;
  if (input.detected_category === 'opposition_material') scores.syllabus_material += 1;

  if (/\b(publicidad|oferta|descuento|matriculate|promocion|academia .* matricula)\b/.test(hay)) {
    scores.irrelevant += 3;
  }

  let best: StudyDocumentClass | null = null;
  let bestScore = 0;
  for (const cls of STUDY_CLASSIFY_PRIORITY) {
    if (scores[cls] > bestScore) {
      best = cls;
      bestScore = scores[cls];
    }
  }
  if (best === null) {
    return {
      classification: 'ambiguous',
      confidence: 0.4,
      reason: 'No se han detectado senales claras para clasificar el documento.',
      needs_review: true,
      warnings: ['Clasificacion incierta; revisar manualmente.'],
    };
  }
  const confidence = Math.min(0.95, 0.55 + 0.1 * bestScore);
  const needsReview =
    confidence < STUDY_CLASSIFY_CONFIDENCE_THRESHOLD || STUDY_CLASSIFY_ALWAYS_REVIEW.has(best);
  return {
    classification: best,
    confidence,
    reason: studyClassReason(best),
    needs_review: needsReview,
    warnings: [],
  };
}

function studyClassReason(cls: StudyDocumentClass): string {
  switch (cls) {
    case 'old_exam_or_test':
      return 'Contiene preguntas con opciones o senales de examen/test.';
    case 'legal_text':
      return 'Contiene referencias normativas (ley, decreto, articulo).';
    case 'index_or_table_of_contents':
      return 'Parece un indice o programa con lista de temas.';
    case 'notes_or_summary':
      return 'Parece apuntes, resumen o esquema.';
    case 'syllabus_material':
      return 'Contiene desarrollo teorico de temario.';
    case 'irrelevant':
      return 'Parece contenido comercial/publicitario ajeno al estudio.';
    default:
      return 'Clasificado por heuristica.';
  }
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
  // Texto de cada SECCION / REFERENCIA concreta (clave = id del puntero). El
  // source_excerpt se valida contra el texto del puntero ELEGIDO por la unidad,
  // NUNCA contra la concatenacion de todas las secciones del material (SPEC 038 P0).
  section_texts: ReadonlyMap<string, string>;
  reference_texts: ReadonlyMap<string, string>;
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
  if (sectionId && !scope.section_texts.has(sectionId)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  if (referenceId && !scope.reference_texts.has(referenceId)) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  if (!sectionId && !referenceId) {
    return { ok: false, code: STUDY_ERROR.INVALID_OUTPUT };
  }
  // El excerpt se valida contra el texto del PUNTERO CONCRETO elegido (esa seccion
  // o esa referencia), nunca contra la concatenacion del material (SPEC 038 P0).
  const pointerText = sectionId
    ? scope.section_texts.get(sectionId)
    : referenceId
      ? scope.reference_texts.get(referenceId)
      : null;
  const grounded = groundedExcerpt(
    typeof unit.source_excerpt === 'string' ? unit.source_excerpt : null,
    pointerText ?? null,
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
