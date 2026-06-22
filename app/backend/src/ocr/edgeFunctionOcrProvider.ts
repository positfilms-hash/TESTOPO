// Proveedor OCR real a traves de una Edge Function de confianza (SPEC 030,
// Fase 2). El navegador renderiza la pagina a imagen (sin secretos) y delega el
// reconocimiento en la Edge Function `ocr-material`, que es quien guarda la CLAVE
// del proveedor OCR/vision como secreto de SERVIDOR. La clave NUNCA viaja al
// frontend/Vite; aqui solo se envia la imagen + el numero de pagina y se recibe
// texto + confianza.
//
// Contrato HTTP con la Edge Function (POST JSON):
//   request : { page_number: number, image_base64: string }
//   response: { text: string, confidence: number | null, warnings?: string[] }
//
// Un fallo de transporte/respuesta lanza OcrError(PAGE_FAILED); MaterialOcrService
// lo captura por pagina y la marca como fallida sin romper el run.

import type { OcrPageResult, OcrProvider, RenderedPage } from './ocrProvider.js';
import { OcrError, OcrErrorCode } from './ocrErrors.js';

export interface EdgeFunctionOcrProviderOptions {
  /** URL de la Edge Function de OCR (p. ej. .../functions/v1/ocr-material). */
  url: string;
  /** Modelo informado (solo metadata; el modelo real lo decide la funcion). */
  model?: string | null;
  /** Token de la sesion del gestor para autenticar la llamada (Bearer). */
  getAuthToken?: () => Promise<string | null> | string | null;
  /** `fetch` inyectable (tests). Por defecto el global. */
  fetchImpl?: typeof fetch;
}

export class EdgeFunctionOcrProvider implements OcrProvider {
  readonly name = 'edge-function-ocr';
  readonly model: string | null;

  constructor(private readonly options: EdgeFunctionOcrProviderOptions) {
    this.model = options.model ?? null;
  }

  async recognizePage(page: RenderedPage): Promise<OcrPageResult> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new OcrError(
        OcrErrorCode.PROVIDER_NOT_CONFIGURED,
        'No hay `fetch` disponible para llamar a la Edge Function de OCR.',
      );
    }

    const token = this.options.getAuthToken
      ? await this.options.getAuthToken()
      : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetchImpl(this.options.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          page_number: page.page_number,
          image_base64: toBase64(page.image),
        }),
      });
    } catch {
      throw new OcrError(
        OcrErrorCode.PAGE_FAILED,
        'No se pudo contactar con el servicio OCR.',
      );
    }

    if (!response.ok) {
      throw new OcrError(
        OcrErrorCode.PAGE_FAILED,
        `El servicio OCR respondio con estado ${response.status}.`,
      );
    }

    let data: { text?: unknown; confidence?: unknown; warnings?: unknown };
    try {
      data = (await response.json()) as typeof data;
    } catch {
      throw new OcrError(OcrErrorCode.PAGE_FAILED, 'Respuesta OCR no valida.');
    }

    return {
      page_number: page.page_number,
      text: typeof data.text === 'string' ? data.text : '',
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
      warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
    };
  }
}

// Base64 multiplataforma (Node y navegador) sin dependencias.
function toBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }
  const maybeBuffer = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
