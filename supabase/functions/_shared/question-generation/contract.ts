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

// SPEC 035: limites configurables por SECRETO de Edge Function. Un valor del
// entorno SOLO puede ENDURECER el limite (nunca superar el maximo seguro de
// arriba); si falta o es invalido, se usa el maximo seguro por defecto. PURA.
function clampLimit(
  raw: string | null | undefined,
  min: number,
  max: number,
): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < min) return max; // ausente/invalido -> maximo seguro
  return Math.min(n, max);
}

export interface QuestionLimits {
  maxQuestions: number;
  maxSourceChars: number;
}

export function resolveQuestionLimits(env: {
  MAX_GENERATED_QUESTIONS?: string | null;
  MAX_QUESTION_SOURCE_CHARS?: string | null;
}): QuestionLimits {
  return {
    maxQuestions: clampLimit(env.MAX_GENERATED_QUESTIONS, MIN_QUESTION_COUNT, MAX_QUESTION_COUNT),
    maxSourceChars: clampLimit(env.MAX_QUESTION_SOURCE_CHARS, 1, MAX_QUESTION_SOURCE_CHARS),
  };
}

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

// ---------------------------------------------------------------------------
// SPEC 033 (flujo real): resolucion de proveedor, elegibilidad de secciones,
// construccion de la peticion al proveedor, parseo de salida y constructores de
// filas de persistencia. Todo PURO (sin red ni Supabase) y testeado en vitest.
// ---------------------------------------------------------------------------

// Proveedor SOPORTADO de verdad. Solo OpenAI: usa OPENAI_API_KEY. (Anthropic NO
// se declara como soportado para no prometer un proveedor con la clave de otro;
// si en el futuro se cablea, debe usar ANTHROPIC_API_KEY, su secreto correcto.)
export interface ResolvedProvider {
  provider: 'openai';
  apiKey: string;
  model: string;
}

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

// Resuelve el proveedor desde el entorno de la Edge Function. Devuelve null si no
// hay un proveedor real configurado (=> 501 honesto, sin escrituras).
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
// Validacion de una `topic_source_reference` ANTES de usarla como evidencia
// factual (SPEC 033). El servidor resuelve el material, su clasificacion EFECTIVA
// (document_classifications mas reciente, 028-B) y el puntero concreto, y solo
// entonces se ancla la fuente. PURA y testeada en vitest.
// ---------------------------------------------------------------------------

// Estados de extraccion del material que lo hacen NO usable como fuente factual.
export const FORBIDDEN_MATERIAL_EXTRACTION_STATES = new Set(['failed', 'ocr_failed']);

export interface TopicReferenceMaterial {
  workspace_id?: string | null;
  opposition_id?: string | null;
  status?: string | null; // materials.status (active/obsolete/...)
  extraction_status?: string | null;
}

export interface EffectiveClassification {
  classification?: string | null; // document_classifications.classification (028-B)
  needs_review?: boolean | null;
}

export type RefEligibility = { ok: true } | { ok: false; reason: string };

// Decide si una referencia de tema es evidencia PRIMARIA factual valida. Rechaza:
// distinto workspace/oposicion, material inexistente/obsoleto/no legible
// (failed/ocr_failed), clasificacion efectiva no permitida (irrelevant/
// not_analyzable/ambiguous/old_exam_or_test) o marcada needs_review, y ausencia de
// puntero concreto valido (seccion/referencia ya resuelta por el servidor).
export function evaluateTopicSourceReference(args: {
  requestWorkspaceId: string;
  requestOppositionId: string;
  refOppositionId?: string | null;
  material: TopicReferenceMaterial | null | undefined;
  classification: EffectiveClassification | null | undefined;
  hasValidConcretePointer: boolean;
}): RefEligibility {
  if (args.refOppositionId && args.refOppositionId !== args.requestOppositionId) {
    return { ok: false, reason: 'opposition_mismatch' };
  }
  const material = args.material;
  if (!material) return { ok: false, reason: 'material_not_found' };
  if (material.workspace_id !== args.requestWorkspaceId) {
    return { ok: false, reason: 'workspace_mismatch' };
  }
  if (material.opposition_id !== args.requestOppositionId) {
    return { ok: false, reason: 'opposition_mismatch' };
  }
  if (material.status === 'obsolete') return { ok: false, reason: 'material_obsolete' };
  if (FORBIDDEN_MATERIAL_EXTRACTION_STATES.has(material.extraction_status ?? '')) {
    return { ok: false, reason: 'material_unreadable' };
  }
  const cls = args.classification;
  if (
    !cls ||
    !isEligiblePrimaryClass(cls.classification) ||
    cls.needs_review === true
  ) {
    return { ok: false, reason: 'classification_forbidden' };
  }
  if (!args.hasValidConcretePointer) {
    return { ok: false, reason: 'no_concrete_pointer' };
  }
  return { ok: true };
}

// material_sections.classification (028-C) -> elegibilidad como evidencia
// PRIMARIA factual. `old_exam_content` solo aporta estilo/cobertura secundaria.
export const ELIGIBLE_SECTION_CLASSIFICATIONS = [
  'study_content',
  'legal_content',
  'summary_content',
  'index_content',
] as const;

export function isEligiblePrimarySection(args: {
  classification: unknown;
  status: unknown;
}): boolean {
  return (
    typeof args.classification === 'string' &&
    (ELIGIBLE_SECTION_CLASSIFICATIONS as readonly string[]).includes(args.classification) &&
    args.status === 'active'
  );
}

export function isSecondaryStyleSection(classification: unknown): boolean {
  return classification === 'old_exam_content';
}

// Instruccion de sistema (resumen canonico de
// prompts/server-side-source-grounded-question-generator.md). Vive aqui para que
// la Edge Function la despliegue sin leer ficheros del repo en runtime.
export const QG_SYSTEM_PROMPT = [
  'Eres un generador de preguntas tipo test para oposiciones en espanol.',
  'USA EXCLUSIVAMENTE los fragmentos de fuente proporcionados por el servidor.',
  'No uses conocimiento externo, no inventes datos, no copies preguntas de examenes antiguos.',
  'Cada pregunta debe tener: enunciado, 3-4 opciones, EXACTAMENTE una correcta, explicacion,',
  'dificultad (easy|medium|hard), y el puntero de fuente concreto que te indique el servidor',
  '(material_id + material_section_id o source_reference_id) y un source_excerpt CONTENIDO en el',
  'fragmento. NUNCA marques una pregunta como validated: solo el revisor humano valida.',
].join(' ');

// Esquema de salida estructurada (OpenAI json_schema strict).
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
            'topic_id',
            'material_id',
            'material_section_id',
            'source_reference_id',
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
            topic_id: { type: 'string' },
            material_id: { type: 'string' },
            material_section_id: { type: ['string', 'null'] },
            source_reference_id: { type: ['string', 'null'] },
            source_excerpt: { type: 'string' },
          },
        },
      },
    },
  };
}

export interface PromptSource {
  material_id: string;
  material_section_id: string | null;
  source_reference_id: string | null;
  topic_source_reference_id?: string | null;
  excerpt: string;
}

// Construye el cuerpo de la peticion a OpenAI Chat Completions con salida
// estructurada. PURO: no hace fetch. El servidor pasa el modelo y las fuentes
// concretas; el usuario del navegador NUNCA aporta texto.
export function buildOpenAIRequest(args: {
  model: string;
  topic_title: string;
  difficulty: Difficulty;
  question_count: number;
  sources: ReadonlyArray<PromptSource>;
  style_note?: string | null;
}): Record<string, unknown> {
  const sourceBlock = args.sources
    .map((s, i) => {
      const pointer = s.material_section_id
        ? `material_section_id=${s.material_section_id}`
        : s.source_reference_id
          ? `source_reference_id=${s.source_reference_id}`
          : 'sin puntero';
      return `FUENTE ${i + 1} [material_id=${s.material_id}; ${pointer}]\n${s.excerpt}`;
    })
    .join('\n\n');
  const userContent = [
    `Tema: ${args.topic_title}`,
    `Dificultad solicitada: ${args.difficulty}`,
    `Numero de preguntas: ${args.question_count}`,
    args.style_note ? `Contexto de estilo (NO factual): ${args.style_note}` : null,
    'Genera preguntas SOLO desde estas fuentes, citando el puntero exacto:',
    sourceBlock,
  ]
    .filter((x): x is string => typeof x === 'string')
    .join('\n\n');

  return {
    model: args.model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: QG_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'grounded_questions',
        strict: true,
        schema: openAIResponseSchema(),
      },
    },
  };
}

export type ParseResult =
  | { ok: true; candidates: ProviderCandidate[] }
  | { ok: false; code: QgErrorCode };

// Parsea el contenido JSON devuelto por el proveedor. PURO. No valida anclaje
// (eso lo hace validateCandidate); solo asegura una estructura minima.
export function parseProviderCandidates(content: unknown): ParseResult {
  if (!isNonEmptyString(content)) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }
  const root = parsed as { candidates?: unknown };
  if (typeof root !== 'object' || root === null || !Array.isArray(root.candidates)) {
    return { ok: false, code: QG_ERROR.INVALID_OUTPUT };
  }
  return { ok: true, candidates: root.candidates as ProviderCandidate[] };
}

// --- Constructores de filas de persistencia (esquema SPEC 023 + 028-E). PUROS. ---

export interface QuestionRow {
  id: string;
  workspace_id: string;
  opposition_id: string;
  statement: string;
  correct_answer: string | null;
  explanation: string;
  source: Record<string, unknown>;
  topic: string;
  topic_id: string;
  difficulty: Difficulty;
  status: CandidateStatus;
  generation_metadata: Record<string, unknown>;
  material_section_id: string | null;
  source_reference_id: string | null;
  topic_source_reference_id: string | null;
}

export function buildQuestionRow(args: {
  id: string;
  workspace_id: string;
  opposition_id: string;
  topic_id: string;
  topic_title: string;
  candidate: ValidatedCandidate;
  status: CandidateStatus;
  run_id: string;
  provider: string;
  model: string;
  topic_source_reference_id?: string | null;
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
      reference: args.topic_title,
      excerpt: args.candidate.source_excerpt,
      status: 'active',
    },
    topic: args.topic_title,
    topic_id: args.topic_id,
    difficulty: args.candidate.difficulty,
    status: args.status,
    generation_metadata: {
      generated_by_ai: true,
      generation_run_id: args.run_id,
      provider: args.provider,
      model: args.model,
      created_at: args.now,
    },
    material_section_id: args.candidate.material_section_id,
    source_reference_id: args.candidate.source_reference_id,
    topic_source_reference_id: args.topic_source_reference_id ?? null,
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
  candidate: ValidatedCandidate;
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

// La candidata ya paso validateCandidate (estructuralmente valida y anclada): el
// informe automatico es passed / passed_with_warnings (NUNCA failed: una
// candidata que fallaria no se persiste). El estado recomendado es el de la
// candidata (pending_review | needs_fix).
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
    validator_version: 'server-grounded-1',
  };
}
