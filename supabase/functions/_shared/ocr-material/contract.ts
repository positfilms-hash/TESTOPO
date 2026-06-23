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
// Proveedor OCR/vision. La CLAVE es un secreto de SERVIDOR. Esta funcion PURA
// decide si hay un proveedor real configurado (sin leer el entorno ella misma).
// ---------------------------------------------------------------------------
export const OCR_PROVIDERS = ['openai', 'anthropic'] as const;

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
