// TESTOPO - SPEC 034: contrato COMPARTIDO del OCR de PDFs escaneados anclado al
// SERVIDOR. Logica PURA (sin dependencias de Node ni de Deno) para que sea la
// UNICA fuente de verdad usada por:
//   - la Edge Function `ocr-material` (Deno), y
//   - los tests de vitest del backend (sin red, sin proveedor real).
//
// Aqui NO se llama a ningun proveedor, ni a Supabase, ni se leen secretos, ni se
// renderiza ningun PDF. Solo se definen: codigos de error de wire, limites,
// validacion ESTRICTA del body de la peticion (solo IDs/opciones; nunca imagenes,
// texto OCR ni claves), estados elegibles/de reintento, bandas de confianza y el
// mapeo HONESTO del resultado real a estados terminales del run/material.
//
// Reglas reflejadas (canonicas en el backend): SPEC 030 (OCR runs/pages, bandas
// de confianza, agregacion de texto usable) y SPEC 034 (frontera de servidor).

// ---------------------------------------------------------------------------
// Codigos de error de wire (estables, seguros para el cliente). NUNCA se
// devuelven prompts, errores crudos del proveedor, texto OCR completo, rutas
// internas, URLs firmadas ni secretos.
// ---------------------------------------------------------------------------
export const OCR_ERROR = {
  AUTH_REQUIRED: 'OCR_AUTH_REQUIRED',
  ACCESS_DENIED: 'OCR_ACCESS_DENIED',
  WORKSPACE_REQUIRED: 'OCR_WORKSPACE_REQUIRED',
  OPPOSITION_REQUIRED: 'OCR_OPPOSITION_REQUIRED',
  MATERIAL_REQUIRED: 'OCR_MATERIAL_REQUIRED',
  MATERIAL_NOT_FOUND: 'OCR_MATERIAL_NOT_FOUND',
  MATERIAL_NOT_PDF: 'OCR_MATERIAL_NOT_PDF',
  MATERIAL_OBSOLETE: 'OCR_MATERIAL_OBSOLETE',
  SCAN_NOT_DETECTED: 'OCR_SCAN_NOT_DETECTED',
  RETRY_NOT_ALLOWED: 'OCR_RETRY_NOT_ALLOWED',
  ARBITRARY_INPUT_FORBIDDEN: 'OCR_ARBITRARY_INPUT_FORBIDDEN',
  PROVIDER_NOT_CONFIGURED: 'OCR_PROVIDER_NOT_CONFIGURED',
  PROVIDER_FAILED: 'OCR_PROVIDER_FAILED',
  RENDER_FAILED: 'OCR_RENDER_FAILED',
  PAGE_RENDER_FAILED: 'OCR_PAGE_RENDER_FAILED',
  PAGE_FAILED: 'OCR_PAGE_FAILED',
  PAGE_LIMIT_EXCEEDED: 'OCR_PAGE_LIMIT_EXCEEDED',
  NO_TEXT_EXTRACTED: 'OCR_NO_TEXT_EXTRACTED',
  LOW_CONFIDENCE: 'OCR_LOW_CONFIDENCE',
  SAVE_FAILED: 'OCR_SAVE_FAILED',
  RETRY_FAILED: 'OCR_RETRY_FAILED',
  STORAGE_FAILED: 'OCR_STORAGE_FAILED',
  INVALID_REQUEST: 'OCR_INVALID_REQUEST',
} as const;

export type OcrErrorCode = (typeof OCR_ERROR)[keyof typeof OCR_ERROR];

// ---------------------------------------------------------------------------
// Diagnostico SEGURO del fallo de RASTERIZADO/RENDER del PDF en Edge (SPEC 034 fix).
// Codigos estables que se guardan en material_ocr_runs.errors y en
// material.extraction_error. NO incluyen contenido del PDF ni secretos. El render
// real (MuPDF WASM) corre en Deno; este clasificador es PURO y testeable en vitest.
// ---------------------------------------------------------------------------
export const OCR_RENDER_DIAG = {
  RENDERER_INIT_FAILED: 'renderer_init_failed',
  PDF_LOAD_FAILED: 'pdf_load_failed',
  PAGE_RASTERIZE_FAILED: 'page_rasterize_failed',
  PDF_PASSWORD_OR_ENCRYPTED: 'pdf_password_or_encrypted',
  PDF_TOO_LARGE: 'pdf_too_large',
  WASM_RUNTIME_FAILED: 'wasm_runtime_failed',
} as const;
export type OcrRenderDiag = (typeof OCR_RENDER_DIAG)[keyof typeof OCR_RENDER_DIAG];

// Etapa del render donde se produjo el fallo.
//   init = cargar/instanciar el motor (MuPDF WASM)
//   load = abrir el documento PDF
//   page = rasterizar una pagina
//   size = la imagen rasterizada excede el tamano maximo
export type RenderStage = 'init' | 'load' | 'page' | 'size';

// Mapea (etapa + mensaje de error) a un codigo de diagnostico seguro. El mensaje se
// inspecciona solo para senales genericas (password/encrypted, memoria/wasm,
// tamano); nunca se propaga el mensaje crudo a la respuesta.
export function classifyRenderFailure(args: {
  stage: RenderStage;
  message?: string | null;
}): OcrRenderDiag {
  const m = (args.message ?? '').toLowerCase();
  if (m.includes('password') || m.includes('encrypt') || m.includes('cifrad')) {
    return OCR_RENDER_DIAG.PDF_PASSWORD_OR_ENCRYPTED;
  }
  const mentionsWasm =
    m.includes('wasm') ||
    m.includes('webassembly') ||
    m.includes('instantiat') ||
    m.includes('out of memory') ||
    m.includes('memory access');
  if (
    m.includes('too large') ||
    m.includes('excede') ||
    m.includes('exceeds') ||
    m.includes('maximo') ||
    m.includes('max image')
  ) {
    return OCR_RENDER_DIAG.PDF_TOO_LARGE;
  }
  switch (args.stage) {
    case 'init':
      return mentionsWasm ? OCR_RENDER_DIAG.WASM_RUNTIME_FAILED : OCR_RENDER_DIAG.RENDERER_INIT_FAILED;
    case 'load':
      return OCR_RENDER_DIAG.PDF_LOAD_FAILED;
    case 'page':
      return mentionsWasm ? OCR_RENDER_DIAG.WASM_RUNTIME_FAILED : OCR_RENDER_DIAG.PAGE_RASTERIZE_FAILED;
    case 'size':
      return OCR_RENDER_DIAG.PDF_TOO_LARGE;
    default:
      return OCR_RENDER_DIAG.RENDERER_INIT_FAILED;
  }
}

// Mensaje seguro y humano para el bloqueo honesto sin proveedor (SPEC 034).
export const OCR_PROVIDER_NOT_CONFIGURED_MESSAGE =
  'OCR no disponible todavía: proveedor OCR no configurado en servidor.';

// ---------------------------------------------------------------------------
// Limites (SPEC 030/034). Acotan el procesamiento server-side por documento.
// ---------------------------------------------------------------------------
export const MAX_OCR_PAGES = 300;
export const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB por pagina temporal
export const MAX_OCR_CONCURRENT_PAGES = 3;
export const OCR_PER_PAGE_TIMEOUT_MS = 60000; // 60 s por pagina (SPEC 034)

// Bandas de confianza (SPEC 030). >=0.70 usable; 0.40-0.69 usable con advertencia;
// <0.40 fallida/revisable.
export const OCR_USABLE_THRESHOLD = 0.7;
export const OCR_WARNING_THRESHOLD = 0.4;

// SPEC 035: limites configurables por SECRETO de Edge Function. Un valor del
// entorno SOLO puede ENDURECER el limite (nunca superar el maximo seguro); si
// falta o es invalido, se usa el maximo seguro por defecto. PURA.
function clampOcrLimit(raw: string | null | undefined, min: number, max: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < min) return max;
  return Math.min(n, max);
}

export interface OcrLimits {
  maxPages: number;
  maxConcurrentPages: number;
  pageTimeoutMs: number;
}

export function resolveOcrLimits(env: {
  OCR_MAX_PAGES_PER_DOCUMENT?: string | null;
  OCR_MAX_CONCURRENT_PAGES?: string | null;
  OCR_PAGE_TIMEOUT_SECONDS?: string | null;
}): OcrLimits {
  const timeoutSecondsRaw = env.OCR_PAGE_TIMEOUT_SECONDS;
  const timeoutSeconds = clampOcrLimit(
    timeoutSecondsRaw,
    1,
    Math.floor(OCR_PER_PAGE_TIMEOUT_MS / 1000),
  );
  return {
    maxPages: clampOcrLimit(env.OCR_MAX_PAGES_PER_DOCUMENT, 1, MAX_OCR_PAGES),
    maxConcurrentPages: clampOcrLimit(env.OCR_MAX_CONCURRENT_PAGES, 1, MAX_OCR_CONCURRENT_PAGES),
    pageTimeoutMs: timeoutSeconds * 1000,
  };
}

// Para el MVP solo existe el modo automatico (escaneo completo).
export const OCR_MODES = ['auto'] as const;
export type OcrMode = (typeof OCR_MODES)[number];

export type OcrPageBand = 'completed' | 'warning' | 'failed';

// Estado terminal del run (CHECK de 032).
export type OcrRunStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed';

// Estado de extraccion del material tras el OCR (CHECK de 032).
export type OcrExtractionStatus =
  | 'ocr_processing'
  | 'completed_ocr'
  | 'completed_ocr_with_warnings'
  | 'ocr_failed';

// Estados de extraccion desde los que se puede LANZAR el primer OCR o REINTENTAR.
export const OCR_RETRY_STATES = [
  'scanned_detected',
  'ocr_failed',
  'completed_ocr_with_warnings',
] as const;
export type OcrRetryState = (typeof OCR_RETRY_STATES)[number];

// El primer OCR solo procede desde `scanned_detected`; los demas son reintentos.
export const OCR_FIRST_RUN_STATE = 'scanned_detected';

export function isOcrRetryState(status: unknown): status is OcrRetryState {
  return (
    typeof status === 'string' &&
    (OCR_RETRY_STATES as readonly string[]).includes(status)
  );
}

// Elegible para (re)lanzar OCR: primer run desde `scanned_detected` o reintento
// desde un estado terminal revisable.
export function isOcrEligibleState(status: unknown): boolean {
  return isOcrRetryState(status);
}

// ---------------------------------------------------------------------------
// Validacion ESTRICTA del body de la peticion. El navegador solo puede mandar
// IDs de scope y la opcion de reintento; jamas imagenes, texto OCR ni claves.
// ---------------------------------------------------------------------------
export const ALLOWED_REQUEST_FIELDS = new Set([
  'workspace_id',
  'opposition_id',
  'material_id',
  'mode',
  'force_retry',
]);

// Campos que, si aparecen, son un intento de inyectar OCR/imagen/secreto desde
// el navegador (SPEC 034).
export const FORBIDDEN_REQUEST_FIELDS = [
  'user_id',
  'image_base64',
  'image_url',
  'image',
  'page_image',
  'ocr_text',
  'fake_text',
  'raw_text',
  'text',
  'provider_prompt',
  'prompt',
  'api_key',
];

export interface NormalizedOcrRequest {
  workspace_id: string;
  opposition_id: string;
  material_id: string;
  mode: OcrMode;
  force_retry: boolean;
}

export type OcrRequestValidation =
  | { ok: true; value: NormalizedOcrRequest }
  | { ok: false; code: OcrErrorCode };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Valida y normaliza el body. NO confia en `user_id` (el actor sale del JWT).
export function validateOcrRequest(raw: unknown): OcrRequestValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, code: OCR_ERROR.INVALID_REQUEST };
  }
  const body = raw as Record<string, unknown>;

  // 1) Campos prohibidos = intento de imagen/texto OCR/secreto arbitrario.
  for (const forbidden of FORBIDDEN_REQUEST_FIELDS) {
    if (forbidden in body) {
      return { ok: false, code: OCR_ERROR.ARBITRARY_INPUT_FORBIDDEN };
    }
  }
  // 2) Campos desconocidos: se rechazan (whitelist estricta).
  for (const key of Object.keys(body)) {
    if (!ALLOWED_REQUEST_FIELDS.has(key)) {
      return { ok: false, code: OCR_ERROR.ARBITRARY_INPUT_FORBIDDEN };
    }
  }

  // 3) Scope obligatorio.
  if (!isNonEmptyString(body.workspace_id)) {
    return { ok: false, code: OCR_ERROR.WORKSPACE_REQUIRED };
  }
  if (!isNonEmptyString(body.opposition_id)) {
    return { ok: false, code: OCR_ERROR.OPPOSITION_REQUIRED };
  }
  if (!isNonEmptyString(body.material_id)) {
    return { ok: false, code: OCR_ERROR.MATERIAL_REQUIRED };
  }

  // 4) Opciones acotadas. `mode` por defecto 'auto'; `force_retry` opcional bool.
  const mode: OcrMode = body.mode === undefined ? 'auto' : (body.mode as OcrMode);
  if (!OCR_MODES.includes(mode)) {
    return { ok: false, code: OCR_ERROR.INVALID_REQUEST };
  }
  if (body.force_retry !== undefined && typeof body.force_retry !== 'boolean') {
    return { ok: false, code: OCR_ERROR.INVALID_REQUEST };
  }

  return {
    ok: true,
    value: {
      workspace_id: body.workspace_id.trim(),
      opposition_id: body.opposition_id.trim(),
      material_id: body.material_id.trim(),
      mode,
      force_retry: body.force_retry === true,
    },
  };
}

// ---------------------------------------------------------------------------
// Proveedor OCR/vision. La CLAVE es un secreto de SERVIDOR. Solo OpenAI esta
// soportado de verdad (usa OPENAI_API_KEY). NO se declara Anthropic como
// soportado para no prometer un proveedor con la clave de otro; si se cablea en
// el futuro debe usar ANTHROPIC_API_KEY, su secreto correcto. Funciones PURAS:
// no leen el entorno ellas mismas.
// ---------------------------------------------------------------------------
export const OCR_PROVIDERS = ['openai'] as const;

export const DEFAULT_OCR_VISION_MODEL = 'gpt-4o-mini';

export function isOcrProviderReady(args: {
  provider: string | null | undefined;
  apiKey: string | null | undefined;
}): boolean {
  const provider = (args.provider ?? '').toLowerCase();
  return (
    (OCR_PROVIDERS as readonly string[]).includes(provider) &&
    isNonEmptyString(args.apiKey)
  );
}

export interface ResolvedOcrProvider {
  provider: 'openai';
  apiKey: string;
  model: string;
}

// Resuelve el proveedor OCR desde el entorno de la Edge Function. null si no hay
// proveedor real configurado (=> 501 honesto, conserva el estado detectado).
export function resolveOcrProvider(env: {
  OCR_PROVIDER?: string | null;
  OPENAI_API_KEY?: string | null;
  OCR_MODEL?: string | null;
}): ResolvedOcrProvider | null {
  const provider = (env.OCR_PROVIDER ?? '').toLowerCase();
  if (provider !== 'openai') return null;
  if (!isNonEmptyString(env.OPENAI_API_KEY)) return null;
  return {
    provider: 'openai',
    apiKey: env.OPENAI_API_KEY.trim(),
    model: isNonEmptyString(env.OCR_MODEL) ? env.OCR_MODEL.trim() : DEFAULT_OCR_VISION_MODEL,
  };
}

// Instruccion de sistema para el OCR de una pagina escaneada con un modelo de
// vision. Pide SOLO transcribir el texto visible (sin interpretar ni inventar) y
// estimar una confianza 0..1.
export const OCR_VISION_SYSTEM_PROMPT = [
  'Eres un OCR de paginas escaneadas en espanol.',
  'Transcribe FIELMENTE el texto visible de la imagen, respetando el orden de lectura.',
  'No interpretes, no resumas, no inventes texto que no se vea.',
  'Devuelve JSON: { "text": string, "confidence": number(0..1), "warnings": string[] }.',
  'Si la pagina esta en blanco o ilegible, text="" y confidence baja.',
].join(' ');

export function ocrVisionResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'confidence', 'warnings'],
    properties: {
      text: { type: 'string' },
      confidence: { type: 'number' },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  };
}

// Construye la peticion de vision a OpenAI para UNA pagina (imagen como data URL
// base64). PURA: no hace fetch. La imagen la renderiza el servidor; el navegador
// NUNCA aporta imagenes ni texto OCR.
export function buildOcrVisionRequest(args: {
  model: string;
  imageDataUrl: string;
}): Record<string, unknown> {
  return {
    model: args.model,
    temperature: 0,
    messages: [
      { role: 'system', content: OCR_VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe el texto de esta pagina escaneada.' },
          { type: 'image_url', image_url: { url: args.imageDataUrl } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ocr_page',
        strict: true,
        schema: ocrVisionResponseSchema(),
      },
    },
  };
}

export interface OcrPageParse {
  text: string;
  confidence: number | null;
  warnings: string[];
}

// Parsea la salida JSON del modelo de vision para una pagina. PURA y tolerante:
// nunca lanza; ante salida invalida devuelve texto vacio y confianza null (la
// pagina se clasificara como fallida por ocrConfidenceBand).
export function parseOcrVisionResponse(content: unknown): OcrPageParse {
  if (!isNonEmptyString(content)) {
    return { text: '', confidence: null, warnings: ['Respuesta OCR vacia.'] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { text: '', confidence: null, warnings: ['Respuesta OCR no valida.'] };
  }
  const o = parsed as { text?: unknown; confidence?: unknown; warnings?: unknown };
  const text = typeof o.text === 'string' ? o.text : '';
  const confidence =
    typeof o.confidence === 'number' && Number.isFinite(o.confidence)
      ? Math.min(1, Math.max(0, o.confidence))
      : null;
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  return { text, confidence, warnings };
}

// ---------------------------------------------------------------------------
// Resultado REAL del procesamiento -> estados HONESTOS. Estas funciones puras
// son la unica fuente de verdad de la clasificacion por confianza y del estado
// terminal; la Edge Function las usa SOLO sobre paginas realmente procesadas.
// ---------------------------------------------------------------------------

// Banda de confianza de una pagina -> estado (SPEC 030).
export function ocrConfidenceBand(confidence: number | null | undefined): OcrPageBand {
  if (confidence == null || confidence < OCR_WARNING_THRESHOLD) {
    return 'failed';
  }
  if (confidence < OCR_USABLE_THRESHOLD) {
    return 'warning';
  }
  return 'completed';
}

export interface OcrTerminalOutcome {
  run_status: OcrRunStatus;
  extraction_status: OcrExtractionStatus;
  // Estado del material (modelo minimo): activo solo si OCR limpio.
  material_status: 'active' | 'needs_review';
}

// Mapea el resultado real (texto agregado usable, paginas fallidas y advertencias)
// al estado terminal. Un fallo total NO debe sobreescribir buen texto nativo: eso
// lo decide quien escribe `content_text`, no este mapeo. Reglas (SPEC 030/034):
//   - sin texto usable -> run failed / material ocr_failed + needs_review;
//   - texto usable con fallos o advertencias -> completed_with_warnings + needs_review;
//   - texto usable limpio -> completed + active.
export function mapOcrTerminalOutcome(args: {
  hasUsableText: boolean;
  failedPages: number;
  warningCount: number;
}): OcrTerminalOutcome {
  if (!args.hasUsableText) {
    return {
      run_status: 'failed',
      extraction_status: 'ocr_failed',
      material_status: 'needs_review',
    };
  }
  if (args.failedPages > 0 || args.warningCount > 0) {
    return {
      run_status: 'completed_with_warnings',
      extraction_status: 'completed_ocr_with_warnings',
      material_status: 'needs_review',
    };
  }
  return {
    run_status: 'completed',
    extraction_status: 'completed_ocr',
    material_status: 'active',
  };
}

// Media de confianza redondeada a 2 decimales de las paginas con confianza; null
// si ninguna pagina la aporto.
export function averageOcrConfidence(
  confidences: ReadonlyArray<number | null | undefined>,
): number | null {
  const valid = confidences.filter(
    (c): c is number => typeof c === 'number' && Number.isFinite(c),
  );
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

// Concatena el texto USABLE en orden ascendente de pagina (nunca paginas
// fallidas/saltadas). Devuelve cadena vacia si no hay texto usable.
export function aggregateUsableText(
  pages: ReadonlyArray<{ page_number: number; text: string; band: OcrPageBand }>,
): string {
  return pages
    .filter((p) => p.band !== 'failed' && p.text.trim().length > 0)
    .slice()
    .sort((a, b) => a.page_number - b.page_number)
    .map((p) => p.text.trim())
    .join('\n\n')
    .trim();
}
