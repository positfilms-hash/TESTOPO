// Renderizado de paginas de PDF a imagen (SPEC 030). ABSTRACCION acotada: el
// render REAL (PDF -> imagen) corre en la Edge Function/servidor de confianza
// (Fase 2). En Fase 1 (mock) se devuelven paginas placeholder a partir del numero
// de paginas ya conocido del material; el OCR mock no necesita la imagen real.

import type { RenderedPage } from './ocrProvider.js';

export interface PdfPageRenderService {
  renderPages(input: {
    bytes: Uint8Array;
    page_count: number;
    max_pages: number;
  }): Promise<RenderedPage[]>;
}

// Render placeholder (sin canvas): una entrada por pagina hasta `max_pages`.
export class PlaceholderPdfPageRenderService implements PdfPageRenderService {
  async renderPages(input: {
    bytes: Uint8Array;
    page_count: number;
    max_pages: number;
  }): Promise<RenderedPage[]> {
    const total = Math.max(0, Math.min(input.page_count, input.max_pages));
    const pages: RenderedPage[] = [];
    for (let n = 1; n <= total; n++) {
      pages.push({ page_number: n, image: new Uint8Array(0), image_ref: null });
    }
    return pages;
  }
}
