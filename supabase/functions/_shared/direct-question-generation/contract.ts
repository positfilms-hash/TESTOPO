// TESTOPO - SPEC 039: contrato COMPARTIDO de la generacion DIRECTA de preguntas
// desde MATERIAL ESTUDIADO (SPEC 038). Logica PURA (sin dependencias de Node ni de
// Deno) = UNICA fuente de verdad usada por:
//   - la Edge Function `generate-questions-from-studied-material` (Deno), y
//   - los tests de vitest del backend (sin red, sin proveedor real).
//
// Camino INDEPENDIENTE: NO importa el contrato del flujo por tema
// (`generate-questions`) ni lo usa como dependencia. La evidencia factual procede
// EXCLUSIVAMENTE de unidades/conceptos estudiados (`material_study_units` /
// `material_study_concepts`, SPEC 038) y de sus secciones/referencias existentes.
//
// Aqui NO se llama a ningun proveedor, ni a Supabase, ni se leen secretos. Solo:
// codigos de error de wire, limites, validacion ESTRICTA del body (solo IDs/
// parametros de alcance; nunca texto/fuente/prompt/clave), anclaje POR PUNTERO del
// excerpt (la leccion de SPEC 038 P0: contra la unidad CONCRETA, no una bolsa
// global), validacion estructural de la salida del proveedor (incluida la regla
// dura de que la IA NUNCA produce `validated`) y constructores de filas.

// ---------------------------------------------------------------------------
// Codigos de error de wire (estables, seguros para el cliente). NO se devuelven
// prompts, errores del proveedor, excerpts completos, rutas internas ni secretos.
// ---------------------------------------------------------------------------
export const DQG_ERROR = {
  AUTH_REQUIRED: 'DIRECT_QG_AUTH_REQUIRED',
  ACCESS_DENIED: 'DIRECT_QG_ACCESS_DENIED',
  WORKSPACE_REQUIRED: 'DIRECT_QG_WORKSPACE_REQUIRED',
  OPPOSITION_REQUIRED: 'DIRECT_QG_OPPOSITION_REQUIRED',
  ARBITRARY_INPUT_FORBIDDEN: 'DIRECT_QG_ARBITRARY_INPUT_FORBIDDEN',
  STUDY_NOT_READY: 'DIRECT_QG_STUDY_NOT_READY',
  NO_EVIDENCE: 'DIRECT_QG_NO_EVIDENCE',
  SELECTION_FORBIDDEN: 'DIRECT_QG_SELECTION_FORBIDDEN',
  PROVIDER_NOT_CONFIGURED: 'DIRECT_QG_PROVIDER_NOT_CONFIGURED',
  PROVIDER_FAILED: 'DIRECT_QG_PROVIDER_FAILED',
  INVALID_OUTPUT: 'DIRECT_QG_INVALID_OUTPUT',
  NO_VALID_CANDIDATES: 'DIRECT_QG_NO_VALID_CANDIDATES',
  SAVE_FAILED: 'DIRECT_QG_SAVE_FAILED',
  INVALID_REQUEST: 'DIRECT_QG_INVALID_REQUEST',
} as const;

export type DqgErrorCode = (typeof DQG_ERROR)[keyof typeof DQG_ERROR];

// Mensaje seguro y humano para el bloqueo honesto sin proveedor (SPEC 039).
export const DQG_PROVIDER_NOT_CONFIGURED_MESSAGE =
  'La generación de preguntas desde material estudiado todavía no está configurada en servidor.';

// ---------------------------------------------------------------------------
// Limites (acotan seleccion, fuentes y caracteres enviados al proveedor).
// ---------------------------------------------------------------------------
export const MAX_DIRECT_QUESTION_COUNT = 20;
export const MIN_DIRECT_QUESTION_COUNT = 1;
export const MAX_DIRECT_SOURCE_CHARS = 20000;
export const MAX_DIRECT_SELECTED_IDS = 50; // cota pequena de la seleccion del cliente
export const MAX_DIRECT_UNITS = 40; // unidades de evidencia enviadas al proveedor

// SPEC 035/038: limites por SECRETO de Edge Function. Un valor del entorno SOLO
// puede ENDURECER (nunca superar el maximo seguro); ausente/invalido -> maximo.
function clampLimit(raw: string | null | undefined, min: number, max: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < min) return max;
  return Math.min(n, max);
}

export interface DirectLimits {
  maxQuestions: number;
  maxSourceChars: number;
  maxUnits: number;
}

export function resolveDirectLimits(env: {
  MAX_GENERATED_QUESTIONS?: string | null;
  MAX_QUESTION_SOURCE_CHARS?: string | null;
  MAX_DIRECT_EVIDENCE_UNITS?: string | null;
}): DirectLimits {
  return {
    maxQuestions: clampLimit(env.MAX_GENERATED_QUESTIONS, MIN_DIRECT_QUESTION_COUNT, MAX_DIRECT_QUESTION_COUNT),
    maxSourceChars: clampLimit(env.MAX_QUESTION_SOURCE_CHARS, 1, MAX_DIRECT_SOURCE_CHARS),
    maxUnits: clampLimit(env.MAX_DIRECT_EVIDENCE_UNITS, 1, MAX_DIRECT_UNITS),
  };
}

// Dificultad de una CANDIDATA (modelo minimo de pregunta, CLAUDE.md). La peticion
// admite ademas `mixed` (el proveedor decide por pregunta dentro de easy/medium/hard).
export const CANDIDATE_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type CandidateDifficulty = (typeof CANDIDATE_DIFFICULTIES)[number];
export const REQUEST_DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
export type RequestDifficulty = (typeof REQUEST_DIFFICULTIES)[number];

// Alcance de evidencia: todo el material estudiado, o una seleccion acotada.
export const DIRECT_SCOPES = [
  'all_studied_material',
  'selected_materials',
  'selected_units',
  'selected_concepts',
] as const;
export type DirectScope = (typeof DIRECT_SCOPES)[number];

// Estados de pregunta permitidos para una candidata IA (NUNCA `validated`).
export type CandidateStatus = 'pending_review' | 'needs_fix';
// Estados del run admitidos por el CHECK actual de `question_generation_runs` (023).
export type RunDbStatus = 'completed' | 'partial' | 'failed';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isCandidateDifficulty(value: unknown): value is CandidateDifficulty {
  return typeof value === 'string' && (CANDIDATE_DIFFICULTIES as readonly string[]).includes(value);
}

export function isRequestDifficulty(value: unknown): value is RequestDifficulty {
  return typeof value === 'string' && (REQUEST_DIFFICULTIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Validacion ESTRICTA del body. El navegador SOLO puede mandar IDs de alcance y
// parametros acotados; jamas texto/fuente/extracto/prompt/clave (SPEC 039).
// ---------------------------------------------------------------------------
export const ALLOWED_REQUEST_FIELDS = new Set([
  'workspace_id',
  'opposition_id',
  'material_study_run_id',
  'scope',
  'material_ids',
  'material_study_unit_ids',
  'material_study_concept_ids',
  'question_count',
  'difficulty',
]);

// Campos que, si aparecen, son un intento de inyectar contenido factual/prompt/
// clave o de suplantar la respuesta correcta.
export const FORBIDDEN_REQUEST_FIELDS = [
  'user_id',
  'source_text',
  'raw_text',
  'ocr_text',
  'text',
  'excerpt',
  'source_excerpt',
  'prompt',
  'custom_prompt',
  'context',
  'system_prompt',
  'messages',
  'api_key',
  'image_base64',
  'image_url',
  'correct_answer',
  'options',
  'statement',
];

export interface NormalizedDirectRequest {
  workspace_id: string;
  opposition_id: string;
  material_study_run_id: string | null;
  scope: DirectScope;
  material_ids: string[];
  material_study_unit_ids: string[];
  material_study_concept_ids: string[];
  question_count: number;
  difficulty: RequestDifficulty;
}

export type DirectRequestValidation =
  | { ok: true; value: NormalizedDirectRequest }
  | { ok: false; code: DqgErrorCode };

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

// Valida y normaliza el body. NO confia en `user_id` (el actor sale del JWT). Los
// arrays SOLO son validos cuando corresponden al `scope` elegido.
export function validateDirectGenerateRequest(raw: unknown): DirectRequestValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
  }
  const body = raw as Record<string, unknown>;

  // 1) Campos prohibidos = intento de texto/fuente/prompt/clave arbitrarios.
  for (const forbidden of FORBIDDEN_REQUEST_FIELDS) {
    if (forbidden in body) {
      return { ok: false, code: DQG_ERROR.ARBITRARY_INPUT_FORBIDDEN };
    }
  }
  // 2) Campos desconocidos: se rechazan (whitelist estricta).
  for (const key of Object.keys(body)) {
    if (!ALLOWED_REQUEST_FIELDS.has(key)) {
      return { ok: false, code: DQG_ERROR.ARBITRARY_INPUT_FORBIDDEN };
    }
  }

  // 3) Scope obligatorio.
  if (!isNonEmptyString(body.workspace_id)) {
    return { ok: false, code: DQG_ERROR.WORKSPACE_REQUIRED };
  }
  if (!isNonEmptyString(body.opposition_id)) {
    return { ok: false, code: DQG_ERROR.OPPOSITION_REQUIRED };
  }

  // 4) material_study_run_id opcional (string no vacio o ausente/null).
  let runId: string | null = null;
  if (body.material_study_run_id !== undefined && body.material_study_run_id !== null) {
    if (!isNonEmptyString(body.material_study_run_id)) {
      return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
    }
    runId = body.material_study_run_id.trim();
  }

  // 5) scope acotado.
  const scope = body.scope;
  if (!isNonEmptyString(scope) || !(DIRECT_SCOPES as readonly string[]).includes(scope)) {
    return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
  }
  const scopeValue = scope as DirectScope;

  // 6) cantidad y dificultad acotadas.
  if (
    typeof body.question_count !== 'number' ||
    !Number.isInteger(body.question_count) ||
    body.question_count < MIN_DIRECT_QUESTION_COUNT ||
    body.question_count > MAX_DIRECT_QUESTION_COUNT
  ) {
    return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
  }
  if (!isRequestDifficulty(body.difficulty)) {
    return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
  }

  // 7) arrays bien formados y dentro del limite.
  const materialIds = asStringIdArray(body.material_ids);
  const unitIds = asStringIdArray(body.material_study_unit_ids);
  const conceptIds = asStringIdArray(body.material_study_concept_ids);
  if (materialIds === null || unitIds === null || conceptIds === null) {
    return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
  }
  if (
    materialIds.length > MAX_DIRECT_SELECTED_IDS ||
    unitIds.length > MAX_DIRECT_SELECTED_IDS ||
    conceptIds.length > MAX_DIRECT_SELECTED_IDS
  ) {
    return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
  }

  // 8) coherencia scope <-> arrays: cada array solo es valido para su scope.
  const coherent = isSelectionCoherent(scopeValue, { materialIds, unitIds, conceptIds });
  if (!coherent) {
    return { ok: false, code: DQG_ERROR.INVALID_REQUEST };
  }

  return {
    ok: true,
    value: {
      workspace_id: body.workspace_id.trim(),
      opposition_id: body.opposition_id.trim(),
      material_study_run_id: runId,
      scope: scopeValue,
      material_ids: materialIds,
      material_study_unit_ids: unitIds,
      material_study_concept_ids: conceptIds,
      question_count: body.question_count,
      difficulty: body.difficulty,
    },
  };
}

// Cada scope exige SU array (no vacio) y prohibe los demas. `all_studied_material`
// no admite ninguna seleccion explicita.
export function isSelectionCoherent(
  scope: DirectScope,
  sel: { materialIds: string[]; unitIds: string[]; conceptIds: string[] },
): boolean {
  switch (scope) {
    case 'all_studied_material':
      return sel.materialIds.length === 0 && sel.unitIds.length === 0 && sel.conceptIds.length === 0;
    case 'selected_materials':
      return sel.materialIds.length > 0 && sel.unitIds.length === 0 && sel.conceptIds.length === 0;
    case 'selected_units':
      return sel.unitIds.length > 0 && sel.materialIds.length === 0 && sel.conceptIds.length === 0;
    case 'selected_concepts':
      return sel.conceptIds.length > 0 && sel.materialIds.length === 0 && sel.unitIds.length === 0;
    default:
      return false;
  }
}

// Estados de estudio del run que habilitan la generacion directa (SPEC 038/039).
export const READY_STUDY_RUN_STATUSES = new Set(['completed', 'completed_with_warnings']);

export function isStudyRunReady(status: unknown): boolean {
  return typeof status === 'string' && READY_STUDY_RUN_STATUSES.has(status);
}

// Estados de extraccion del material que lo hacen NO usable como fuente factual.
export const FORBIDDEN_MATERIAL_EXTRACTION_STATES = new Set(['failed', 'ocr_failed']);

// Decide si un material estudiado puede aportar evidencia factual: del scope,
// activo (no obsoleto) y legible (no failed/ocr_failed).
export function isUsableStudiedMaterial(material: {
  workspace_id?: string | null;
  opposition_id?: string | null;
  status?: string | null;
  extraction_status?: string | null;
}, scope: { workspace_id: string; opposition_id: string }): boolean {
  if (!material) return false;
  if (material.workspace_id !== scope.workspace_id) return false;
  if (material.opposition_id !== scope.opposition_id) return false;
  if (material.status === 'obsolete') return false;
  if (FORBIDDEN_MATERIAL_EXTRACTION_STATES.has(material.extraction_status ?? '')) return false;
  return true;
}

// IDs de evidencia REALMENTE disponibles para el run elegido, ya acotados por el
// servidor a workspace + oposicion + study run (materiales con unidad en el run,
// unidades del run, conceptos del run). Es la "verdad" contra la que se valida la
// seleccion del cliente.
export interface AvailableEvidenceIds {
  materialIds: ReadonlySet<string>;
  unitIds: ReadonlySet<string>;
  conceptIds: ReadonlySet<string>;
}

// SPEC 039 (P1): la seleccion del cliente debe validarse ENTERA contra el scope. Si
// UN SOLO id (material, unidad o concepto) no pertenece a workspace/oposicion/study
// run, se RECHAZA toda la peticion (`SELECTION_FORBIDDEN`); nunca se descartan ids
// ajenos en silencio. PURA y testeada en vitest (la Edge Function solo aporta los
// `available` recuperados de Supabase).
export function evaluateSelectionScope(
  request: {
    scope: DirectScope;
    material_ids: string[];
    material_study_unit_ids: string[];
    material_study_concept_ids: string[];
  },
  available: AvailableEvidenceIds,
): { ok: true } | { ok: false; code: DqgErrorCode } {
  const allIn = (ids: string[], pool: ReadonlySet<string>): boolean =>
    ids.length > 0 && ids.every((id) => pool.has(id));

  switch (request.scope) {
    case 'all_studied_material':
      return { ok: true };
    case 'selected_materials':
      return allIn(request.material_ids, available.materialIds)
        ? { ok: true }
        : { ok: false, code: DQG_ERROR.SELECTION_FORBIDDEN };
    case 'selected_units':
      return allIn(request.material_study_unit_ids, available.unitIds)
        ? { ok: true }
        : { ok: false, code: DQG_ERROR.SELECTION_FORBIDDEN };
    case 'selected_concepts':
      return allIn(request.material_study_concept_ids, available.conceptIds)
        ? { ok: true }
        : { ok: false, code: DQG_ERROR.SELECTION_FORBIDDEN };
    default:
      return { ok: false, code: DQG_ERROR.SELECTION_FORBIDDEN };
  }
}

// ---------------------------------------------------------------------------
// Evidencia + validacion ESTRUCTURAL de la salida del proveedor.
// ---------------------------------------------------------------------------
export interface CandidateOption {
  text: string;
  is_correct: boolean;
}

export interface ProviderDirectCandidate {
  statement?: unknown;
  options?: unknown;
  explanation?: unknown;
  difficulty?: unknown;
  material_id?: unknown;
  material_study_unit_id?: unknown;
  material_section_id?: unknown;
  source_reference_id?: unknown;
  source_excerpt?: unknown;
  warnings?: unknown;
  status?: unknown;
}

// Puntero trazable de una unidad estudiada (resuelto por el servidor).
export interface StudyUnitPointer {
  material_id: string;
  material_section_id: string | null;
  source_reference_id: string | null;
  topic_label: string; // etiqueta descriptiva derivada de la unidad (titulo)
  concept_id: string | null; // si la evidencia procede de un concepto anclado
}

export interface DirectEvidenceScope {
  material_ids: ReadonlySet<string>;
  unit_ids: ReadonlySet<string>;
  // Texto de CADA unidad (clave = unit_id) para anclar el excerpt contra la unidad
  // CONCRETA elegida, NUNCA contra una bolsa global (leccion SPEC 038 P0).
  unit_texts: ReadonlyMap<string, string>;
  unit_pointers: ReadonlyMap<string, StudyUnitPointer>;
}

export interface ValidatedDirectCandidate {
  statement: string;
  options: CandidateOption[];
  explanation: string;
  difficulty: CandidateDifficulty;
  topic_label: string;
  material_id: string;
  material_study_unit_id: string;
  material_study_concept_id: string | null;
  material_section_id: string | null;
  source_reference_id: string | null;
  source_excerpt: string;
  warnings: string[];
}

export type DirectCandidateValidation =
  | { ok: true; value: ValidatedDirectCandidate }
  | { ok: false; code: DqgErrorCode };

export function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Devuelve el excerpt de la IA SOLO si esta contenido en el texto de la unidad
// citada; si no, devuelve el texto de la unidad (nunca se guarda una cita
// inventada). Acotado a MAX_DIRECT_SOURCE_CHARS.
export function groundedExcerpt(
  aiExcerpt: string | null | undefined,
  unitText: string | null | undefined,
): string | null {
  const evidence = isNonEmptyString(unitText) ? unitText.trim() : null;
  if (isNonEmptyString(aiExcerpt) && evidence) {
    const needle = normalizeForMatch(aiExcerpt);
    if (needle.length > 0 && normalizeForMatch(evidence).includes(needle)) {
      return aiExcerpt.trim().slice(0, MAX_DIRECT_SOURCE_CHARS);
    }
  }
  return evidence ? evidence.slice(0, MAX_DIRECT_SOURCE_CHARS) : null;
}

// Valida una candidata del proveedor contra la evidencia estudiada. Rechaza:
// estructura incompleta, < 2 opciones, distinto de exactamente 1 correcta,
// dificultad invalida, unidad estudiada ajena/ausente, material/seccion/referencia
// que no coinciden con el puntero de la unidad, y cualquier `validated` propuesto
// por la IA. El excerpt se ancla SIEMPRE contra el texto de la unidad CONCRETA.
export function validateDirectCandidate(
  candidate: ProviderDirectCandidate,
  scope: DirectEvidenceScope,
): DirectCandidateValidation {
  const warnings: string[] = [];

  // Regla dura: la IA jamas crea `validated`.
  if (candidate.status === 'validated') {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  if (!isNonEmptyString(candidate.statement)) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  if (!isNonEmptyString(candidate.explanation)) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  if (!isCandidateDifficulty(candidate.difficulty)) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }

  // Opciones: >= 2, todas con texto, exactamente una correcta, sin duplicados.
  if (!Array.isArray(candidate.options) || candidate.options.length < 2) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  const options: CandidateOption[] = [];
  const seen = new Set<string>();
  for (const raw of candidate.options) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
    }
    const o = raw as Record<string, unknown>;
    if (!isNonEmptyString(o.text) || typeof o.is_correct !== 'boolean') {
      return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
    }
    const norm = normalizeForMatch(o.text);
    if (seen.has(norm)) {
      return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
    }
    seen.add(norm);
    options.push({ text: o.text.trim(), is_correct: o.is_correct });
  }
  if (options.filter((o) => o.is_correct).length !== 1) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }

  // Puntero OBLIGATORIO: la candidata debe citar una unidad estudiada del scope.
  const unitId = isNonEmptyString(candidate.material_study_unit_id)
    ? candidate.material_study_unit_id
    : null;
  if (!unitId || !scope.unit_ids.has(unitId)) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  const pointer = scope.unit_pointers.get(unitId);
  if (!pointer) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }

  // Material: si la IA lo declara, debe coincidir con el de la unidad; si no, se
  // deriva del puntero (no se confia en la IA para inventar material).
  if (isNonEmptyString(candidate.material_id) && candidate.material_id !== pointer.material_id) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  // Seccion/referencia: si la IA las declara, deben coincidir con las de la unidad.
  if (
    isNonEmptyString(candidate.material_section_id) &&
    candidate.material_section_id !== pointer.material_section_id
  ) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  if (
    isNonEmptyString(candidate.source_reference_id) &&
    candidate.source_reference_id !== pointer.source_reference_id
  ) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }

  // Excerpt anclado contra el texto de la unidad CONCRETA citada.
  const grounded = groundedExcerpt(
    typeof candidate.source_excerpt === 'string' ? candidate.source_excerpt : null,
    scope.unit_texts.get(unitId) ?? null,
  );
  if (!isNonEmptyString(grounded)) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  if (
    isNonEmptyString(candidate.source_excerpt) &&
    normalizeForMatch(candidate.source_excerpt) !== normalizeForMatch(grounded)
  ) {
    warnings.push(
      'El fragmento citado por la IA no estaba contenido en la unidad estudiada; se conservó la evidencia estudiada.',
    );
  }

  const providerWarnings = Array.isArray(candidate.warnings)
    ? candidate.warnings.filter(isNonEmptyString).map((w) => w.trim())
    : [];

  return {
    ok: true,
    value: {
      statement: candidate.statement.trim(),
      options,
      explanation: candidate.explanation.trim(),
      difficulty: candidate.difficulty,
      topic_label: pointer.topic_label,
      material_id: pointer.material_id,
      material_study_unit_id: unitId,
      material_study_concept_id: pointer.concept_id,
      material_section_id: pointer.material_section_id,
      source_reference_id: pointer.source_reference_id,
      source_excerpt: grounded,
      warnings: [...warnings, ...providerWarnings],
    },
  };
}

// Estado final de la candidata: sin hallazgo/aviso -> pending_review; con warnings
// -> needs_fix. NUNCA validated (SPEC 039).
export function candidateStatus(args: { warnings: string[] }): CandidateStatus {
  return args.warnings.length > 0 ? 'needs_fix' : 'pending_review';
}

// Mapea el ciclo de vida del run a los valores del CHECK de 023.
export function mapRunStatus(args: {
  created: number;
  requested: number;
  hadErrors: boolean;
}): RunDbStatus {
  if (args.created === 0) return 'failed';
  if (args.hadErrors || args.created < args.requested) return 'partial';
  return 'completed';
}

// ---------------------------------------------------------------------------
// Proveedor (OpenAI-only). La CLAVE es secreto de SERVIDOR. null => 501 honesto.
// ---------------------------------------------------------------------------
export interface ResolvedProvider {
  provider: 'openai';
  apiKey: string;
  model: string;
}
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export function resolveProvider(env: {
  AI_PROVIDER?: string | null;
  OPENAI_API_KEY?: string | null;
  OPENAI_MODEL?: string | null;
}): ResolvedProvider | null {
  const provider = (env.AI_PROVIDER ?? '').toLowerCase();
  if (provider !== 'openai') return null;
  if (!isNonEmptyString(env.OPENAI_API_KEY)) return null;
  return {
    provider: 'openai',
    apiKey: env.OPENAI_API_KEY.trim(),
    model: isNonEmptyString(env.OPENAI_MODEL) ? env.OPENAI_MODEL.trim() : DEFAULT_OPENAI_MODEL,
  };
}

// ---------------------------------------------------------------------------
// Construccion de la peticion al proveedor + parseo de salida. PUROS (sin red).
// ---------------------------------------------------------------------------
export const DQG_SYSTEM_PROMPT = [
  'Eres un generador de preguntas tipo test para oposiciones en espanol.',
  'USA EXCLUSIVAMENTE las UNIDADES DE ESTUDIO proporcionadas por el servidor.',
  'No uses conocimiento externo, no inventes datos, no copies preguntas de examenes antiguos.',
  'Cada pregunta debe tener: enunciado, 3-4 opciones, EXACTAMENTE una correcta, explicacion,',
  'dificultad (easy|medium|hard), el material_study_unit_id EXACTO de la unidad que la sustenta',
  'y un source_excerpt CONTENIDO literalmente en el texto de esa unidad.',
  'NUNCA marques una pregunta como validated: solo el revisor humano valida.',
].join(' ');

export function openAIResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['candidates'],
    properties: {
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'statement',
            'options',
            'explanation',
            'difficulty',
            'material_id',
            'material_study_unit_id',
            'source_excerpt',
          ],
          properties: {
            statement: { type: 'string' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['text', 'is_correct'],
                properties: {
                  text: { type: 'string' },
                  is_correct: { type: 'boolean' },
                },
              },
            },
            explanation: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            material_id: { type: 'string' },
            material_study_unit_id: { type: 'string' },
            source_excerpt: { type: 'string' },
          },
        },
      },
    },
  };
}

export interface PromptUnit {
  unit_id: string;
  material_id: string;
  topic_label: string;
  excerpt: string;
}

export function buildOpenAIRequest(args: {
  model: string;
  difficulty: RequestDifficulty;
  question_count: number;
  units: ReadonlyArray<PromptUnit>;
}): Record<string, unknown> {
  const unitBlock = args.units
    .map(
      (u, i) =>
        `UNIDAD ${i + 1} [material_id=${u.material_id}; material_study_unit_id=${u.unit_id}; tema="${u.topic_label}"]\n${u.excerpt}`,
    )
    .join('\n\n');
  const userContent = [
    `Dificultad solicitada: ${args.difficulty}`,
    `Numero de preguntas: ${args.question_count}`,
    'Genera preguntas SOLO desde estas unidades de estudio, citando el material_study_unit_id exacto:',
    unitBlock,
  ].join('\n\n');

  return {
    model: args.model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: DQG_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'studied_material_questions', strict: true, schema: openAIResponseSchema() },
    },
  };
}

export type ParseResult =
  | { ok: true; candidates: ProviderDirectCandidate[] }
  | { ok: false; code: DqgErrorCode };

export function parseProviderCandidates(content: unknown): ParseResult {
  if (!isNonEmptyString(content)) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  const root = parsed as { candidates?: unknown };
  if (typeof root !== 'object' || root === null || !Array.isArray(root.candidates)) {
    return { ok: false, code: DQG_ERROR.INVALID_OUTPUT };
  }
  return { ok: true, candidates: root.candidates as ProviderDirectCandidate[] };
}

// ---------------------------------------------------------------------------
// Constructores de filas de persistencia (esquema 023/028-E + enlace 036). PUROS.
// `topic_id` queda NULL en este flujo; `topic` lleva la etiqueta descriptiva.
// ---------------------------------------------------------------------------
export interface QuestionRow {
  id: string;
  workspace_id: string;
  opposition_id: string;
  statement: string;
  correct_answer: string | null;
  explanation: string;
  source: Record<string, unknown>;
  topic: string;
  topic_id: null;
  difficulty: CandidateDifficulty;
  status: CandidateStatus;
  generation_metadata: Record<string, unknown>;
  material_section_id: string | null;
  source_reference_id: string | null;
  material_study_run_id: string;
  material_study_unit_id: string;
  material_study_concept_id: string | null;
}

export function buildQuestionRow(args: {
  id: string;
  workspace_id: string;
  opposition_id: string;
  candidate: ValidatedDirectCandidate;
  status: CandidateStatus;
  study_run_id: string;
  run_id: string;
  provider: string;
  model: string;
  now: string;
}): QuestionRow {
  const correct = args.candidate.options.find((o) => o.is_correct) ?? null;
  return {
    id: args.id,
    workspace_id: args.workspace_id,
    opposition_id: args.opposition_id,
    statement: args.candidate.statement,
    correct_answer: correct ? correct.text : null,
    explanation: args.candidate.explanation,
    source: {
      id: args.id,
      material_id: args.candidate.material_id,
      reference: args.candidate.topic_label,
      excerpt: args.candidate.source_excerpt,
      material_study_unit_id: args.candidate.material_study_unit_id,
      status: 'active',
    },
    topic: args.candidate.topic_label,
    topic_id: null,
    difficulty: args.candidate.difficulty,
    status: args.status,
    generation_metadata: {
      generated_by_ai: true,
      generation_run_id: args.run_id,
      material_study_run_id: args.study_run_id,
      provider: args.provider,
      model: args.model,
      created_at: args.now,
    },
    material_section_id: args.candidate.material_section_id,
    source_reference_id: args.candidate.source_reference_id,
    material_study_run_id: args.study_run_id,
    material_study_unit_id: args.candidate.material_study_unit_id,
    material_study_concept_id: args.candidate.material_study_concept_id,
  };
}

export interface OptionRow {
  question_id: string;
  workspace_id: string;
  opposition_id: string;
  text: string;
  is_correct: boolean;
  order_index: number;
}

export function buildOptionRows(args: {
  question_id: string;
  workspace_id: string;
  opposition_id: string;
  candidate: ValidatedDirectCandidate;
}): OptionRow[] {
  return args.candidate.options.map((o, idx) => ({
    question_id: args.question_id,
    workspace_id: args.workspace_id,
    opposition_id: args.opposition_id,
    text: o.text,
    is_correct: o.is_correct,
    order_index: idx,
  }));
}

export interface ValidationRow {
  question_id: string;
  workspace_id: string;
  opposition_id: string;
  status: 'passed' | 'passed_with_warnings';
  passed: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
  recommended_status: CandidateStatus;
  validator_version: string;
}

export function buildValidationRow(args: {
  question_id: string;
  workspace_id: string;
  opposition_id: string;
  status: CandidateStatus;
  warnings: string[];
}): ValidationRow {
  const hasWarnings = args.warnings.length > 0 || args.status === 'needs_fix';
  return {
    question_id: args.question_id,
    workspace_id: args.workspace_id,
    opposition_id: args.opposition_id,
    status: hasWarnings ? 'passed_with_warnings' : 'passed',
    passed: true,
    errors: [],
    warnings: args.warnings,
    info: [],
    recommended_status: args.status,
    validator_version: 'server-direct-studied-1',
  };
}

// ---------------------------------------------------------------------------
// Orquestador PURO del ciclo de vida del RUN (el run se crea ANTES de cualquier
// candidata; proveedor/parsing/persistencia fallidos -> failed/partial coherente;
// `created` solo cuenta candidatas COMPLETAMENTE persistidas). Igual disciplina que
// SPEC 033, pero INDEPENDIENTE (no importa su contrato).
// ---------------------------------------------------------------------------
export interface DirectRunPort {
  createRun(): Promise<boolean>;
  saveCandidate(candidate: ValidatedDirectCandidate): Promise<boolean>;
  finalizeRun(status: RunDbStatus, createdCount: number, errors: string[]): Promise<boolean>;
}

export interface ProducedCandidates {
  ok: boolean;
  code?: DqgErrorCode;
  candidates: ValidatedDirectCandidate[];
}

export interface RunResult {
  ok: boolean;
  code?: DqgErrorCode;
  httpStatus: number;
  created: number;
}

export async function runDirectGeneration(args: {
  port: DirectRunPort;
  requested: number;
  produce: () => Promise<ProducedCandidates>;
}): Promise<RunResult> {
  const runCreated = await args.port.createRun();
  if (!runCreated) {
    return { ok: false, code: DQG_ERROR.SAVE_FAILED, httpStatus: 502, created: 0 };
  }

  const produced = await args.produce();
  if (!produced.ok) {
    const code = produced.code ?? DQG_ERROR.PROVIDER_FAILED;
    await args.port.finalizeRun('failed', 0, [code]);
    return {
      ok: false,
      code,
      httpStatus: code === DQG_ERROR.PROVIDER_FAILED ? 502 : 422,
      created: 0,
    };
  }

  let created = 0;
  let hadErrors = false;
  const errors: string[] = [];
  for (const candidate of produced.candidates) {
    if (created >= args.requested) break;
    const saved = await args.port.saveCandidate(candidate);
    if (saved) {
      created += 1;
    } else {
      hadErrors = true;
      if (!errors.includes(DQG_ERROR.SAVE_FAILED)) errors.push(DQG_ERROR.SAVE_FAILED);
    }
  }

  if (created === 0) {
    await args.port.finalizeRun('failed', 0, errors);
    const saveFailed = errors.includes(DQG_ERROR.SAVE_FAILED);
    return {
      ok: false,
      code: saveFailed ? DQG_ERROR.SAVE_FAILED : DQG_ERROR.NO_VALID_CANDIDATES,
      httpStatus: saveFailed ? 502 : 422,
      created: 0,
    };
  }
  const status = mapRunStatus({ created, requested: args.requested, hadErrors });
  const finalized = await args.port.finalizeRun(status, created, errors);
  if (!finalized) {
    return { ok: false, code: DQG_ERROR.SAVE_FAILED, httpStatus: 502, created };
  }
  return { ok: true, httpStatus: 200, created };
}
