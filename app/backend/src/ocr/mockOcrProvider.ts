// Proveedor OCR de prueba (SPEC 030): deterministico y SIN RED. Simula la salida
// de un OCR real (texto + confianza por pagina). Configurable para ejercitar las
// bandas de confianza y los fallos parciales en tests.

import type { OcrPageResult, OcrProvider, RenderedPage } from './ocrProvider.js';

export interface MockOcrProviderOptions {
  /** Confianza por pagina (defecto 0.9). */
  confidenceFor?: (pageNumber: number) => number | null;
  /** Texto por pagina (defecto un texto simulado). */
  textFor?: (pageNumber: number) => string;
}

export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock-ocr';
  readonly model = null;

  constructor(private readonly options: MockOcrProviderOptions = {}) {}

  async recognizePage(page: RenderedPage): Promise<OcrPageResult> {
    const confidence = this.options.confidenceFor
      ? this.options.confidenceFor(page.page_number)
      : 0.9;
    const text = this.options.textFor
      ? this.options.textFor(page.page_number)
      : `Texto OCR simulado de la pagina ${page.page_number}.`;
    return {
      page_number: page.page_number,
      // Confianza baja => sin texto utilizable (como un OCR real ilegible).
      text: confidence != null && confidence >= 0.4 ? text : '',
      confidence,
      warnings:
        confidence != null && confidence < 0.7 && confidence >= 0.4
          ? ['Confianza media: revisar.']
          : [],
    };
  }
}
