// TESTOPO - SPEC 034: render server-side de un PDF a imagenes PNG por pagina,
// compatible con Supabase Edge Functions (Deno). Usa MuPDF WASM.
//
// IMPORTANTE (honestidad): este modulo NO se ejecuta en el suite de vitest (es
// codigo Deno). Su comportamiento real (que MuPDF inicialice y rasterice dentro
// del runtime de Edge Functions, con sus limites de memoria/tiempo) SOLO puede
// verificarse en staging. Por eso falla CERRADO: si el renderer no inicializa o
// una pagina no se puede rasterizar, lanza `PdfRenderError` y la Edge Function
// marca el run/material como fallido SIN inventar texto ni renderizar en el
// navegador.

import {
  MAX_OCR_IMAGE_BYTES,
  MAX_OCR_PAGES,
} from '../_shared/ocr-material/contract.ts';

export class PdfRenderError extends Error {
  constructor(
    readonly kind: 'init' | 'page',
    readonly pageNumber: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'PdfRenderError';
  }
}

export interface RenderedPage {
  page_number: number; // 1-based
  imageDataUrl: string; // data:image/png;base64,...
}

// Base64 de un Uint8Array sin dependencias (Deno/navegador).
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Renderiza el PDF a PNG por pagina, en orden ascendente y acotado. Falla cerrado
// si MuPDF no inicializa o una pagina no se puede rasterizar / excede el tamano.
export async function renderPdfToPages(
  bytes: Uint8Array,
  opts: { maxPages?: number; scale?: number } = {},
): Promise<RenderedPage[]> {
  const maxPages = Math.min(opts.maxPages ?? MAX_OCR_PAGES, MAX_OCR_PAGES);
  const scale = opts.scale ?? 2; // ~144 DPI; suficiente para OCR de vision.

  // Carga perezosa de MuPDF WASM. Si no se puede importar/inicializar en el
  // runtime de Edge Functions, fail-closed (nunca caer a render de navegador).
  let mupdf: typeof import('https://cdn.jsdelivr.net/npm/mupdf@1.3.4/dist/mupdf.js');
  try {
    mupdf = await import('https://cdn.jsdelivr.net/npm/mupdf@1.3.4/dist/mupdf.js');
  } catch (e) {
    throw new PdfRenderError('init', null, `MuPDF no disponible en el runtime: ${String(e)}`);
  }

  let doc: { countPages(): number; loadPage(i: number): unknown; destroy?: () => void };
  try {
    // openDocument acepta los bytes del PDF.
    doc = (mupdf as unknown as {
      Document: { openDocument(buf: Uint8Array, magic: string): typeof doc };
    }).Document.openDocument(bytes, 'application/pdf');
  } catch (e) {
    throw new PdfRenderError('init', null, `No se pudo abrir el PDF: ${String(e)}`);
  }

  const out: RenderedPage[] = [];
  const total = Math.min(doc.countPages(), maxPages);
  try {
    for (let i = 0; i < total; i++) {
      let png: Uint8Array;
      try {
        const page = doc.loadPage(i) as {
          toPixmap(matrix: number[], colorspace: unknown, alpha: boolean): {
            asPNG(): Uint8Array;
            destroy?: () => void;
          };
          destroy?: () => void;
        };
        const m = (mupdf as unknown as {
          Matrix: { scale(x: number, y: number): number[] };
          ColorSpace: { DeviceRGB: unknown };
        });
        const pixmap = page.toPixmap(m.Matrix.scale(scale, scale), m.ColorSpace.DeviceRGB, false);
        png = pixmap.asPNG();
        pixmap.destroy?.();
        page.destroy?.();
      } catch (e) {
        throw new PdfRenderError('page', i + 1, `No se pudo rasterizar la pagina ${i + 1}: ${String(e)}`);
      }
      if (png.byteLength > MAX_OCR_IMAGE_BYTES) {
        throw new PdfRenderError('page', i + 1, `La pagina ${i + 1} excede el tamano maximo de imagen.`);
      }
      out.push({ page_number: i + 1, imageDataUrl: `data:image/png;base64,${toBase64(png)}` });
    }
  } finally {
    doc.destroy?.();
  }
  return out;
}
