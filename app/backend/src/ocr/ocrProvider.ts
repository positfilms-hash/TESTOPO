// Abstraccion del proveedor OCR/vision (SPEC 030). El proveedor REAL corre solo
// desde un servidor de confianza / Edge Function (nunca desde React/Vite, nunca
// con la clave en el frontend). En tests se usa un mock sin red.

export interface RenderedPage {
  page_number: number;
  /** Imagen renderizada de la pagina (PNG/JPEG). Vacia en el mock. */
  image: Uint8Array;
  /** Referencia privada temporal de la imagen, si se conserva. */
  image_ref?: string | null;
}

export interface OcrPageResult {
  page_number: number;
  text: string;
  /** Confianza 0..1 cuando el proveedor la aporta; null si no. */
  confidence: number | null;
  warnings: string[];
}

export interface OcrProvider {
  readonly name: string;
  readonly model: string | null;
  /** Lee una pagina renderizada y devuelve texto + confianza. Sin red en el mock. */
  recognizePage(page: RenderedPage): Promise<OcrPageResult>;
}
